/**
 * Builds the puzzle subset the app ships, from the public Lichess puzzle database (CC0).
 *
 * The export is a single rolling file, so a snapshot is identified by its Last-Modified header and
 * the checksum of the CSV that was read; the manifest records both. The subset is committed, so a
 * clone, a build and a release never reach Lichess: only a regeneration downloads the export.
 *
 * Rules, so the result can be read without opening the code:
 *   - rating between 800 and 2200, at least 300 plays, a popularity of at least 85 and a rating
 *     deviation of at most 100 (FILTERS in lib/lichess.ts);
 *   - the puzzle must carry at least one motif: a tag such as `short`, `crushing` or `middlegame`
 *     describes the export, not what the user trains;
 *   - one bucket per motif and per 100-point rating band, filled from the best puzzles first
 *     (popularity, then plays, then id), with the same share given to every bucket and the slots a
 *     scarce bucket cannot fill going to the best puzzles left over;
 *   - a puzzle is counted under its rarest motif, so that `fork` does not swallow the rare ones;
 *   - the line must replay from its position, or the puzzle would stop the user halfway;
 *   - 12000 puzzles, written to content/puzzles.jsonl.gz and described by content/manifest.json.
 *
 * Verification, so a puzzle has one answer (lib/verify.ts holds the exact rules):
 *   - at each user ply the expected move must be the engine's first choice and the second must fall
 *     behind by a mate or by 100 cp; a one-move mate is accepted as the app accepts any mate;
 *   - a line that fails is dropped and the selection runs again without it, until the subset holds
 *     12000 verified puzzles;
 *   - a defensive reply that is the engine's first choice and at least 100 cp ahead of the
 *     alternative marks the puzzle `fullLine`; the other lines stay in the content but are not
 *     served by the full-line drill.
 *
 * The engine is native Stockfish 19, at depth 18, MultiPV 2, one thread and a 16 MB hash cleared
 * before every position. It is a build tool: the app's WebAssembly engine is not used, and the
 * binary never enters the image or the repository.
 *
 * Usage, from the documentation of the export (https://database.lichess.org/#puzzles) and of the
 * engine (https://github.com/official-stockfish/Stockfish/releases/tag/sf_19):
 *
 *   curl -sSLO https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   curl -sSI https://database.lichess.org/lichess_db_puzzle.csv.zst | grep -i last-modified
 *   zstd -d lichess_db_puzzle.csv.zst
 *   curl -sSLO https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-linux-x86-64-universal.tar.gz
 *   tar -xzf stockfish-linux-x86-64-universal.tar.gz
 *   pnpm content:puzzles -- lichess_db_puzzle.csv --last-modified "2026-10-02T08:51:45Z" \
 *     --engine ./stockfish/stockfish-linux-x86-64-universal
 *
 * The analysis takes about an hour on a laptop. It resumes from .cache/verify-lines.jsonl; delete
 * the cache to analyse every line again.
 */
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { availableParallelism } from 'node:os';
import { gzipSync } from 'node:zlib';
import type { Puzzle } from '../src/features/puzzles/puzzle.ts';
import {
  EXPORT_URL,
  FILTERS,
  entryFromRow,
  parseExportRow,
  passesFilters,
  placePuzzle,
  type PlacedPuzzle,
} from './lib/lichess.ts';
import { selectSubset, serializePuzzles, type Subset } from './lib/subset.ts';
import {
  Verifier,
  type PuzzleVerification,
  type VerificationSettings,
} from './lib/verification.ts';
import type { Rejection } from './lib/verify.ts';

/** About 12,000 puzzles keep the image small and give every motif a few hundred cards. */
const TARGET = 12_000;
const BAND_SIZE = 100;
/** The selection stops if the refill cannot bring the subset back to the target. */
const MAX_ROUNDS = 20;

const ENGINE = {
  name: 'Stockfish',
  version: '19',
  /** The UCI name the binary must report, so a different engine cannot pass silently. */
  uci: 'Stockfish 19',
  url: 'https://github.com/official-stockfish/Stockfish/releases/download/sf_19/stockfish-linux-x86-64-universal.tar.gz',
} as const;

const SEARCH = { depth: 18, multiPv: 2, threads: 1, hashMb: 16 } as const;
const MARGINS = { userCp: 100, defenceCp: 100 } as const;
const CACHE_PATH = '.cache/verify-lines.jsonl';

interface Rejections {
  filtered: number;
  malformed: number;
  'no-motif': number;
  illegal: number;
}

interface Stats {
  rows: number;
  rejected: Rejections;
}

interface VerificationCounts {
  positions: number;
  rounds: number;
  rejected: Record<Rejection, number>;
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function usage(message: string): never {
  console.error(`${message}\n`);
  console.error(
    `Usage: pnpm content:puzzles -- <export.csv> --last-modified <ISO date> --engine <stockfish> [--workers <n>]\n` +
      '  Get the date with: curl -sI https://database.lichess.org/lichess_db_puzzle.csv.zst | grep -i last-modified\n' +
      `  Get the engine with: curl -sSLO ${ENGINE.url} && tar -xzf stockfish-linux-x86-64-universal.tar.gz`,
  );
  process.exit(1);
}

/** Reads the export once per call: the selection needs two passes and the file stays on disk. */
async function* readEntries(
  csvPath: string,
  stats: Stats,
  counting: boolean,
  excluded: ReadonlySet<string>,
) {
  const lines = createInterface({ input: createReadStream(csvPath, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.startsWith('PuzzleId,') || line.trim() === '') continue;
    if (counting) stats.rows += 1;

    const row = parseExportRow(line);
    if (!row) {
      if (counting) stats.rejected.malformed += 1;
      continue;
    }
    if (excluded.has(row.id)) continue;
    if (!passesFilters(row, FILTERS)) {
      if (counting) stats.rejected.filtered += 1;
      continue;
    }

    const entry = entryFromRow(row);
    if (!entry) {
      if (counting) stats.rejected['no-motif'] += 1;
      continue;
    }
    yield entry;
  }
}

function sorted(counts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The replay decides which lines are accepted and produces the stored FEN, so it is pinned. */
function chessjsVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(new URL('../node_modules/chess.js/package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    return pkg.version;
  } catch {
    return 'unknown';
  }
}

async function hashFile(path: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk as Buffer);
    bytes += (chunk as Buffer).length;
  }
  return { sha256: hash.digest('hex'), bytes };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const positional = args.filter((arg, index) => {
    if (arg.startsWith('--')) return false;
    const previous = args[index - 1] ?? '';
    return previous === '--' || !previous.startsWith('--');
  });
  const csvPath = positional[0];
  const lastModified = flag('last-modified');
  const enginePath = flag('engine');
  const workersFlag = flag('workers');

  if (!csvPath) usage('The path of the decompressed export is missing.');
  if (!lastModified) usage('The Last-Modified date of the export is missing.');
  if (!enginePath) usage('The path of the native Stockfish binary is missing.');
  const workers = workersFlag ? Number(workersFlag) : availableParallelism();
  if (!Number.isInteger(workers) || workers < 1) usage('--workers must be a positive integer.');

  const csv = await hashFile(csvPath);
  let engineFile: { sha256: string; bytes: number };
  try {
    engineFile = await hashFile(enginePath);
  } catch {
    usage(`The engine binary could not be read: ${enginePath}`);
  }

  const settings: VerificationSettings = {
    engine: { version: ENGINE.version, sha256: engineFile.sha256 },
    search: { ...SEARCH },
    margins: { userMarginCp: MARGINS.userCp, defenceMarginCp: MARGINS.defenceCp },
  };
  const verifier = new Verifier({
    binary: enginePath,
    expectedVersion: ENGINE.uci,
    lanes: workers,
    settings,
    cachePath: CACHE_PATH,
    progress: (done, total) => {
      if (done % 250 === 0 || done === total) {
        console.error(`  searched ${done}/${total} new puzzles…`);
      }
    },
  });

  try {
    // Fail on a different binary before the selection and the hour of analysis.
    await verifier.ready();

    const stats: Stats = {
      rows: 0,
      rejected: { filtered: 0, malformed: 0, 'no-motif': 0, illegal: 0 },
    };
    const excluded = new Set<string>();
    const results = new Map<string, PuzzleVerification>();
    const verification: VerificationCounts = {
      positions: 0,
      rounds: 0,
      rejected: { 'not-best': 0, 'not-clear': 0 },
    };

    let counted = false;
    let finalSubset: Subset | null = null;
    let finalPuzzles: PlacedPuzzle[] = [];
    let firstThemes: Record<string, number> | null = null;

    for (let round = 1; round <= MAX_ROUNDS; round += 1) {
      verification.rounds = round;
      console.error(
        `Round ${round}: selecting ${TARGET} puzzles (${excluded.size} excluded so far).`,
      );
      const read = () => readEntries(csvPath, stats, counted ? false : (counted = true), excluded);
      const subset = await selectSubset(read, {
        target: TARGET,
        minRating: FILTERS.minRating,
        maxRating: FILTERS.maxRating,
        bandSize: BAND_SIZE,
      });
      if (firstThemes === null) firstThemes = subset.themes;

      const candidates: PlacedPuzzle[] = [];
      for (const entry of subset.entries) {
        const placed = placePuzzle(entry);
        if (placed.ok) {
          candidates.push(placed.puzzle);
        } else {
          stats.rejected.illegal += 1;
          excluded.add(entry.id);
        }
      }

      const pending = candidates.filter((puzzle) => !results.has(puzzle.id));
      console.error(`  ${candidates.length} candidates, ${pending.length} still to search.`);
      const fresh = await verifier.verify(pending);
      for (const [id, result] of fresh) {
        results.set(id, result);
        verification.positions += result.positions;
        if (!result.ok) {
          excluded.add(id);
          verification.rejected[result.reason] += 1;
        }
      }

      finalSubset = subset;
      finalPuzzles = candidates;

      const accepted = candidates.every((puzzle) => results.get(puzzle.id)?.ok);
      if (candidates.length === TARGET && accepted) break;

      const rejectedThisRound = [...fresh.values()].some((result) => !result.ok);
      const illegalThisRound = candidates.length < subset.entries.length;
      if (!rejectedThisRound && !illegalThisRound) {
        throw new Error(
          `Only ${candidates.length} puzzles could be selected and verified; the export cannot fill ${TARGET}.`,
        );
      }
      if (round === MAX_ROUNDS) {
        throw new Error(
          `The selection only reached ${candidates.length} verified puzzles in ${MAX_ROUNDS} rounds.`,
        );
      }
    }

    const subset = finalSubset as Subset;
    const lostThemes = Object.keys(firstThemes ?? {}).filter((theme) => !(theme in subset.themes));
    if (lostThemes.length > 0) {
      throw new Error(`The verification lost motifs: ${lostThemes.join(', ')}.`);
    }

    const puzzles: Puzzle[] = finalPuzzles.map((puzzle) => {
      const result = results.get(puzzle.id);
      if (!result?.ok) throw new Error(`No verification for ${puzzle.id}.`);
      return { ...puzzle, fullLine: result.fullLine };
    });
    if (puzzles.length !== TARGET) {
      throw new Error(`The content holds ${puzzles.length} puzzles instead of ${TARGET}.`);
    }

    const jsonl = Buffer.from(serializePuzzles(puzzles), 'utf8');
    const gz = gzipSync(jsonl, { level: 9 });
    mkdirSync('content', { recursive: true });
    writeFileSync('content/puzzles.jsonl.gz', gz);
    writeFileSync(
      'content/manifest.json',
      `${JSON.stringify(
        {
          schemaVersion: 2,
          source: {
            name: 'Lichess puzzle database',
            url: EXPORT_URL,
            lastModified,
            csvSha256: csv.sha256,
            csvBytes: csv.bytes,
          },
          filters: FILTERS,
          selection: {
            target: TARGET,
            bandSize: BAND_SIZE,
            grid: 'one bucket per motif and rating band, equal shares, best first',
          },
          verification: {
            engine: {
              name: ENGINE.name,
              version: ENGINE.version,
              source: ENGINE.url,
              sha256: engineFile.sha256,
              bytes: engineFile.bytes,
            },
            search: { ...SEARCH, clearHash: true },
            margins: { userCp: MARGINS.userCp, defenceCp: MARGINS.defenceCp },
            counts: {
              positions: verification.positions,
              rounds: verification.rounds,
              rejected: verification.rejected,
              fullLine: puzzles.filter((puzzle) => puzzle.fullLine).length,
              notFullLine: puzzles.filter((puzzle) => !puzzle.fullLine).length,
            },
          },
          counts: {
            rows: stats.rows,
            puzzles: puzzles.length,
            duplicates: subset.duplicates,
            rejected: stats.rejected,
            themes: sorted(subset.themes),
            bands: sorted(subset.bands),
          },
          files: {
            'puzzles.jsonl.gz': {
              sha256: createHash('sha256').update(gz).digest('hex'),
              bytes: gz.length,
              jsonlSha256: createHash('sha256').update(jsonl).digest('hex'),
              jsonlBytes: jsonl.length,
            },
          },
          tools: { 'chess.js': chessjsVersion() },
        },
        null,
        2,
      )}\n`,
    );

    console.log(
      `${puzzles.length} puzzles, ${jsonl.length} bytes of JSONL, ${gz.length} bytes gzipped.`,
    );
    console.log(`Rejected: ${JSON.stringify(stats.rejected)}, duplicates: ${subset.duplicates}.`);
    console.log(
      `Verified with ${ENGINE.uci}: ${verification.positions} positions, ` +
        `${JSON.stringify(verification.rejected)} rejected, ` +
        `${puzzles.filter((puzzle) => puzzle.fullLine).length} full-line.`,
    );
    console.log(
      `Analysis: ${verifier.stats.analysed} puzzles searched, ${verifier.stats.cached} from cache.`,
    );
  } finally {
    verifier.close();
  }
}

await main();
