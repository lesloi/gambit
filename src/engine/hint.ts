import { FULL_SKILL } from './uci';

/** A hint always comes from the full-strength engine, whatever level the game is played at. */
export const HINT_SKILL = FULL_SKILL;
/** Long enough for the engine to name its move rather than shuffle, short enough to stay a hint. */
export const HINT_MOVETIME_MS = 1200;
