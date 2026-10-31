# Install

Requirements: [Node.js 26](https://nodejs.org/) and [pnpm](https://pnpm.io/) 12. Docker and `kubectl`
only for the image and the deployment.

## Development

```sh
pnpm install
pnpm dev
```

The app is served on **http://localhost:5173**, with hot reload. The service worker is disabled in
development, so a reload always shows the current code.

| Command         | What it does                     |
| --------------- | -------------------------------- |
| `pnpm dev`      | Vite dev server                  |
| `pnpm build`    | Typecheck, then build `dist/`    |
| `pnpm preview`  | Serve `dist/` on port 4173       |
| `pnpm check`    | Prettier, ESLint and types       |
| `pnpm test`     | Unit tests                       |
| `pnpm coverage` | Unit tests with coverage         |
| `pnpm format`   | Rewrite every file with Prettier |

The icons of the PWA are committed. To regenerate them after a change to the pawn:

```sh
python3 scripts/icons.py   # needs Pillow
```

## Image

```sh
docker build -t gambit .
docker run --rm -p 8080:8080 gambit
```

Then open **http://localhost:8080**. The container runs as UID 101, listens on 8080, and keeps its
temporary files on a writable `/tmp`; the rest of the filesystem can stay read-only.

`Release` builds `linux/amd64` and `linux/arm64` and pushes `ghcr.io/lesloi/gambit` with the `sha`
of the commit and `latest` on `main`, after `Check` and `Web` have passed. Nothing is published
from a pull request.

## Content

The puzzle subset, the opening lines and the endgame positions are shipped in the image, and the
puzzle subset is committed in `content/`: a clone, a build and a release work without network
access. Regenerating it is a deliberate, offline act: the script reads a dated Lichess export
(CC0), writes `content/`, and the next release rebuilds the image. The manifest records the date
of the export it came from. Nothing is fetched at runtime.
