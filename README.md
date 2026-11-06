<p align="center">
  <img src="public/favicon.svg" alt="Gambit logo" width="128" height="128">
</p>

<h1 align="center">Gambit</h1>

<h3 align="center">A personal chess training app. No account, no tracking.</h3>

<p align="center">
  Puzzles, tactical motifs, endgames, a curated opening repertoire and games against the engine.
  Installable and usable offline.
</p>

**Status: foundation.** The deployment pipeline is in place, the three trainers run on the
committed content and the game mode runs on the bundled engine.

## Features

| Mode     | What it does                                                          | State |
| -------- | --------------------------------------------------------------------- | ----- |
| Puzzles  | Real positions from the Lichess puzzle set, by length and difficulty  | Ready |
| Endgames | Classic positions, playable against the engine                        | Ready |
| Openings | A curated repertoire for both colours, revised with spaced repetition | Ready |
| Games    | Play Maia at a chosen level, on the clock                             | Ready |

The home screen, the installable app, the offline shell and the four modes are available now. A
finished game is stored and can be reviewed: Stockfish replays every move and marks the blunders
and the missed wins.

## How it works

- A **static PWA**: Vite, React and TypeScript, no server and no account.
- The **progression lives in IndexedDB**, on the device.
- **Content ships with the app**: a filtered subset of the public Lichess puzzle database, the
  opening lines and the endgame positions.
- **The engines run in the browser**: Stockfish, a WebAssembly worker, gives the hints, plays the
  other side in the endgames and reviews the games; Maia, an ONNX model, is the opponent. No move
  leaves the device.
- **No request to a third party at runtime**: the content is baked into the build, read from the
  app's own origin, and the Content-Security-Policy allows no external host.

## Getting started

Requires [Node.js 26](https://nodejs.org/) and [pnpm](https://pnpm.io/) 12.

```sh
pnpm install
pnpm dev
```

Then open **http://localhost:5173**.

```sh
pnpm build     # typecheck and build the static app into dist/
pnpm check     # formatting, lint, types
pnpm test      # unit tests
```

## Docker

The image is a static build served by nginx, published on GitHub Container Registry:

```sh
docker run --rm -p 8080:8080 ghcr.io/lesloi/gambit:latest
```

Then open **http://localhost:8080**. See [INSTALL.md](./docs/INSTALL.md) to build, publish or
deploy it.

## Documentation

- [INSTALL.md](./docs/INSTALL.md): development, image, deployment.
- [DECISIONS.md](./docs/DECISIONS.md): the lasting choices and why.
- [DESIGN.md](./docs/DESIGN.md): the interface and its tokens.
- [GLOSSARY.md](./GLOSSARY.md): the vocabulary of the project.
- [CONTRIBUTING.md](./CONTRIBUTING.md): commands and conventions.
- [AGENTS.md](./AGENTS.md): instructions for an AI agent working here.

## Privacy

No account, no analytics, no tracking, no cookie, and no request at all. Your progression, your
games and your settings stay in the browser.

## Licence

[AGPL-3.0-or-later](./LICENSE). The Chessnut pieces, Stockfish, Maia and ONNX Runtime keep their
own licences; see [CREDITS.md](./CREDITS.md).
