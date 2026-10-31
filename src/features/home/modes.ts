import { BookOpen, Crown, Puzzle, Swords, type LucideIcon } from 'lucide-react';

export type ModeId = 'puzzles' | 'endgames' | 'openings' | 'play';

/** The home screen groups the modes: everything that trains a position, then playing a game. */
export type ModeGroup = 'train' | 'play';

export interface Mode {
  id: ModeId;
  icon: LucideIcon;
  group: ModeGroup;
  /** False until the mode has content and a working flow, so the home screen tells the truth. */
  available: boolean;
}

export const MODES: readonly Mode[] = [
  { id: 'puzzles', icon: Puzzle, group: 'train', available: true },
  { id: 'endgames', icon: Crown, group: 'train', available: true },
  { id: 'openings', icon: BookOpen, group: 'train', available: false },
  { id: 'play', icon: Swords, group: 'play', available: false },
];
