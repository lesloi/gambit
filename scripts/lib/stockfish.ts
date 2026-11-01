import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Analysis } from './verify.ts';

export interface UciInfo {
  multipv: number;
  move: string;
  score: Analysis['score'];
}

const INFO = /^info .*?\bmultipv (\d+)\b.*?\bscore (cp|mate) (-?\d+)\b.*?\bpv (\S+)/;

/** Reads one `info` line of a UCI search; null for anything else. */
export function parseInfo(line: string): UciInfo | null {
  const match = INFO.exec(line);
  if (!match) return null;
  return {
    multipv: Number(match[1]),
    score: { kind: match[2] as 'cp' | 'mate', value: Number(match[3]) },
    move: match[4]!,
  };
}

export interface StockfishOptions {
  binary: string;
  depth: number;
  multiPv: number;
  threads: number;
  hashMb: number;
}

interface Waiter {
  predicate: (line: string) => boolean;
  onData?: (line: string) => void;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
}

/**
 * One native Stockfish process driven over UCI. Every position starts with `ucinewgame`, which
 * clears the transposition table, so a verdict does not depend on what was searched before it and
 * the same binary always produces the same analysis. Single-threaded for the same reason.
 */
export class Stockfish {
  version = '';
  private readonly waiters: Waiter[] = [];
  private readonly process: ChildProcessWithoutNullStreams;
  private readonly options: StockfishOptions;
  private stderr = '';

  private constructor(process: ChildProcessWithoutNullStreams, options: StockfishOptions) {
    this.process = process;
    this.options = options;
    const lines = createInterface({ input: process.stdout });
    lines.on('line', (line) => this.receive(line));
    process.stderr.on('data', (chunk: Buffer) => {
      this.stderr = `${this.stderr}${chunk.toString('utf8')}`.slice(-2000);
    });
    process.on('error', (error) => this.fail(error));
    process.on('exit', (code) => {
      if (this.waiters.length > 0) {
        this.fail(
          new Error(`Stockfish exited with code ${code} while waiting.\n${this.stderr.trim()}`),
        );
      }
    });
  }

  static async start(options: StockfishOptions): Promise<Stockfish> {
    const process = spawn(options.binary, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    const engine = new Stockfish(process, options);
    await engine.handshake();
    return engine;
  }

  private async handshake(): Promise<void> {
    this.send('uci');
    await this.waitFor((line) => line === 'uciok');
    if (this.version === '') throw new Error('The engine did not name itself over UCI.');

    this.send(`setoption name Threads value ${this.options.threads}`);
    this.send(`setoption name Hash value ${this.options.hashMb}`);
    this.send(`setoption name MultiPV value ${this.options.multiPv}`);
    this.send('isready');
    await this.waitFor((line) => line === 'readyok');
  }

  async analyse(fen: string): Promise<Analysis[]> {
    this.send('ucinewgame');
    this.send('isready');
    await this.waitFor((line) => line === 'readyok');

    this.send(`position fen ${fen}`);
    this.send(`go depth ${this.options.depth}`);

    const found = new Map<number, UciInfo>();
    const bestmove = await this.waitFor(
      (line) => line.startsWith('bestmove'),
      (line) => {
        const info = parseInfo(line);
        if (info) found.set(info.multipv, info);
      },
    );
    if (bestmove.includes('(none)') || bestmove.includes('0000')) return [];

    return [...found.entries()]
      .sort(([a], [b]) => a - b)
      .slice(0, this.options.multiPv)
      .map(([, info]) => ({ move: info.move, score: info.score }));
  }

  close(): void {
    try {
      this.send('quit');
      this.process.stdin.end();
    } catch {
      // The engine has already gone; there is nothing left to close.
    }
  }

  private send(command: string): void {
    if (!this.process.stdin.writable) throw new Error('Stockfish is not accepting input.');
    this.process.stdin.write(`${command}\n`);
  }

  private receive(line: string): void {
    if (line.startsWith('id name ')) this.version = line.slice('id name '.length).trim();

    const waiter = this.waiters[0];
    if (!waiter) return;
    waiter.onData?.(line);
    if (waiter.predicate(line)) {
      this.waiters.shift();
      waiter.resolve(line);
    }
  }

  private waitFor(
    predicate: (line: string) => boolean,
    onData?: (line: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.waiters.push({ predicate, onData, resolve, reject });
    });
  }

  private fail(error: Error): void {
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }
}
