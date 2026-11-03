/**
 * The move space and the sampler of Maia-3.
 *
 * The network answers with one logit per move of a fixed list, so a position's legal moves have to
 * be mapped onto that list and the illegal ones masked out. Everything here is pure; the worker that
 * runs the model only feeds these functions.
 *
 * The list is upstream's: every from/to pair of the board, then the promotions. Maia mirrors the
 * position when Black is to move, so a promotion always runs from the seventh rank.
 */

const SQUARES = 'abcdefgh';

function buildSpace(): string[] {
  const moves: string[] = [];
  for (let fromRank = 0; fromRank < 8; fromRank += 1) {
    for (let fromFile = 0; fromFile < 8; fromFile += 1) {
      for (let toRank = 0; toRank < 8; toRank += 1) {
        for (let toFile = 0; toFile < 8; toFile += 1) {
          moves.push(`${SQUARES[fromFile]}${fromRank + 1}${SQUARES[toFile]}${toRank + 1}`);
        }
      }
    }
  }
  for (const from of SQUARES) {
    for (const to of SQUARES) {
      for (const piece of 'qrbn') moves.push(`${from}7${to}8${piece}`);
    }
  }
  return moves;
}

/** The model's move list, 4352 entries, in the order its policy head was trained on. */
export const MAIA_MOVES: readonly string[] = buildSpace();

const INDEX_OF_MOVE = new Map(MAIA_MOVES.map((move, index) => [move, index]));

/** Where a move sits in the model's policy, or undefined when the move is not in it. */
export function maiaMoveIndex(move: string): number | undefined {
  return INDEX_OF_MOVE.get(move);
}

/** The same square seen from the other side of the board. */
export function mirrorSquare(square: string): string {
  return `${square[0]}${9 - Number(square[1])}`;
}

/** The move a Black player would see mirrored, which is how the model reads a position. */
export function mirrorMove(move: string): string {
  return `${mirrorSquare(move.slice(0, 2))}${mirrorSquare(move.slice(2, 4))}${move.slice(4)}`;
}

export interface WeightedMove {
  /** The index in `MAIA_MOVES`. */
  index: number;
  probability: number;
}

/**
 * Turns the model's logits into a distribution over the legal moves only, so a masked move can never
 * be drawn. A temperature of 0 keeps the top move with probability 1, which is what makes a game
 * repeatable when the same seed is used.
 */
export function movePolicy(
  logits: ArrayLike<number>,
  legalIndices: readonly number[],
  temperature: number,
): WeightedMove[] {
  if (legalIndices.length === 0) return [];

  if (temperature <= 0) {
    let best = legalIndices[0];
    for (const index of legalIndices) if (logits[index] > logits[best]) best = index;
    return [{ index: best, probability: 1 }];
  }

  const scaled = legalIndices.map((index) => logits[index] / temperature);
  const top = Math.max(...scaled);
  if (!Number.isFinite(top)) {
    // A temperature small enough to overflow has already collapsed to the top move, and
    // Infinity - Infinity would poison every weight with NaN.
    return movePolicy(logits, legalIndices, 0);
  }
  const weights = scaled.map((value) => Math.exp(value - top));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return legalIndices.map((index, position) => ({
    index,
    probability: weights[position] / total,
  }));
}

/** Draws a move from the distribution; `random` returns a number in [0, 1). */
export function sampleMove(policy: readonly WeightedMove[], random: () => number): number | null {
  if (policy.length === 0) return null;

  let draw = random();
  for (const move of policy) {
    draw -= move.probability;
    if (draw < 0) return move.index;
  }
  // Floating point can leave a hair of probability unspent; the last move carries it.
  return policy[policy.length - 1].index;
}

/** A small deterministic generator, so a replay of the same seed gives the same game. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
