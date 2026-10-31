# Gambit

A personal chess training app: puzzles, tactical motifs, endgames, openings and games against
the engine. Free of accounts and tracking, installable, and usable offline.

**Status: foundation.** The deployment pipeline is in place and the puzzle trainer runs on the
committed Lichess subset. The other training modes are being built, in the order of the issues.

## Features

| Mode     | What it does                                                          | State   |
| -------- | --------------------------------------------------------------------- | ------- |
| Puzzles  | Real positions from the Lichess puzzle set, by length and difficulty  | Ready   |
| Endgames | Classic positions, playable against the engine                        | Planned |
| Openings | A curated repertoire for both colours, revised with spaced repetition | Planned |
| Games    | Play Stockfish at a chosen level, then review the blunders            | Planned |

The home screen, the installable app, the offline shell and the puzzle trainer are available now.

## How it works

- A **static PWA**: Vite, React and TypeScript, no server and no account.
- The **progression lives in IndexedDB**; a backup is a JSON file you export.
- **Content ships with the app**: a filtered subset of the public Lichess puzzle database, the
  opening lines and the endgame positions.
- **Stockfish runs in the browser**, as a WebAssembly worker, so no move leaves the device.
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
games and your settings stay in the browser, and only a backup you export takes them out.

## Licence

[AGPL-3.0-or-later](./LICENSE). The Chessnut piece set keeps its own licence, Apache 2.0; see
[CREDITS.md](./CREDITS.md).
