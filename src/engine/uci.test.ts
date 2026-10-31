import { describe, expect, it } from 'vitest';
import { UciEngine, type EngineTransport } from './uci';

/** A transport that answers like a UCI engine, with no worker in the way. */
class FakeTransport implements EngineTransport {
  readonly commands: string[] = [];
  readonly closed: boolean[] = [];
  private readonly answer: (command: string) => readonly string[];
  private line: ((value: string) => void) | null = null;
  private error: ((value: Error) => void) | null = null;

  constructor(answer: (command: string) => readonly string[] = stockfish) {
    this.answer = answer;
  }

  post(command: string): void {
    this.commands.push(command);
    queueMicrotask(() => {
      for (const line of this.answer(command)) this.line?.(line);
    });
  }

  subscribe(handlers: { line: (line: string) => void; error: (error: Error) => void }): void {
    this.line = handlers.line;
    this.error = handlers.error;
  }

  close(): void {
    this.closed.push(true);
  }

  fail(error: Error): void {
    this.error?.(error);
  }
}

function stockfish(command: string): readonly string[] {
  if (command === 'uci') return ['id name Stockfish', 'uciok'];
  if (command === 'isready') return ['readyok'];
  if (command.startsWith('go ')) return ['info depth 12 score cp 34', 'bestmove e2e4'];
  return [];
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('UCI engine', () => {
  it('handshakes once, then asks for the best move of the position', async () => {
    const transport = new FakeTransport();
    const engine = new UciEngine(transport);

    const move = await engine.bestMove(START);

    expect(move).toBe('e2e4');
    expect(transport.commands).toEqual([
      'uci',
      'isready',
      `position fen ${START}`,
      'go movetime 400',
    ]);
  });

  it('answers a second position after the first move without handshaking again', async () => {
    const transport = new FakeTransport();
    const engine = new UciEngine(transport);

    await engine.bestMove(START);
    await engine.bestMove(START);

    expect(transport.commands.filter((command) => command === 'uci')).toHaveLength(1);
    expect(transport.commands.filter((command) => command === 'isready')).toHaveLength(1);
    expect(transport.commands.filter((command) => command.startsWith('position fen'))).toHaveLength(
      2,
    );
  });

  it('reads a best move that arrives with other lines in the same message', async () => {
    const transport = new FakeTransport((command) =>
      command.startsWith('go ') ? ['info depth 12\nbestmove e2e4'] : stockfish(command),
    );
    const engine = new UciEngine(transport);

    await expect(engine.bestMove(START)).resolves.toBe('e2e4');
  });

  it('keeps only the move when the engine also names a ponder move', async () => {
    const transport = new FakeTransport((command) =>
      command.startsWith('go ') ? ['bestmove e2e4 ponder e7e5'] : stockfish(command),
    );
    const engine = new UciEngine(transport);

    await expect(engine.bestMove(START)).resolves.toBe('e2e4');
  });

  it('returns null when the position has no legal move', async () => {
    const transport = new FakeTransport((command) =>
      command.startsWith('go ') ? ['bestmove (none)'] : stockfish(command),
    );
    const engine = new UciEngine(transport);

    await expect(engine.bestMove(START)).resolves.toBeNull();
  });

  it('fails the move when the engine never answers', async () => {
    const transport = new FakeTransport((command) =>
      command.startsWith('go ') ? [] : stockfish(command),
    );
    const engine = new UciEngine(transport, { timeoutMs: 5 });

    await expect(engine.bestMove(START)).rejects.toThrow(/timed out/i);
    engine.stop();
  });

  it('fails the pending move when the worker reports an error', async () => {
    const transport = new FakeTransport((command) => {
      if (command.startsWith('go ')) {
        queueMicrotask(() => transport.fail(new Error('worker died')));
        return [];
      }
      return stockfish(command);
    });
    const engine = new UciEngine(transport);

    await expect(engine.bestMove(START)).rejects.toThrow('worker died');
    engine.stop();
  });

  it('stops a search without closing the worker', () => {
    const transport = new FakeTransport();
    const engine = new UciEngine(transport);

    engine.cancel();

    expect(transport.commands).toEqual(['stop']);
    expect(transport.closed).toHaveLength(0);
  });

  it('closes the worker and refuses new moves once stopped', async () => {
    const transport = new FakeTransport();
    const engine = new UciEngine(transport);

    engine.stop();

    expect(transport.closed).toHaveLength(1);
    await expect(engine.bestMove(START)).rejects.toThrow(/stopped/i);
  });
});
