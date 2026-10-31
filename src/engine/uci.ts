export interface Engine {
  /** The engine's first choice in the position, in UCI, or null when it has no legal move. */
  bestMove(fen: string): Promise<string | null>;
  /** Loads the engine and waits until it accepts a position. */
  prepare(): Promise<void>;
  stop(): void;
}

export interface EngineTransport {
  post(command: string): void;
  subscribe(handlers: { line: (line: string) => void; error: (error: Error) => void }): void;
  close(): void;
}

export interface UciEngineOptions {
  /** How long the engine may think, in milliseconds. */
  movetimeMs?: number;
  /** How long to wait for any answer before treating the engine as dead. */
  timeoutMs?: number;
}

const DEFAULT_MOVETIME_MS = 400;
const DEFAULT_TIMEOUT_MS = 10_000;

interface PendingAnswer {
  match: (line: string) => boolean;
  settle: (line: string) => void;
  fail: (error: Error) => void;
}

/**
 * The UCI protocol over a worker, one command at a time. A silent engine would leave the board
 * waiting forever, so every answer has a deadline and a worker error fails the move in flight.
 */
export class UciEngine implements Engine {
  private readonly movetimeMs: number;
  private readonly timeoutMs: number;
  private readonly transport: EngineTransport;
  private pending: PendingAnswer | null = null;
  private ready = false;
  private stopped = false;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(transport: EngineTransport, options: UciEngineOptions = {}) {
    this.transport = transport;
    this.movetimeMs = options.movetimeMs ?? DEFAULT_MOVETIME_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    transport.subscribe({
      line: (line) => this.receive(line),
      error: (error) => {
        this.pending?.fail(error);
        this.pending = null;
      },
    });
  }

  prepare(): Promise<void> {
    return this.enqueue(() => this.handshake());
  }

  bestMove(fen: string): Promise<string | null> {
    return this.enqueue(async () => {
      await this.handshake();

      const answer = this.waitFor((line) => line.startsWith('bestmove '), this.timeoutMs);
      this.transport.post(`position fen ${fen}`);
      this.transport.post(`go movetime ${this.movetimeMs}`);

      // `bestmove` may carry a `ponder` move after the move itself; only the first token is ours.
      const line = await answer;
      const [move] = line.slice('bestmove '.length).trim().split(/\s+/);
      return !move || move === '(none)' ? null : move;
    });
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.pending?.fail(new Error('The engine was stopped'));
    this.pending = null;
    this.transport.close();
  }

  private async handshake(): Promise<void> {
    if (this.ready) return;

    const uci = this.waitFor((line) => line === 'uciok', this.timeoutMs);
    this.transport.post('uci');
    await uci;

    const ready = this.waitFor((line) => line === 'readyok', this.timeoutMs);
    this.transport.post('isready');
    await ready;

    this.ready = true;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    if (this.stopped) return Promise.reject(new Error('The engine was stopped'));

    const result = this.queue.then(() => {
      if (this.stopped) throw new Error('The engine was stopped');
      return task();
    });
    this.queue = result.catch(() => undefined);
    return result;
  }

  private waitFor(match: (line: string) => boolean, timeoutMs: number): Promise<string> {
    if (this.pending)
      return Promise.reject(new Error('The engine already has a command in flight'));

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = null;
        reject(new Error(`The engine timed out after ${timeoutMs} ms`));
      }, timeoutMs);

      this.pending = {
        match,
        settle: (line) => {
          clearTimeout(timer);
          this.pending = null;
          resolve(line);
        },
        fail: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
    });
  }

  private receive(chunk: string): void {
    // A worker message may carry several lines; the engine posts its output one line at a time.
    for (const line of chunk.split('\n')) {
      const trimmed = line.trim();
      if (trimmed !== '' && this.pending?.match(trimmed)) this.pending.settle(trimmed);
    }
  }
}
