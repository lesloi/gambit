const ROWS = [
  ['r', '', '', '', 'k', '', '', 'r'],
  ['', 'p', 'p', '', '', 'p', 'p', 'p'],
  ['', '', '', '', '', 'n', '', ''],
  ['', '', '', 'q', '', '', '', ''],
  ['', '', '', '', 'P', '', '', ''],
  ['', '', 'N', '', '', '', '', ''],
  ['P', 'P', 'P', '', '', 'P', 'P', 'P'],
  ['R', '', 'B', '', 'K', '', '', 'R'],
] as const;

/** A decorative position, so the empty session still looks like a chess app. */
export function BoardPreview({ className = '' }: { className?: string }) {
  return (
    <div
      className={`border-line grid aspect-square grid-cols-8 grid-rows-[repeat(8,minmax(0,1fr))] overflow-hidden rounded-lg border ${className}`}
      aria-hidden="true"
    >
      {ROWS.flatMap((row, rank) =>
        row.map((piece, file) => {
          const light = (rank + file) % 2 === 0;
          return (
            <div
              key={`${rank}-${file}`}
              className={`grid place-items-center ${light ? 'bg-board-light' : 'bg-board-dark'}`}
            >
              {piece ? (
                <img
                  src={`/pieces/chessnut/${piece === piece.toUpperCase() ? 'w' : 'b'}${piece.toUpperCase()}.svg`}
                  alt=""
                  draggable={false}
                  className="h-full w-full select-none"
                />
              ) : null}
            </div>
          );
        }),
      )}
    </div>
  );
}
