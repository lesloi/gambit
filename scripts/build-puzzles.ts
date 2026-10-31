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
 * Usage, from the documentation of the export (https://database.lichess.org/#puzzles):
 *
 *   curl -sSLO https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   curl -sSI https://database.lichess.org/lichess_db_puzzle.csv.zst | grep -i last-modified
 *   zstd -d lichess_db_puzzle.csv.zst
 *   npm run content:puzzles -- lichess_db_puzzle.csv --last-modified "2026-10-02T08:51:45Z"
 */
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import type { Puzzle } from '../src/features/puzzles/puzzle.ts';
import {
  EXPORT_URL,
  FILTERS,
  entryFromRow,
  parseExportRow,
  passesFilters,
  placePuzzle,
} from './lib/lichess.ts';
import { selectSubset, serializePuzzles } from './lib/subset.ts';

/** About 12,000 puzzles keep the image small and give every motif a few hundred cards. */
const TARGET = 12_000;
const BAND_SIZE = 100;

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

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function usage(message: string): never {
  console.error(`${message}\n`);
  console.error(
    'Usage: npm run content:puzzles -- <export.csv> --last-modified <ISO date>\n' +
      '  Get the date with: curl -sI https://database.lichess.org/lichess_db_puzzle.csv.zst | grep -i last-modified',
  );
  process.exit(1);
}

/** Reads the export once per call: the selection needs two passes and the file stays on disk. */
async function* readEntries(csvPath: string, stats: Stats, counting: boolean) {
  const lines = createInterface({ input: createReadStream(csvPath, 'utf8'), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.startsWith('PuzzleId,') || line.trim() === '') continue;
    if (counting) stats.rows += 1;

    const row = parseExportRow(line);
    if (!row) {
      if (counting) stats.rejected.malformed += 1;
      continue;
    }
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

async function main(): Promise<void> {
  const csvPath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  const lastModified = flag('last-modified');
  if (!csvPath) usage('The path of the decompressed export is missing.');
  if (!lastModified) usage('The Last-Modified date of the export is missing.');

  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(csvPath)) {
    hash.update(chunk as Buffer);
    bytes += (chunk as Buffer).length;
  }

  const stats: Stats = {
    rows: 0,
    rejected: { filtered: 0, malformed: 0, 'no-motif': 0, illegal: 0 },
  };
  let pass = 0;
  // Only the first read counts: the selection reads the export twice, and the counters are the same.
  const read = () => readEntries(csvPath, stats, (pass += 1) === 1);

  const subset = await selectSubset(read, {
    target: TARGET,
    minRating: FILTERS.minRating,
    maxRating: FILTERS.maxRating,
    bandSize: BAND_SIZE,
  });

  const puzzles: Puzzle[] = [];
  for (const entry of subset.entries) {
    const result = placePuzzle(entry);
    if (result.ok) puzzles.push(result.puzzle);
    else stats.rejected.illegal += 1;
  }

  const jsonl = Buffer.from(serializePuzzles(puzzles), 'utf8');
  const gz = gzipSync(jsonl, { level: 9 });
  mkdirSync('content', { recursive: true });
  writeFileSync('content/puzzles.jsonl.gz', gz);
  writeFileSync(
    'content/manifest.json',
    `${JSON.stringify(
      {
        schemaVersion: 1,
        source: {
          name: 'Lichess puzzle database',
          url: EXPORT_URL,
          lastModified,
          csvSha256: hash.digest('hex'),
          csvBytes: bytes,
        },
        filters: FILTERS,
        selection: {
          target: TARGET,
          bandSize: BAND_SIZE,
          grid: 'one bucket per motif and rating band, equal shares, best first',
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

await main();
