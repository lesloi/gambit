import type { Puzzle } from '../../src/features/puzzles/puzzle.ts';
import type { Entry } from './lichess.ts';

export interface SubsetOptions {
  target: number;
  minRating: number;
  maxRating: number;
  bandSize: number;
}

export interface Subset {
  entries: readonly Entry[];
  /** Puzzles per motif, counting each puzzle once for the motif it was classified under. */
  themes: Record<string, number>;
  /** Puzzles per rating band, keyed by the band's lowest rating. */
  bands: Record<string, number>;
  /** Candidates dropped because another entry held the same position and line. */
  duplicates: number;
}

/**
 * A bucket only ever gives about `target / buckets` cards, so holding a few dozen is enough for
 * the whole subset; the export itself is read as a stream and never held in memory.
 */
const BUCKET_CAP = 64;

/**
 * Popularity first, then the number of plays, then the identifier. The order is total, so a
 * selection never depends on the order the export happened to be read in.
 */
function byQuality(a: Entry, b: Entry): number {
  return (
    b.popularity - a.popularity || b.plays - a.plays || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function insertBest(bucket: Entry[], entry: Entry): void {
  if (bucket.length === BUCKET_CAP && byQuality(entry, bucket[BUCKET_CAP - 1]!) >= 0) return;
  const index = bucket.findIndex((kept) => byQuality(entry, kept) < 0);
  if (index === -1) bucket.push(entry);
  else bucket.splice(index, 0, entry);
  if (bucket.length > BUCKET_CAP) bucket.pop();
}

/**
 * The motif a puzzle is counted under. The rarest one is chosen so that a common tag such as
 * `fork` does not swallow the puzzles of a rare motif; a tie falls back to the alphabetical order.
 * The content still carries every motif, so the filters of the app see them all.
 */
export function primaryTheme(
  motifs: readonly string[],
  counts: ReadonlyMap<string, number>,
): string {
  return [...motifs].sort(
    (a, b) => (counts.get(a) ?? 0) - (counts.get(b) ?? 0) || (a < b ? -1 : a > b ? 1 : 0),
  )[0]!;
}

/** The largest share every bucket can give, so that a bucket which holds little does not skew it. */
function waterQuota(sizes: readonly number[], target: number): number {
  const total = (quota: number) => sizes.reduce((sum, size) => sum + Math.min(size, quota), 0);

  let low = 0;
  let high = Math.max(0, ...sizes);
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (total(middle) <= target) low = middle;
    else high = middle - 1;
  }
  return low;
}

async function countMotifs(
  entries: AsyncIterable<Entry> | Iterable<Entry>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for await (const { motifs } of entries) {
    for (const motif of motifs) counts.set(motif, (counts.get(motif) ?? 0) + 1);
  }
  return counts;
}

/**
 * Picks the subset in two reads of the export: the first one counts the motifs, without which a
 * puzzle cannot be classified, and the second one keeps the best of every motif and rating band.
 * The source is a function rather than a collection so that the caller can read the file twice
 * instead of holding six million rows in memory.
 */
export async function selectSubset(
  read: () => AsyncIterable<Entry> | Iterable<Entry>,
  options: SubsetOptions,
): Promise<Subset> {
  const counts = await countMotifs(read());
  const bands = Math.max(1, Math.ceil((options.maxRating - options.minRating) / options.bandSize));

  const bandOf = (entry: Entry) =>
    options.minRating +
    Math.min(bands - 1, Math.floor((entry.rating - options.minRating) / options.bandSize)) *
      options.bandSize;
  const bucketOf = (entry: Entry) => `${bandOf(entry)}:${primaryTheme(entry.motifs, counts)}`;

  const buckets = new Map<string, Entry[]>();
  for await (const entry of read()) {
    const key = bucketOf(entry);
    const bucket = buckets.get(key);
    if (bucket) insertBest(bucket, entry);
    else buckets.set(key, [entry]);
  }

  // The same position can come back under another identifier; the better copy is the one to keep.
  const unique = new Map<string, Entry>();
  for (const bucket of buckets.values()) {
    for (const entry of bucket) {
      const key = `${entry.fen}|${entry.moves.join(' ')}`;
      const kept = unique.get(key);
      if (!kept || byQuality(entry, kept) < 0) unique.set(key, entry);
    }
  }

  const pool = new Map<string, Entry[]>();
  for (const entry of unique.values()) {
    const key = bucketOf(entry);
    const bucket = pool.get(key);
    if (bucket) bucket.push(entry);
    else pool.set(key, [entry]);
  }

  const keys = [...pool.keys()].sort();
  for (const key of keys) pool.get(key)!.sort(byQuality);

  const quota = waterQuota(
    keys.map((key) => pool.get(key)!.length),
    options.target,
  );
  const taken = new Map<string, number>();
  let total = 0;
  for (const key of keys) {
    const count = Math.min(quota, pool.get(key)!.length);
    taken.set(key, count);
    total += count;
  }

  // The quota rarely fills the target exactly. The last slots go one each to the buckets left with
  // the best puzzle: a bucket takes at most one extra, so the top-up cannot undo the spread.
  let remaining = options.target - total;
  const withRoom: { key: string; next: Entry }[] = [];
  for (const key of keys) {
    const next = pool.get(key)![taken.get(key)!];
    if (next) withRoom.push({ key, next });
  }
  withRoom.sort((a, b) => byQuality(a.next, b.next) || (a.key < b.key ? -1 : 1));
  for (const { key } of withRoom) {
    if (remaining <= 0) break;
    taken.set(key, taken.get(key)! + 1);
    remaining -= 1;
  }

  const entries = keys
    .flatMap((key) => pool.get(key)!.slice(0, taken.get(key)!))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    entries,
    themes: countBy(entries, (entry) => primaryTheme(entry.motifs, counts)),
    bands: countBy(entries, (entry) => String(bandOf(entry))),
    duplicates: [...buckets.values()].flat().length - unique.size,
  };
}

function countBy(entries: readonly Entry[], key: (entry: Entry) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) counts[key(entry)] = (counts[key(entry)] ?? 0) + 1;
  return counts;
}

/** One JSON object per line, in the shape of the app's `Puzzle`. */
export function serializePuzzles(puzzles: readonly Puzzle[]): string {
  return puzzles
    .map(({ id, fen, solution, rating, themes, fullLine }) =>
      JSON.stringify({ id, fen, solution, rating, themes, fullLine }),
    )
    .join('\n')
    .concat(puzzles.length > 0 ? '\n' : '');
}
