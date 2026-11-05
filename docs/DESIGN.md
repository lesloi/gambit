# Design

Tailwind classes limited to the tokens of [`src/styles/index.css`](../src/styles/index.css), and
[lucide-react](https://lucide.dev) icons. No component library.

## Theme

- The scheme is a choice: **clair**, **sombre** or **système**, and système is the default. The
  preference lives in `localStorage` under `gambit:theme`, out of the backup like the puzzle
  filters: losing it only costs the default.
- `data-theme="light|dark"` on `<html>` carries the resolved scheme; the palette is written twice
  under `:root` and `:root[data-theme='dark']`. `main.tsx` paints the stored choice before React
  renders; a dark device can still show one light frame while the bundle loads, which the strict
  CSP (no inline script) makes hard to avoid, and that frame is cheaper than loosening it.
- `theme-color` follows the scheme, or the phone's status bar keeps the wrong colour.
- The board keeps its wood in both schemes: it is the fixed reference the pieces are drawn
  against, and the only surface that does not swap.

## Tokens

| Token          | Clair     | Sombre    | Used for                     |
| -------------- | --------- | --------- | ---------------------------- |
| `paper`        | `#fbfaf8` | `#191817` | the page                     |
| `paper-raised` | `#ffffff` | `#211f1d` | panels, the board preview    |
| `ink`          | `#1c1a18` | `#e5e2dc` | text                         |
| `ink-muted`    | `#5f5a54` | `#a49e95` | secondary text, labels       |
| `line`         | `#e6e1d9` | `#2f2c29` | borders, dividers            |
| `line-soft`    | `#efeae2` | `#262421` | the rule between two rows    |
| `accent`       | `#2a72bd` | `#2a72bd` | filled actions               |
| `accent-ink`   | `#1c6cbc` | `#7bb9ee` | the accent as text, icons    |
| `accent-soft`  | `#e8f0f9` | `#1c2a38` | the selected chip of a group |
| `board-light`  | `#f0d9b5` | `#f0d9b5` | light squares                |
| `board-dark`   | `#b58863` | `#b58863` | dark squares                 |

`ok`, `ok-soft`, `bad`, `bad-soft` follow the same two-stop rule and stay readable on both papers.
`accent` is the filled colour and `accent-ink` the readable one: on the dark paper the blue that
holds white text is too dark for a label.

Sans everywhere (`font-sans`), one system stack: no font is downloaded, so the first paint needs
no network.

## Layout

- One column, `max-w-2xl`: `px-5` on the home screen, `px-4` on the game screens, which add
  `sm:px-6`.
- The home screen reads top to bottom: the header rule, the board hero and its session card, the
  three trainers, the play row, the mistakes row, the appearance row, the footer.
- The header is the wordmark and the date on one line, closed by a rule.
- The hero is a decorative board, about 300 px and centred, never wider than the column. The
  session card overlaps its lower edge, inset by 12 px; it carries the state, the counts, the
  screen's primary action (start, resume, or start a new one) and the session settings.
- The trainers are numbered rows (01–03): the number, the name, the goal, a due badge when the
  session preview knows it, then a chevron. A mode whose flow does not work yet is disabled and
  shows the "Bientôt" badge in the chevron's place. Playing is a row of its own under them, with
  the level and the time control; it opens the play screen, where a stored game resumes. The
  mistakes row follows, and opens the puzzles marked for review.
- The session screen holds the progress (`done / total`, a bar and the remaining counts), then the
  current card in the player of its mode. The next button says "Terminer" on the last one.
- The appearance row is the last thing before the footer: a three-way choice, always visible, no
  hidden state. A preference set once does not deserve a menu.
- The session card's button is the home screen's only filled action; the play and mistakes rows are
  outlined or text. A game in progress has none: the board is the action, and a filled hint button
  would push people to use it. Once the game is over, the analysis button takes that role.
- Corners are `rounded-sm` (4 px), badges are `rounded-xs`, separators are hairlines, and nothing
  casts a shadow.

## Board

- `chessground` fills a square container; its size comes from the container, never from a fixed
  pixel value.
- Coordinates are shown on the edges of the board at 0.55 rem, muted.
- A piece is dragged or moved by two taps, as chessground does by default. A promotion opens a
  chooser, never a native prompt.
- The last move is highlighted with a soft accent; the legal destinations are a dot on an empty
  square and a ring on an occupied one.
- The board never scrolls the page while a piece is dragged: `touch-action: none` on the board.

## Calculation

- A puzzle is solved in the usual way, or in **full line** mode, a setting of the puzzle screen.
- In full line, the user enters the moves of both sides. The board applies them without revealing
  anything: no verdict, no opponent reply, no rating change until the end.
- A small turn indicator says whose move is being entered; the board never flips during the line.
- On validation, the app replays the sequence and stops at the **first divergence**, highlighting
  the move and showing the expected one. Partial credit is the point: the metric is the depth in
  plies, not a pass or fail.
- Only positions whose defensive replies are forced are served, so a legal alternative never counts
  as a mistake.
- No timer. The exercise is about holding the line, not speed; a clock would push towards guessing.

## Play

- The setup screen holds the level slider and the time control, then the primary action starts the
  game from the initial position; White is the user.
- The game screen is two columns from `md`: the opponent's clock, the board and the user's clock on
  the left, with the status and the result under them; the score sheet and the actions on the
  right. Under `md` the sheet drops under the board, capped so the buttons stay reachable.
- A clock is a name and a time on one line; only the running one is in `ink` and semibold.
- Each clock row carries the pieces its side has taken from the other, and the side ahead shows its
  advantage in pawns. The list is decorative; the advantage is announced, and it is the board's
  material, so a promotion counts even though it adds no piece to the list.
- The score sheet replays the game's moves into standard notation, two per row, the last row in
  `ink`. It only appears once a move is played.
- The clock starts with the first move, so the user's first move costs no time.
- The engine's think time comes from its own clock: a third of an even forty-move share of the
  control, plus the increment, varied by up to a fifth around that share, and never more than a
  fifth of the time left. The level only sets Stockfish's Skill Level, so a weaker opponent does
  not play faster.
- A hint draws the engine's move as an arrow in the board's hint brush, at full strength whatever
  level the game uses, and marks the game as assisted; there is no takeback.
- An unassisted game can be analysed at full strength: every position is scored once, and a move
  that gives away at least 20 points of winning chance is a blunder, or a missed win when the
  position was already won. The list shows the played move and the engine's choice, and a click
  puts the position before the move on the board with that choice drawn as an arrow.
- The result panel names the winner and the reason, then offers a new game or a change of level;
  it offers the analysis only when no hint was used.

## Accessibility

The target is [WCAG 2.2](https://www.w3.org/TR/WCAG22/) level AA. In practice:

- Touch targets are at least 44 px, except the squares of the board, which are as large as the
  screen allows.
- Every control has an accessible name in French; icons are decorative (`aria-hidden`).
- The whole app works with the keyboard, with a visible focus ring (`outline-accent`).
- State is exposed with `aria-pressed`, `aria-current` or `aria-expanded`, never by a class alone.
- A result that appears after an action is announced by a live region that already exists, empty
  until then; an error is an `alert`.
- Sizes follow the user's font size, and animations respect `prefers-reduced-motion`.
- The board announces the position and the last move in text, so a screen reader user can follow.

## Consistency

- The content of a row shares the same left and right edges; nothing sticks out.
- Titles are left-aligned; button labels are centred.
- No ad hoc margin, size or colour: use a token or an existing component.
- An empty state says what will fill it, in one sentence, without an exclamation mark.
