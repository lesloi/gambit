import { Rating } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { cardId } from '../../db/cards';
import type { Endgame } from '../endgames/endgame';
import type { OpeningLine } from '../openings/opening';
import type { Puzzle } from '../puzzles/puzzle';
import { cellId, sessionCatalog } from './catalog';
import { planSession, type SessionPlanOptions } from './plan';
import type { JournalReview } from './cells';

const START = Date.UTC(2026, 0, 1, 9, 0, 0);
const MINUTE = 60_000;
const DAY = 86_400_000;

function puzzle(id: string, themes: string[], rating: number): Puzzle {
  return {
    id,
    fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    solution: ['a1a2'],
    themes,
    rating,
    fullLine: true,
  };
}

function endgame(id: string, name: string): Endgame {
  return {
    id,
    name,
    fen: '8/8/8/4k3/8/8/5K2/6Q1 w - - 0 1',
    result: 'win',
    goal: 'Mater.',
  };
}

function opening(id: string, name: string): OpeningLine {
  return { id, name, color: 'white', moves: ['d2d4', 'd7d5'] };
}

const catalog = sessionCatalog(
  [
    puzzle('a', ['fork'], 900),
    puzzle('b', ['fork'], 950),
    puzzle('c', ['pin'], 1250),
    puzzle('d', ['mate'], 1700),
    puzzle('e', ['skewer'], 1050),
    puzzle('f', ['discovery'], 1300),
    puzzle('g', ['skewer'], 1100),
  ],
  [endgame('kqk', 'Dame contre roi'), endgame('kpk', 'Pion contre roi')],
  [opening('london', 'London'), opening('french', 'Française')],
);

const reviews: JournalReview[] = [
  { id: 1, cardId: cardId('puzzle', 'a'), rating: Rating.Good, reviewedAt: START - DAY },
  { id: 2, cardId: cardId('endgame', 'kqk'), rating: Rating.Good, reviewedAt: START - 2 * DAY },
  { id: 3, cardId: cardId('opening', 'london'), rating: Rating.Again, reviewedAt: START - DAY },
];

function plan(overrides: Partial<SessionPlanOptions> = {}) {
  return planSession({
    reviews,
    catalog,
    startedAt: START,
    lastEntryId: 3,
    newCount: 3,
    band: 'low',
    ...overrides,
  });
}

const kinds = (result: ReturnType<typeof plan>): string[] => result.cards.map((card) => card.kind);

const puzzleIds = (result: ReturnType<typeof plan>): string[] =>
  result.cards.filter((card) => card.kind === 'puzzle').map((card) => card.puzzle.id);

describe('planSession', () => {
  it('puts the due cards of every mode first, one mode at a time', () => {
    const result = plan();

    expect(result.dueCount).toBe(3);
    expect(kinds(result).slice(0, 3)).toEqual(['puzzle', 'endgame', 'opening']);
  });

  it('serves an unseen puzzle of a due motif cell', () => {
    const result = plan();
    const [first] = result.cards;

    expect(first).toMatchObject({ kind: 'puzzle', cellId: cellId('fork', 'low') });
    if (first?.kind === 'puzzle') expect(first.puzzle.id).toBe('b');
  });

  it('fills the rest with at most N new cards', () => {
    const result = plan({ newCount: 2 });

    expect(result.dueCount).toBe(3);
    expect(result.newCount).toBe(2);
    expect(kinds(result).slice(3)).toEqual(['puzzle', 'endgame']);
  });

  it('interleaves the new cards across the modes', () => {
    const result = plan();

    expect(kinds(result).slice(result.dueCount)).toEqual(['puzzle', 'endgame', 'opening']);
  });

  it('interleaves the due cards of every mode, each mode by urgency', () => {
    const more: JournalReview[] = [
      ...reviews,
      {
        id: 4,
        cardId: cardId('puzzle', 'e'),
        rating: Rating.Good,
        reviewedAt: START - 12 * 3600_000,
      },
    ];

    const result = plan({ reviews: more, lastEntryId: 4, newCount: 2 });
    const due = result.cards.slice(0, result.dueCount).map((card) => {
      if (card.kind === 'puzzle') return `puzzle:${card.puzzle.id}`;
      return card.kind;
    });

    expect(due).toEqual(['puzzle:b', 'endgame', 'opening', 'puzzle:g']);
  });

  it('never serves the same position twice', () => {
    const ids = puzzleIds(plan({ newCount: 5 }));

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves out a due cell that has no unseen puzzle left', () => {
    const exhausted: JournalReview[] = [
      ...reviews,
      {
        id: 4,
        cardId: cardId('puzzle', 'b'),
        rating: Rating.Again,
        reviewedAt: START - 12 * 3600_000,
      },
    ];

    const result = plan({ reviews: exhausted, lastEntryId: 4 });

    expect(result.dueCount).toBe(2);
    expect(kinds(result).slice(0, 2)).toEqual(['endgame', 'opening']);
    expect(puzzleIds(result)).not.toContain('a');
    expect(puzzleIds(result)).not.toContain('b');
  });

  it('ignores a review written after the pin', () => {
    const late: JournalReview[] = [
      ...reviews,
      { id: 4, cardId: cardId('puzzle', 'c'), rating: Rating.Good, reviewedAt: START + MINUTE },
    ];

    expect(plan({ reviews: late, lastEntryId: 3 })).toEqual(
      plan({ reviews: late.slice(0, 3), lastEntryId: 3 }),
    );
  });

  it('gives the same queue when the session is loaded again', () => {
    expect(plan()).toEqual(plan());
  });

  it('does not introduce a cell the journal already schedules', () => {
    const scheduled: JournalReview[] = [
      ...reviews,
      { id: 4, cardId: cardId('puzzle', 'c'), rating: Rating.Good, reviewedAt: START - MINUTE },
    ];

    const result = plan({ reviews: scheduled, lastEntryId: 4, band: 'middle', newCount: 5 });
    const cells = result.cards.filter((card) => card.kind === 'puzzle').map((card) => card.cellId);

    expect(cells).not.toContain(cellId('pin', 'middle'));
    expect(cells).toContain(cellId('discovery', 'middle'));
  });

  it('draws new cells from the chosen band', () => {
    const result = plan({ band: 'high', newCount: 5 });
    const fresh = result.cards[result.dueCount];

    expect(fresh).toMatchObject({ kind: 'puzzle', cellId: cellId('mate', 'high') });
  });

  it('falls back to a higher band when the chosen one has no new cell', () => {
    const scheduled: JournalReview[] = [
      ...reviews,
      { id: 4, cardId: cardId('puzzle', 'c'), rating: Rating.Good, reviewedAt: START - MINUTE },
      { id: 5, cardId: cardId('puzzle', 'f'), rating: Rating.Good, reviewedAt: START - MINUTE },
    ];

    const result = plan({ reviews: scheduled, lastEntryId: 5, band: 'middle', newCount: 1 });
    const fresh = result.cards[result.dueCount];

    expect(fresh).toMatchObject({ kind: 'puzzle', cellId: cellId('mate', 'high') });
  });

  it('drops a due card whose content the catalog does not hold', () => {
    const gone: JournalReview[] = [
      ...reviews,
      { id: 4, cardId: cardId('endgame', 'gone'), rating: Rating.Good, reviewedAt: START - DAY },
    ];

    const result = plan({ reviews: gone, lastEntryId: 4 });

    expect(result.dueCount).toBe(3);
    expect(kinds(result).slice(0, 3)).toEqual(['puzzle', 'endgame', 'opening']);
  });

  it('counts only the new cards it could resolve', () => {
    const small = sessionCatalog(
      [puzzle('a', ['fork'], 900)],
      [endgame('kqk', 'Dame contre roi')],
      [],
    );

    const result = plan({ catalog: small, newCount: 5 });
    const fresh = result.newCount;
    const due = result.dueCount;

    expect(due).toBe(1);
    expect(fresh).toBe(0);
  });

  it('has nothing on an empty catalog', () => {
    const empty = sessionCatalog([], [], []);

    expect(plan({ catalog: empty, reviews: [], lastEntryId: 0 })).toEqual({
      cards: [],
      dueCount: 0,
      newCount: 0,
    });
  });
});
