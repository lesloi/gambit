import type { Puzzle } from './puzzle';

/**
 * The one puzzle of the vertical slice: a back-rank mate in two, until the content pipeline
 * ships the real subset. Every defensive reply is forced, so the line can be replayed as is.
 */
export const DEMO_PUZZLES: readonly Puzzle[] = [
  {
    id: 'demo-back-rank',
    fen: 'r5k1/5ppp/8/3Q4/8/8/PPP2PPP/3R2K1 w - - 0 1',
    solution: ['d5d8', 'a8d8', 'd1d8'],
    themes: ['backRankMate', 'mateIn2', 'sacrifice'],
    rating: 1500,
  },
];
