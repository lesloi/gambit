# Maia

Maia is a family of chess models that predict the move a player of a given rating would play,
rather than the best move. It is the intended opponent of the game mode. This document records
what was verified on 31 October 2026, before any code; the lasting choice lives in the **Engine**
section of [DECISIONS.md](./DECISIONS.md#engine).

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

The engine interface is written with the game mode, not here. Maia constrains it in four ways.

**The contract is a move, not a best move.** Both providers answer "which move does this side play
in this position", and nothing more; a mode that needs an evaluation or a principal variation keeps
using Stockfish directly. Stockfish's `bestmove`, `info depth` and `pv` must not leak into the
interface, or Maia cannot implement it.

**The strength is an Elo, and it is continuous for Maia-3.** The level the user sets is already an
approximate Elo in [GLOSSARY.md](../GLOSSARY.md), so the interface takes one. Stockfish maps it to
its own skill level; Maia feeds it to the network.

**The move is sampled, not chosen.** At `Temperature 0` a Maia plays the same game every time, which
upstream works around with opening books for its Lichess bots. The sampler — a temperature, a
nucleus, a fixed seed for a replayable game — belongs to the interface, and both providers
implement it their own way.

**The position carries a history.** Maia-3 reads up to eight previous positions; Stockfish needs
one. The interface takes the move list and lets a provider use as much of it as it wants.

The scope stays narrow: Maia plays the games. The endgames need a result the app can trust, and the
post-game analysis needs the best moves and the blunders — that is Stockfish, and the
[DECISIONS.md](./DECISIONS.md#engine) entry on it does not change.

## Offline

The weights have to be on the device before the first game, and there are two ways to get them:

- **Baked into the image**, like the puzzle subset. Costs the size of the model on every pull of
  the image, and nothing at runtime.
- **Downloaded once and cached in IndexedDB**, as the Maia platform does. It is a network request at
  runtime: it needs the owner's agreement, the host in the `Content-Security-Policy`, and it leaves
  the first launch without an opponent on a cold cache.

Only the first is compliant with the rule as it stands. The sizes that matter:

| Weights           | float32  | float16             |
| ----------------- | -------- | ------------------- |
| Maia-3 5M         | 21.0 MB  | about 10.5 MB       |
| Maia-3 23M        | 91.8 MB  | 45.7 MB, as shipped |
| Maia-3 79M        | 315.7 MB | about 158 MB        |
| Maia-1, nine nets | 11.4 MB  | —                   |

The runtime adds about 12 MB of WebAssembly whatever the weights weigh, 14.2 MB in
`onnxruntime-web` 1.31. The smallest honest option is therefore about 25 MB in the image, weights
and runtime together, and as much again in the first install of the service worker.

Three consequences for the app as it stands:

- **WebAssembly needs a CSP token.** `script-src 'self'` in [nginx.conf](../nginx.conf) does not
  allow compiling a Wasm module; the header needs `'wasm-unsafe-eval'`. This applies to Stockfish
  as soon as the engine is wired, Maia or not.
- **The threaded runtime wants `SharedArrayBuffer`.** The official platform ships the
  `simd-threaded` build and serves the whole site with `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`. We already send the first and not the second; adding
  COEP constrains every resource and every embed. A single-threaded runtime avoids it, at a latency
  cost that has to be measured before choosing.
- **The service worker must ship the model.** `globPatterns` in [vite.config.ts](../vite.config.ts)
  precaches JavaScript, CSS, HTML, SVG and PNG only: a model left in `public/` would not be offline
  after the first launch, and there is no fetch to warm it up. It belongs in the precache list, with
  its size in the install budget.

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
run in the same Worker pattern as Stockfish behind the engine interface. It is the only generation
with an official browser path, the only one that covers 600 to 2600 with a continuous strength, and
about 10 MB is a twentieth of Maia-2's 267 MB.

It stays a recommendation until four things are settled with the game mode:

1. the licence of the 5M weights, confirmed with upstream (see above);
2. the latency of one inference on the target phone with a single-threaded runtime, and whether the
   threaded build is worth COEP;
3. the size added to the service worker's install, and the parse time of the weights at start-up;
4. the quality of our own ONNX export: the published accuracy belongs to the model with its eight
   positions of history, and an export that drops them has to be compared on a sample of positions.

Fallbacks, in order: the 23M if the 5M is too weak in play, the 3M if the 5M is too slow. Maia-2 is
out for its size and its Google Drive hosting; Maia-1 only if the image size dominates everything
else, and then with the `lc0.js` risk above.

## Not measured yet

- One inference on a phone, single-threaded and threaded.
- The play strength of a Maia-3 ONNX export without the eight positions of history.
- The behaviour of `onnxruntime-web` under our CSP, with `'wasm-unsafe-eval'` and without COEP.
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
