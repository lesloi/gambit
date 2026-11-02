# Maia

Maia is a family of chess models that predict the move a player of a given rating would play,
rather than the best move. It is the candidate opponent of the game mode. It records what was
verified on 31 October 2026, before the engine existed; the engine and the game mode have since
shipped with Stockfish, so the section on the interface describes what a second opponent would meet.
The lasting choice lives in the **Engine** section of [DECISIONS.md](./DECISIONS.md#engine).

## What it is

Each Maia is a policy network: one forward pass over a position, a probability for every legal
move, and no search. Upstream's own recipe for Maia-1 is `go nodes 1`, a single node. That is the
whole point — the move it picks is the one a human of that level would pick, including the
inaccuracies. It is an opponent, not an analyst: no depth, no principal variation, and the value it
returns is a predicted game outcome, not an evaluation of the position.

## The generations

|         | Maia-1                     | Maia-2                                    | Maia-3                        |
| ------- | -------------------------- | ----------------------------------------- | ----------------------------- |
| Paper   | KDD 2020                   | NeurIPS 2024                              | ICLR 2026, Chessformer        |
| Ratings | 1100–1900, one net by 100  | buckets 1100–2000, plus `<1100`, `>=2000` | 600–2600, continuous          |
| Models  | 9                          | 2 (rapid, blitz)                          | 4 (3M, 5M, 23M, 79M)          |
| Weights | Leela Chess `.pb.gz`       | PyTorch `.pt`                             | PyTorch `.pt`, state dict     |
| Size    | 1.2–1.3 MB each            | 267 MB each                               | 12.7 / 21.0 / 91.8 / 315.7 MB |
| Runtime | `lc0`                      | PyTorch                                   | PyTorch, or an ONNX export    |
| Licence | GPL-3.0                    | MIT                                       | AGPL-3.0                      |
| Source  | [CSSLab/maia-chess][maia1] | [CSSLab/maia2][maia2]                     | [CSSLab/maia3][maia3]         |

The Maia-3 checkpoints are float32: 21 MB for 5 million parameters is four bytes each. Half precision
halves them, and quantisation smaller still; the platform's own export is half precision, so the
sizes above are an upper bound rather than the cost.

### Maia-1

Nine independent nets, one per 100 Elo from 1100 to 1900, released in January 2021. The weights are
Leela Chess Zero networks, so they need a body: `lc0` loads them and plays a single node. Upstream
notes that the nets are stronger than their label, because they play the average move of that
rating rather than its worst.

The browser route is [lc0.js][lc0js], a GPL-3.0 Emscripten port that evaluates through TensorFlow.js.
It has not moved since April 2024, and Leela lists a WebAssembly backend among its open 2026
projects. Relying on it means depending on a dormant third party for the only piece that cannot be
written quickly.

### Maia-2

One net per time control instead of one per rating: the Elo is an input, bucketed by 100 from 1100
to 2000, with a bucket below and a bucket above. It is MIT, the most permissive of the three, and
its architecture is a convolutional stack feeding two small transformer blocks.

Its two checkpoints weigh 267 MB each and are served from Google Drive, with the SHA-256 written in
the source. A Google Drive file is not a stable, pinned artefact: it can be replaced or rate
limited, so vendoring it means trusting a checksum and a link that upstream does not version.

### Maia-3

The current generation, a Chessformer: an encoder over 64 square tokens, a 4352-move policy head
over the move space, and a win/draw/loss head. The rating is a continuous input, interpolated
between two learned embeddings from 0 to 5000; the model was trained on 20 bins of 100 from 600 to
2600 plus one below and one above. It also reads the eight previous positions, so it distinguishes a
move played in a fresh position from the same move after a long manoeuvre.

The 79M model reaches 57.1% move-matching accuracy, against 55.9% for the previous state of the
art, a 355M model with search. Upstream recommends the 5M for a first try on a CPU, and the 3M is
the ablation size kept for the paper, not a recommended model.

The browser route exists and is official: the Maia platform frontend runs a Maia-3 ONNX export in a
Web Worker with `onnxruntime-web` and caches it in IndexedDB. Its model is the 23M in float16, at
45.7 MB, plus about 12 MB of WebAssembly runtime. That export takes a single position, not the eight
of the Python engine, and keeps the policy and the WDL heads; its quality is therefore not the
published 57.1%, which belongs to the full model.

An unofficial `maia3-js` package also wraps the inference on npm, with one maintainer and no
repository field: not something to hang the engine on.

## Licence

The three generations are compatible with our AGPL-3.0-or-later, for different reasons:

- **Maia-2 is MIT.** Nothing to do beyond the attribution.
- **Maia-3 is AGPL-3.0.** Our licence is `or-later`, so it already covers the 3.0 terms.
- **Maia-1 is GPL-3.0.** AGPL-3.0 section 13 lets us link and convey it as part of an AGPL program;
  the Maia-1 part then stays under GPL-3.0, which our AGPL accepts.

The licence files are unambiguous: `LICENSE` of `maia-chess` is the GNU GPL version 3,
`LICENSE` of `maia2` is the MIT licence, `LICENSE` of `maia3` is the GNU AGPL version 3 and its
`pyproject.toml` points at it.

One ambiguity remains, on the Maia-3 weights rather than the code. The model card of the 79M says
"License: AGPLv3"; the cards of the 3M, 5M and 23M say "License: CC BY 4.0 (paper); see repo for
code/weights license" and point at the AGPL repository. Reading the weights as AGPL-3.0 is the
prudent reading, and it is the one to confirm with upstream before shipping the 5M.

Shipping weights under AGPL-3.0 obliges us to pass their licence on with them, and to name where they
come from. In practice, in line with the piece set of [CREDITS.md](../CREDITS.md):

- the licence text sits beside the weights, as `public/pieces/chessnut` does;
- `CREDITS.md` names the model, the pinned upstream checkpoint and its SHA-256;
- the weights stay under their own licence, which the AGPL of the app does not replace.

An ONNX conversion we produce ourselves from a pinned checkpoint is a derivative of it: same
licence, by prudence. Distributing somebody else's export, as the platform's 45.7 MB file is,
carries no licence statement of its own, which is a second reason to convert from the `.pt`.

## Behind the engine interface

The interface ships in [`src/engine/uci.ts`](../src/engine/uci.ts):

```ts
interface Engine {
  bestMove(fen: string, request?: MoveRequest): Promise<string | null>;
  prepare(): Promise<void>;
  cancel(): void;
  stop(): void;
}
```

`MoveRequest` carries Stockfish's `skill` from 0 to 20 and a `movetimeMs`; `UciEngine` implements it
over an `EngineTransport` that speaks UCI text to a Worker. The game mode owns the level — an
approximate Elo, 1350 to 2850 in eleven steps — and the engine maps it to its own skill.

Maia does not meet that contract as it stands. Four points, in the order they bite:

**The strength is not a skill.** The interface takes Stockfish's 0 to 20, while Maia-3 wants a
rating, continuously. The mode would have to pass its Elo and let each engine map it; the mapping is
not comparable — a "1350" of Skill 0 still calculates, while Maia at 1350 plays the average move of
a Lichess player of that rating, and the slider's top, 2850, is beyond the 2600 the model was
trained to.

**The position has no history.** `bestMove` takes a FEN. Maia-3 reads the eight positions before
it, which changes its answer after a long manoeuvre; the interface has nowhere to put them. Either
it takes the move list, or Maia plays without the history it was trained with, and that is a quality
question, not a detail.

**The move is chosen, not sampled.** A UCI engine under `go nodes 1` returns one move, and at
`Temperature 0` a Maia returns the same one every time — upstream works around that with opening
books for its Lichess bots. A sampled opponent needs a temperature, a nucleus and a seed for a
replayable game, which is a second thing the contract has no room for.

**There is no thinking time.** `movetimeMs` tunes a search that a Maia does not perform: one forward
pass, about 86 ms measured below. The field is meaningless for it, and a mode that waits for it would
wait for nothing.

Two shapes are possible, and the choice belongs to the implementation: a `UciEngine` over a worker
that wraps the ONNX model and answers `bestmove` — upstream's own Python wrapper is a UCI engine, so
the shape exists — or a second implementation of `Engine` whose transport is messages rather than
UCI text, reusing `prepare`, `cancel` and `stop`. Either keeps the scope narrow: Maia plays the
games, while the endgames need a result the app can trust and the analysis needs the best moves and
the blunders, which are Stockfish's.

Widening `Engine` touches the shipped play and hint paths, so it is a decision for the owner, taken
when Maia is actually built — not something a document settles.

## Offline

The weights ship in the image either way, so the question is not where they live but when the browser
reads them.

- **In the service worker's precache**: offline from the first launch, at the cost of the install
  size. `globPatterns` in [vite.config.ts](../vite.config.ts) already carries `.gz` and `.wasm`, so a
  model dropped in `public/` joins it as soon as `.onnx` is added to the list.
- **Fetched from the origin at first play, then cached in IndexedDB**, as the Maia platform does. The
  install stays light and the opponent arrives after a download. The app already works this way: the
  puzzle archive is fetched from its own origin on first use
  ([`content.ts`](../src/features/puzzles/content.ts)), which the rule allows and `connect-src 'self'`
  already covers.

The second suits 45 MB of weights; the first wants a model small enough not to weigh on every
install. The sizes that matter:

| Weights           | float32  | float16             |
| ----------------- | -------- | ------------------- |
| Maia-3 5M         | 21.0 MB  | about 10.5 MB       |
| Maia-3 23M        | 91.8 MB  | 45.7 MB, as shipped |
| Maia-3 79M        | 315.7 MB | about 158 MB        |
| Maia-1, nine nets | 11.4 MB  | —                   |

The runtime adds about 12 MB of WebAssembly whatever the weights weigh, 14.2 MB in
`onnxruntime-web` 1.31. The smallest honest option is therefore about 25 MB added to the image; only
the precache carries it into the install.

Two constraints remain, and the first is already met:

- **WebAssembly compiles.** `script-src 'self' 'wasm-unsafe-eval'` is in [nginx.conf](../nginx.conf)
  since the engine landed, with a comment saying it does not allow JavaScript `eval`. Stockfish runs
  under it; `onnxruntime-web` has not been tried there yet, as _Not measured yet_ says. The header
  itself needs nothing.
- **The threaded runtime wants `SharedArrayBuffer`.** The official platform ships the `simd-threaded`
  build and serves its whole site with `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`. We already send the first and not the second; adding
  COEP constrains every resource and every embed. A single-threaded runtime avoids it, at a latency
  cost that has to be measured before choosing.

Memory and start-up are the fixed cost of any runtime: the Wasm module has to be compiled, the
weights parsed, and a session created, once per page load. On a phone that is seconds, not
milliseconds, and it is the figure to measure first.

A first measurement, on the platform's export under `onnxruntime-web` 1.31 in Node with one thread,
on a desktop x86:

| Step                               | Time                   |
| ---------------------------------- | ---------------------- |
| Load the model, create the session | 1.1 s                  |
| One inference, median of 25        | 86 ms, 123 ms at worst |

A phone is several times slower and Node is not a browser, so this sizes the risk rather than
settles it. It does say that one inference fits comfortably in the time a human takes to move, and
that the load, not the move, is the cost the user will notice.

## Recommendation

Maia-3, 5M in float16, converted from the pinned upstream checkpoint into ONNX by our own script,
run in a Worker behind a widened `Engine`. It is the only generation with an official browser path,
the only one that covers 600 to 2600 with a continuous strength, and about 10 MB is a twentieth of
Maia-2's 267 MB.

It stays a recommendation until five things are settled:

1. the licence of the 5M weights, confirmed with upstream (see above);
2. the widening of `Engine` — a rating, a move history and a sampler — against the play and hint
   paths it already serves;
3. the latency of one inference on the target phone with a single-threaded runtime, and whether the
   threaded build is worth COEP;
4. precache or IndexedDB, and the parse time of the weights at start-up;
5. the quality of our own ONNX export: the published accuracy belongs to the model with its eight
   positions of history, and an export that drops them has to be compared on a sample of positions.

Fallbacks, in order: the 23M if the 5M is too weak in play, the 3M if the 5M is too slow. Maia-2 is
out for its size and its Google Drive hosting; Maia-1 only if the image size dominates everything
else, and then with the `lc0.js` risk above.

## Not measured yet

- One inference on a phone, single-threaded and threaded.
- The play strength of a Maia-3 ONNX export without the eight positions of history.
- `onnxruntime-web` under our CSP: Stockfish already compiles with `'wasm-unsafe-eval'` and no COEP,
  but the ONNX runtime has not been run there.
- The 5M and the 23M once we convert them ourselves: the figures above come from the platform's
  export of the 23M, not from ours.

## Sources

- Maia-1: <https://github.com/CSSLab/maia-chess>, release v1.0, 14 January 2021.
- Maia-2: <https://github.com/CSSLab/maia2>, arXiv 2409.20553.
- Maia-3: <https://github.com/CSSLab/maia3>, arXiv 2605.19091, checkpoints on
  <https://huggingface.co/UofTCSSLab/maia3>.
- Browser reference: <https://github.com/csslab/maia-platform-frontend>.

[maia1]: https://github.com/CSSLab/maia-chess
[maia2]: https://github.com/CSSLab/maia2
[maia3]: https://github.com/CSSLab/maia3
[lc0js]: https://github.com/frpays/lc0-js
