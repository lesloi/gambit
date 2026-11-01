import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Puzzle } from '../../src/features/puzzles/puzzle.ts';
import { Stockfish } from './stockfish.ts';
import {
  analyseLine,
  isMateInOne,
  judgeLine,
  type Analysis,
  type PlyAnalysis,
  type Verification,
  type VerificationOptions,
} from './verify.ts';

/** What makes two analyses interchangeable: the same binary, settings and line. */
export interface VerificationSettings {
  engine: { version: string; sha256: string };
  search: { depth: number; multiPv: number; threads: number; hashMb: number };
  margins: VerificationOptions;
}

export interface VerifierOptions {
  binary: string;
  /** The UCI name the binary must report, such as `Stockfish 19`. */
  expectedVersion: string;
  lanes: number;
  settings: VerificationSettings;
  cachePath: string;
  /** Called after every search, so a long run can say where it is. */
  progress?: (done: number, total: number) => void;
}

export type PuzzleVerification = Verification & { id: string; cached: boolean };

export interface VerificationStats {
  analysed: number;
  cached: number;
  positions: number;
}

/** The engine only needs the line: the export metadata and the index stay out of the analysis. */
type VerifiablePuzzle = Pick<Puzzle, 'id' | 'fen' | 'solution'>;

interface CacheRecord {
  id: string;
  line: string;
  engine: string;
  sha256: string;
  depth: number;
  multiPv: number;
  threads: number;
  hashMb: number;
  plies: PlyAnalysis[];
}

function lineHash(puzzle: Pick<Puzzle, 'fen' | 'solution'>): string {
  return createHash('sha256')
    .update(`${puzzle.fen}\n${puzzle.solution.join(' ')}`)
    .digest('hex');
}

function keyOf(
  line: string,
  settings: { engine: string; sha256: string } & VerificationSettings['search'],
): string {
  return [
    line,
    settings.engine,
    settings.sha256,
    settings.depth,
    settings.multiPv,
    settings.threads,
    settings.hashMb,
  ].join('|');
}

function isAnalysis(value: unknown): value is Analysis {
  if (typeof value !== 'object' || value === null) return false;
  const { move, score } = value as Record<string, unknown>;
  if (typeof move !== 'string' || typeof score !== 'object' || score === null) return false;
  const { kind, value: points } = score as Record<string, unknown>;
  return (
    (kind === 'cp' || kind === 'mate') && typeof points === 'number' && Number.isFinite(points)
  );
}

function isPlyAnalysis(value: unknown): value is PlyAnalysis {
  if (typeof value !== 'object' || value === null) return false;
  const { best, second } = value as Record<string, unknown>;
  return (best === null || isAnalysis(best)) && (second === null || isAnalysis(second));
}

function isCacheRecord(value: unknown): value is CacheRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.line === 'string' &&
    typeof record.engine === 'string' &&
    typeof record.sha256 === 'string' &&
    Number.isInteger(record.depth) &&
    Number.isInteger(record.multiPv) &&
    Number.isInteger(record.threads) &&
    Number.isInteger(record.hashMb) &&
    Array.isArray(record.plies) &&
    record.plies.every(isPlyAnalysis)
  );
}

/**
 * Checks a batch of puzzles against one native Stockfish, one single-threaded process per lane, and
 * keeps every analysis in an append-only cache. The cache stores the raw first two lines of each
 * position, not the verdict, so changing a margin only rejudges the lines and never searches them
 * again. A truncated last line is ignored, which makes an interrupted run resumable.
 */
export class Verifier {
  private readonly options: VerifierOptions;
  readonly stats: VerificationStats = { analysed: 0, cached: 0, positions: 0 };
  private readonly cache = new Map<string, CacheRecord>();
  private readonly engines: Stockfish[] = [];
  private actualVersion = '';

  constructor(options: VerifierOptions) {
    this.options = options;
    this.load();
  }

  /** The UCI name of the engine, known once the processes have started. */
  get version(): string {
    return this.actualVersion;
  }

  async ready(): Promise<void> {
    if (this.engines.length > 0) return;

    const search = this.options.settings.search;
    const engines = await Promise.all(
      Array.from({ length: Math.max(1, this.options.lanes) }, () =>
        Stockfish.start({
          binary: this.options.binary,
          depth: search.depth,
          multiPv: search.multiPv,
          threads: search.threads,
          hashMb: search.hashMb,
        }),
      ),
    );

    try {
      for (const engine of engines) {
        if (engine.version !== this.options.expectedVersion) {
          throw new Error(
            `Expected ${this.options.expectedVersion}, got ${engine.version}. ` +
              'Update the engine constants and the documentation before regenerating the content.',
          );
        }
      }
    } catch (error) {
      for (const engine of engines) engine.close();
      throw error;
    }

    this.engines.push(...engines);
    this.actualVersion = engines[0]!.version;
  }

  async verify(puzzles: readonly VerifiablePuzzle[]): Promise<Map<string, PuzzleVerification>> {
    const results = new Map<string, PuzzleVerification>();
    const misses: VerifiablePuzzle[] = [];

    for (const puzzle of puzzles) {
      if (isMateInOne(puzzle)) {
        results.set(puzzle.id, {
          id: puzzle.id,
          ...judgeLine(puzzle, [], this.options.settings.margins),
          cached: false,
        });
        continue;
      }

      const line = lineHash(puzzle);
      const record = this.cache.get(this.cacheKey(line));
      if (record && record.plies.length === puzzle.solution.length) {
        results.set(puzzle.id, {
          id: puzzle.id,
          ...judgeLine(puzzle, record.plies, this.options.settings.margins),
          cached: true,
        });
        this.stats.cached += 1;
        this.stats.positions += record.plies.length;
      } else {
        misses.push(puzzle);
      }
    }

    if (misses.length === 0) return results;
    await this.ready();

    let next = 0;
    let done = 0;
    await Promise.all(
      this.engines.map(async (engine) => {
        while (true) {
          const index = next;
          next += 1;
          if (index >= misses.length) break;

          const puzzle = misses[index]!;
          const plies = await analyseLine(puzzle, engine);
          this.remember(puzzle, plies);
          results.set(puzzle.id, {
            id: puzzle.id,
            ...judgeLine(puzzle, plies, this.options.settings.margins),
            cached: false,
          });
          this.stats.analysed += 1;
          this.stats.positions += plies.length;
          done += 1;
          this.options.progress?.(done, misses.length);
        }
      }),
    );

    return results;
  }

  close(): void {
    for (const engine of this.engines.splice(0)) engine.close();
  }

  private cacheKey(line: string): string {
    const { engine, search } = this.options.settings;
    return keyOf(line, {
      engine: this.options.expectedVersion,
      sha256: engine.sha256,
      ...search,
    });
  }

  private load(): void {
    const path = this.options.cachePath;
    if (!existsSync(path)) return;

    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (line.trim() === '') continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        continue;
      }
      if (!isCacheRecord(value)) continue;
      this.cache.set(keyOf(value.line, value), value);
    }
  }

  private remember(puzzle: VerifiablePuzzle, plies: PlyAnalysis[]): void {
    const line = lineHash(puzzle);
    const record: CacheRecord = {
      id: puzzle.id,
      line,
      engine: this.options.expectedVersion,
      sha256: this.options.settings.engine.sha256,
      ...this.options.settings.search,
      plies,
    };

    this.cache.set(this.cacheKey(line), record);
    mkdirSync(dirname(this.options.cachePath), { recursive: true });
    appendFileSync(this.options.cachePath, `${JSON.stringify(record)}\n`);
  }
}
