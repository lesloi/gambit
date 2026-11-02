import { UciEngine, type Analyser, type Engine } from './uci';

/** The lite single-threaded build, copied into public/ so it runs without COOP/COEP headers. */
export const STOCKFISH_URL = '/stockfish/stockfish-19-lite-single.js';

class WorkerTransport {
  private readonly worker: Worker;

  constructor(worker: Worker) {
    this.worker = worker;
  }

  post(command: string): void {
    this.worker.postMessage(command);
  }

  subscribe(handlers: { line: (line: string) => void; error: (error: Error) => void }): void {
    this.worker.onmessage = (event: MessageEvent<unknown>) => {
      handlers.line(typeof event.data === 'string' ? event.data : String(event.data));
    };
    this.worker.onerror = (event: ErrorEvent) => {
      handlers.error(new Error(event.message || 'The engine worker failed'));
    };
  }

  close(): void {
    this.worker.terminate();
  }
}

export type StockfishEngine = Engine & Analyser;

export function createStockfishEngine(): StockfishEngine {
  return new UciEngine(new WorkerTransport(new Worker(STOCKFISH_URL)));
}
