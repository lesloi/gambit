export interface MoveRequest {
  /** Stockfish's Skill Level option, 0 to 20; omitted keeps the engine's current setting. */
  skill?: number;
  /** How long the engine may think, in milliseconds. */
  movetimeMs?: number;
}

/** A position's value from the side to move, in centipawns or in moves to mate. */
export interface Score {
  cp: number | null;
  /** Positive when the side to move mates, negative when it is mated. */
  mate: number | null;
}

export interface PositionEval {
  bestMove: string | null;
  /** The last exact score the engine reported, or null when it reported none. */
  score: Score | null;
}

export interface AnalyseRequest {
  /** How long the engine may think, in milliseconds. */
  movetimeMs?: number;
}

export interface Engine {
  /** The engine's first choice in the position, in UCI, or null when it has no legal move. */
  bestMove(fen: string, request?: MoveRequest): Promise<string | null>;
  /** Loads the engine and waits until it accepts a position. */
  prepare(): Promise<void>;
  /** Stops a search in flight, so it cannot hold up the next command. */
  cancel(): void;
  stop(): void;
}

/**
 * A second capability, not part of `Engine`: the analysis needs a score, and a future opponent
 * (Maia) may play without one. The game and the analysis share the same worker.
 */
export interface Analyser {
  /** The best move and its score, at full strength whatever level the game used. */
  analyse(fen: string, request?: AnalyseRequest): Promise<PositionEval>;
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
/** Skill Level 20 is Stockfish's full strength, the only setting an analysis accepts. */
const FULL_SKILL = 20;

const SCORE_PATTERN = /\bscore (cp|mate) (-?\d+)(?: (lowerbound|upperbound))?\b/;

/** The exact score of an `info` line; a bounded score says nothing definite about the position. */
function parseScore(line: string): Score | null {
  if (!line.startsWith('info ')) return null;

  const match = SCORE_PATTERN.exec(line);
  if (!match || match[3] !== undefined) return null;

  const value = Number(match[2]);
  if (!Number.isFinite(value)) return null;
  return match[1] === 'cp' ? { cp: value, mate: null } : { cp: null, mate: value };
}

interface PendingAnswer {
  match: (line: string) => boolean;
  settle: (line: string) => void;
  fail: (error: Error) => void;
}

/**
 * The UCI protocol over a worker, one command at a time. A silent engine would leave the board
 * waiting forever, so every answer has a deadline and a worker error fails the move in flight.
 */
export class UciEngine implements Engine, Analyser {
  private readonly movetimeMs: number;
  private readonly timeoutMs: number;
  private readonly transport: EngineTransport;
  private pending: PendingAnswer | null = null;
  private ready = false;
  private stopped = false;
  /** The Skill Level last sent, so a game does not reset it before every move. */
  private skill: number | null = null;
  /** The last exact score seen since the search started, cleared before every `go`. */
  private lastScore: Score | null = null;
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

  bestMove(fen: string, request: MoveRequest = {}): Promise<string | null> {
    return this.enqueue(async () => {
      await this.handshake();
      this.applySkill(request.skill);
      return (await this.search(fen, request.movetimeMs)).bestMove;
    });
  }

  analyse(fen: string, request: AnalyseRequest = {}): Promise<PositionEval> {
    return this.enqueue(async () => {
      await this.handshake();
      this.applySkill(FULL_SKILL);
      return this.search(fen, request.movetimeMs);
    });
  }

  cancel(): void {
    if (this.stopped) return;
    // `stop` at idle is ignored; during a search it makes the engine answer `bestmove` at once.
    this.transport.post('stop');
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.pending?.fail(new Error('The engine was stopped'));
    this.pending = null;
    this.transport.close();
  }

  private applySkill(requested: number | undefined): void {
    if (requested === undefined) return;

    const skill = Math.min(Math.max(requested, 0), 20);
    if (skill === this.skill) return;

    this.transport.post(`setoption name Skill Level value ${skill}`);
    this.skill = skill;
  }

  private async search(fen: string, movetimeMs?: number): Promise<PositionEval> {
    this.lastScore = null;
    const answer = this.waitFor((line) => line.startsWith('bestmove '), this.timeoutMs);
    this.transport.post(`position fen ${fen}`);
    this.transport.post(`go movetime ${movetimeMs ?? this.movetimeMs}`);

    // `bestmove` may carry a `ponder` move after the move itself; only the first token is ours.
    const line = await answer;
    const [move] = line.slice('bestmove '.length).trim().split(/\s+/);
    return {
      bestMove: !move || move === '(none)' ? null : move,
      score: this.lastScore,
    };
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
      if (trimmed === '') continue;

      const score = parseScore(trimmed);
      if (score !== null) this.lastScore = score;
      if (this.pending?.match(trimmed)) this.pending.settle(trimmed);
    }
  }
}
