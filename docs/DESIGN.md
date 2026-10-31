# Design

Tailwind classes limited to the tokens of [`src/styles/index.css`](../src/styles/index.css), and
[lucide-react](https://lucide.dev) icons. No component library.

## Tokens

| Token          | Value     | Used for                    |
| -------------- | --------- | --------------------------- |
| `paper`        | `#f7f3ea` | the page                    |
| `paper-raised` | `#fffdf8` | cards, the header chip      |
| `ink`          | `#2b251f` | text                        |
| `ink-muted`    | `#6f6355` | secondary text, labels      |
| `line`         | `#e2d8c6` | borders, dividers           |
| `accent`       | `#b4552d` | eyebrows, icons, focus ring |
| `accent-soft`  | `#f3e4d8` | the icon tile of a card     |
| `board-light`  | `#f0d9b5` | light squares               |
| `board-dark`   | `#b58863` | dark squares                |

Serif titles (`font-serif`) and sans body (`font-sans`). The serif is a system stack: no font is
downloaded, so the first paint needs no network.

## Layout

- One column, `max-w-2xl`, page margin `px-5` on phones and `px-8` from `sm`.
- The home screen reads top to bottom: wordmark, the session card, the modes, the footer. The
  footer is pushed to the bottom when the page is shorter than the screen.
- The session card holds a small board on the phone (stacked) and beside the text from `sm`.
- The modes are one column on the phone and two from `sm`. A card is not a button until its mode
  works; the "Bientôt" badge says so.
- One primary action per screen. Today the home screen has none, because none of the modes can run
  yet.

## Board

- `chessground` fills a square container; its size comes from the container, never from a fixed
  pixel value.
- Coordinates are shown on the edges of the board at 12 px, muted.
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

- The content of a card shares the same left and right edges; nothing sticks out.
- Titles are left-aligned; button labels are centred.
- No ad hoc margin, size or colour: use a token or an existing component.
- An empty state says what will fill it, in one sentence, without an exclamation mark.
