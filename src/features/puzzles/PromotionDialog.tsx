import { useEffect, useLayoutEffect, useRef } from 'react';
import { fr } from '../../i18n/fr';
import type { PromotionPiece } from './puzzle';

const LABEL: Record<PromotionPiece, string> = {
  q: fr.puzzle.promotion.queen,
  r: fr.puzzle.promotion.rook,
  b: fr.puzzle.promotion.bishop,
  n: fr.puzzle.promotion.knight,
};

const ROLE: Record<PromotionPiece, string> = { q: 'Q', r: 'R', b: 'B', n: 'N' };

/** The centre of the promotion square and its size, in viewport coordinates. */
export interface PromotionAnchor {
  x: number;
  y: number;
  size: number;
}

export interface PromotionDialogProps {
  color: 'white' | 'black';
  options: readonly PromotionPiece[];
  /** Measured again on resize and scroll, since the viewport can move under the dialog. */
  measure: () => PromotionAnchor | null;
  onChoose: (piece: PromotionPiece) => void;
  onCancel: () => void;
}

/**
 * The chooser of DESIGN.md: a modal placed against the promotion square, so the hand stays on the
 * square it just used. The keyboard leaves it with Escape and the first piece takes the focus. The
 * screen mounts it only while a promotion is pending.
 */
export function PromotionDialog({
  color,
  options,
  measure,
  onChoose,
  onCancel,
}: PromotionDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const measureLatest = useRef(measure);

  useEffect(() => {
    measureLatest.current = measure;
  });

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!element.open) element.showModal();

    // Placing after `showModal` measures the dialog at its real size. The card sits beside the
    // square, on the side with room, so it never covers the pawn on the promotion square; it then
    // clamps to the viewport edges.
    const place = () => {
      const margin = 8;
      const anchor = measureLatest.current();
      const { width, height } = element.getBoundingClientRect();
      const leftRoom = anchor ? anchor.x - anchor.size / 2 : 0;
      const rightRoom = anchor ? window.innerWidth - (anchor.x + anchor.size / 2) : 0;

      let left = (window.innerWidth - width) / 2;
      if (anchor) {
        if (rightRoom >= width + margin) left = anchor.x + anchor.size / 2 + margin;
        else if (leftRoom >= width + margin) left = anchor.x - anchor.size / 2 - margin - width;
        else left = anchor.x - width / 2;
      }
      left = Math.min(Math.max(margin, left), window.innerWidth - width - margin);

      let top = (window.innerHeight - height) / 2;
      if (anchor) top = anchor.y - anchor.size / 2;
      top = Math.min(Math.max(margin, top), window.innerHeight - height - margin);

      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      if (element.open) element.close();
    };
  }, []);

  // Closing explicitly, rather than letting the dialog unmount, keeps the focus restoration.
  // The cleanup still closes in development, where StrictMode mounts the effect twice.
  const close = () => {
    const element = dialog.current;
    if (element?.open) element.close();
  };

  const choose = (piece: PromotionPiece) => {
    close();
    onChoose(piece);
  };

  const cancel = () => {
    close();
    onCancel();
  };

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onClick={(event) => {
        // A click on the backdrop targets the dialog itself; a button keeps its own target, which
        // a keyboard-synthesised click cannot fake with coordinates.
        if (event.target === event.currentTarget) cancel();
      }}
      aria-labelledby="promotion-title"
      className="border-line bg-paper-raised text-ink fixed inset-auto m-0 w-33 rounded-2xl border p-2 shadow-xl backdrop:bg-ink/20"
    >
      <h2 id="promotion-title" className="sr-only">
        {fr.puzzle.promotion.title}
      </h2>

      <div className="grid grid-cols-2 gap-1">
        {options.map((piece) => (
          <button
            key={piece}
            type="button"
            aria-label={LABEL[piece]}
            onClick={() => choose(piece)}
            className="border-line hover:border-accent grid size-14 place-items-center rounded-lg border"
          >
            <img
              src={`/pieces/chessnut/${color === 'white' ? 'w' : 'b'}${ROLE[piece]}.svg`}
              alt=""
              draggable={false}
              className="size-9 select-none"
            />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={cancel}
        className="text-ink-muted hover:text-ink mt-1.5 min-h-11 w-full rounded-lg text-sm"
      >
        {fr.puzzle.promotion.cancel}
      </button>
    </dialog>
  );
}
