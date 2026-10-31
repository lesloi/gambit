import type { Puzzle } from './puzzle';

/**
 * The vertical slice, until the content pipeline ships the real subset: a back-rank mate in two,
 * then a knight under-promotion mate taken from the committed subset. Every defensive reply is
 * forced, so the lines can be replayed as is.
 */
export const DEMO_PUZZLES: readonly Puzzle[] = [
  {
    id: 'demo-back-rank',
    fen: 'r5k1/5ppp/8/3Q4/8/8/PPP2PPP/3R2K1 w - - 0 1',
    solution: ['d5d8', 'a8d8', 'd1d8'],
    themes: ['backRankMate', 'mateIn2', 'sacrifice'],
    rating: 1500,
  },
  {
    id: 'oJe20',
    fen: '8/3R1P2/4k2p/4P3/3p1K1P/3P4/2b5/1r6 w - - 3 43',
    solution: ['f7f8n'],
    themes: ['advancedPawn', 'cornerMate', 'mateIn1', 'promotion', 'underPromotion'],
    rating: 817,
  },
];
