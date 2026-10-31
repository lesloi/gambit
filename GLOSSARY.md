# Gambit

Trains a chess player on positions it can measure: tactics, endgames, openings and games.

The interface is French; the code, the commits and these documents are English. Each entry gives
the French word the interface shows.

## Language

### Training

**Session** _(session du jour)_:
The set of cards due today, taken in one sitting: puzzles, endgames and opening lines together.
It is computed from the journal, never stored as a list.
_Avoid_: Workout, daily challenge, queue

**Mode** _(mode)_:
One of the five activities: puzzles, motifs, endgames, openings, games. A card belongs to one mode.
_Avoid_: Category, section, tab

**Review** _(révision)_:
One attempt at a card and the rating recorded for it: the user's choice after a solve, `again` when
the attempt is missed. Reviews are appended to the journal and never edited; they are the source of
truth of the progression.
_Avoid_: Attempt, answer, result

**Card** _(fiche)_:
A schedulable item: a puzzle, an endgame position or an opening line, with its FSRS state. Its
state is derived from the reviews of that item.
_Avoid_: Item, exercise, question

**Due** _(échéance)_:
The date at which a card should be reviewed again. A due card is what a session holds.
_Avoid_: Deadline, next date

**Rating** _(note)_:
What a review is worth to the scheduler: chosen by the user after a solve, `again` when the attempt
is missed. It feeds FSRS and the statistics.
_Avoid_: Grade, score, result

**Full line** _(ligne complète)_:
Solving a puzzle by entering the moves of both sides without feedback, then checking the sequence
up to the first divergence. It trains calculation depth; it is an option of the puzzle screen, not
a mode.
_Avoid_: Blind mode, calculation mode

### Content

**Puzzle** _(puzzle)_:
A position with one winning line, taken from the public Lichess puzzle set. It has a stable ID, a
rating, themes and the moves of the solution.
_Avoid_: Problem, exercise, position

**Motif** _(motif)_:
A tactical pattern shared by many puzzles, such as a pin, a fork or a discovered attack. Puzzles
can be filtered by motif, and the motif of a puzzle is shown after the solve.
_Avoid_: Pattern, theme, tactic type

**Endgame** _(finale)_:
A position with few pieces and a known result, played out against the engine. The expected result
is part of the content, and the app checks the conversion locally.
_Avoid_: Ending, final phase

**Opening** _(ouverture)_:
The first moves of a game, learned as a repertoire.
_Avoid_: Debut, start

**Line** _(ligne)_:
A sequence of moves of a repertoire, from the first move to the position the repertoire stops at.
A line is a card: it is reviewed as a whole.
_Avoid_: Variation, branch, sequence

**Repertoire** _(répertoire)_:
The set of lines the user plays, one per colour and per first move of the opponent. The first
version ships a curated repertoire for both colours.
_Avoid_: Book, openings list

**Content set** _(contenu embarqué)_:
Everything shipped inside the app: the puzzle subset, the opening lines and the endgame
positions. It is versioned with the code and baked into the image.
_Avoid_: Database, catalog, library

### Engine

**Engine** _(moteur)_:
Stockfish, compiled to WebAssembly and run in a Web Worker. It plays the endgames and the games,
and analyses them afterwards.
_Avoid_: AI, bot, computer

**Level** _(niveau)_:
The strength the engine plays at, expressed as an approximate Elo. It is a setting of the game
mode, not a property of the user.
_Avoid_: Difficulty, strength

**Analysis** _(analyse)_:
The review of a finished game: the engine's best moves, the blunders and the moves it would have
played.
_Avoid_: Review (reserved for a card), report

### Data

**Backup** _(sauvegarde)_:
A JSON file the user exports and imports, holding the journal, the cards, the games and the
settings. It replaces the local data on import; there is no merge and no server copy.
_Avoid_: Sync, cloud, account, export (as a noun for the whole)
