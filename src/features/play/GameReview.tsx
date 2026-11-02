import { useEffect, useRef, useState } from 'react';
import type { PositionEval } from '../../engine/uci';
import { fr } from '../../i18n/fr';
import { sideToMove } from '../../lib/chess';
import { ChessBoard } from '../../ui/ChessBoard';
import { ANALYSIS_MOVETIME_MS, reviewGame, type Finding } from './analysis';
import type { PlayState } from './game';

type ReviewState =
  { status: 'running'; done: number; total: number } | { status: 'ready' } | { status: 'failed' };

const NO_DESTS = new Map<string, string[]>();
const ignoreMove = () => {};

function moveLabel(finding: Finding): string {
  return `${finding.moveNumber}${finding.side === 'white' ? '.' : '…'}`;
}

function kindLabel(kind: Finding['kind']): string {
  return kind === 'missed-win' ? fr.play.analysis.missedWin : fr.play.analysis.blunder;
}

function kindClass(kind: Finding['kind']): string {
  return kind === 'missed-win' ? 'bg-accent-soft text-ink' : 'bg-bad-soft text-bad';
}

/**
 * Reads the finished game back at full strength, then shows the user's blunders and missed wins.
 * A click on a finding puts the position before that move on the board with the engine's choice
 * drawn as an arrow.
 */
export function GameReview({
  analyse,
  game,
  onNewGame,
  onChangeSettings,
}: {
  analyse: (fen: string, movetimeMs: number) => Promise<PositionEval>;
  game: PlayState;
  onNewGame: () => void;
  onChangeSettings: () => void;
}) {
  const [state, setState] = useState<ReviewState>({ status: 'running', done: 0, total: 0 });
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [selected, setSelected] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const boardHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    reviewGame((fen) => analyse(fen, ANALYSIS_MOVETIME_MS), game, {
      onProgress: (done, total) => {
        if (!cancelled) setState({ status: 'running', done, total });
      },
      cancelled: () => cancelled,
    }).then(
      (result) => {
        if (cancelled || result === null) return;
        setFindings(result);
        setState({ status: 'ready' });
      },
      () => {
        if (!cancelled) setState({ status: 'failed' });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [analyse, game, attempt]);

  const retry = () => {
    setState({ status: 'running', done: 0, total: 0 });
    setFindings([]);
    setSelected(0);
    setAttempt((value) => value + 1);
  };

  const finding = findings[selected] ?? null;
  const progress =
    state.status === 'running'
      ? state.total === 0
        ? fr.play.analysis.starting
        : fr.play.analysis.progress
            .replace('{done}', String(state.done))
            .replace('{total}', String(state.total))
      : state.status === 'ready' && findings.length > 0
        ? fr.play.analysis.finished
        : state.status === 'ready'
          ? fr.play.analysis.empty
          : '';

  const select = (index: number) => {
    setSelected(index);
    boardHost.current?.scrollIntoView({ block: 'center' });
  };

  return (
    <>
      <h2 className="font-serif text-lg">{fr.play.analysis.title}</h2>

      <p className="text-ink-muted mt-2 text-sm" role="status">
        {progress}
      </p>

      {state.status === 'failed' ? (
        <div
          role="alert"
          className="border-line bg-paper-raised mt-6 rounded-2xl border p-4 text-center"
        >
          <p className="text-sm">{fr.play.analysis.failed}</p>
          <button
            type="button"
            onClick={retry}
            className="bg-accent mt-3 rounded-xl px-4 py-3 text-sm font-semibold text-white"
          >
            {fr.play.analysis.retry}
          </button>
        </div>
      ) : finding ? (
        <>
          <div
            ref={boardHost}
            aria-label={fr.play.board}
            className="border-line bg-paper-raised mt-3 rounded-2xl border p-2.5 sm:p-3"
          >
            <ChessBoard
              fen={finding.fen}
              orientation={game.userColor}
              turn={sideToMove(finding.fen)}
              lastMove={finding.lastMove}
              movable={false}
              dests={NO_DESTS}
              onMove={ignoreMove}
              hint={{ from: finding.bestUci.slice(0, 2), to: finding.bestUci.slice(2, 4) }}
            />
          </div>

          <p className="mt-2 text-sm font-medium" aria-live="polite">
            {moveLabel(finding)} {finding.playedSan} ·{' '}
            {fr.play.analysis.best.replace('{move}', finding.bestSan)}
          </p>

          <h3 className="text-ink-muted mt-5 text-sm">{fr.play.analysis.findings}</h3>
          <ul className="mt-2 grid gap-2">
            {findings.map((item, index) => (
              <li key={item.ply}>
                <button
                  type="button"
                  aria-pressed={index === selected}
                  onClick={() => select(index)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    index === selected
                      ? 'border-accent bg-paper-raised'
                      : 'border-line bg-paper-raised hover:border-accent/40'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {moveLabel(item)} {item.playedSan}
                    </span>
                    <span className="text-ink-muted mt-1 block text-xs">
                      {fr.play.analysis.best.replace('{move}', item.bestSan)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${kindClass(item.kind)}`}
                  >
                    {kindLabel(item.kind)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onNewGame}
          className="bg-accent flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white"
        >
          {fr.play.newGame}
        </button>
        <button
          type="button"
          onClick={onChangeSettings}
          className="border-line text-ink-muted flex-1 rounded-xl border px-4 py-3 text-sm"
        >
          {fr.play.changeSettings}
        </button>
      </div>
    </>
  );
}
