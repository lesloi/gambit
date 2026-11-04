import * as ort from 'onnxruntime-web/wasm';

/**
 * Runs the Maia model off the main thread.
 *
 * The runtime stays single-threaded: threads would need `SharedArrayBuffer`, so COOP and COEP on
 * every response of the app, which the Stockfish worker does not need either. The WebAssembly
 * binary is served from the app's own assets, so nothing is fetched from a third party.
 */
ort.env.wasm.numThreads = 1;
// The package does not export its own `.wasm`, so the runtime is served from the app's assets:
// `/ort/` holds `ort-wasm-simd-threaded.wasm`, copied from `onnxruntime-web/dist`.
ort.env.wasm.wasmPaths = { wasm: '/ort/ort-wasm-simd-threaded.wasm' };

interface LoadMessage {
  type: 'load';
  url: string;
}

interface MoveMessage {
  type: 'move';
  id: number;
  tokens: ArrayBuffer;
  rating: number;
}

type Request = LoadMessage | MoveMessage;

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Request>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

let session: ort.InferenceSession | null = null;

async function load(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Maia model: HTTP ${response.status}`);
  const weights = await response.arrayBuffer();
  session = await ort.InferenceSession.create(weights, { executionProviders: ['wasm'] });
}

scope.onmessage = async (event) => {
  const message = event.data;
  const id = message.type === 'move' ? message.id : undefined;

  try {
    if (message.type === 'load') {
      await load(message.url);
      scope.postMessage({ type: 'ready' });
      return;
    }

    if (session === null) throw new Error('The Maia model is not loaded');
    const tokens = new Float32Array(message.tokens);
    const result = await session.run({
      tokens: new ort.Tensor('float32', tokens, [1, 64, tokens.length / 64]),
      elo_self: new ort.Tensor('float32', Float32Array.from([message.rating]), [1]),
      elo_oppo: new ort.Tensor('float32', Float32Array.from([message.rating]), [1]),
    });

    // The policy is applied where the legal moves are, on the main thread: the worker only runs
    // the network. Handing the buffer over avoids a copy per move.
    const logits = new Float32Array(result.logits_move.data as Float32Array);
    scope.postMessage({ type: 'move', id, logits: logits.buffer }, [logits.buffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The Maia engine failed';
    scope.postMessage({ type: 'error', id, message });
  }
};
