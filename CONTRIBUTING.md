# Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/lesloi/gambit).

## Getting started

- [INSTALL.md](./docs/INSTALL.md) starts the app, builds the image and deploys it.
- [GLOSSARY.md](./GLOSSARY.md) holds the vocabulary to use in code and comments.
- [DECISIONS.md](./docs/DECISIONS.md) explains the lasting choices; you can question one with an
  issue.
- [DESIGN.md](./docs/DESIGN.md) guides the interface.

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Vite dev server on port 5173                  |
| `npm run build`    | Typecheck, then build `dist/`                 |
| `npm run check`    | Prettier, ESLint and types (workflow `Check`) |
| `npm test`         | Unit tests (workflow `Web`)                   |
| `npm run coverage` | Unit tests with coverage                      |
| `npm run format`   | Rewrite every file with Prettier              |

`npm run content:puzzles` regenerates the puzzle subset; see [content/README.md](./content/README.md).

## Privacy-first rules

A pull request that breaks these rules is not merged. If a feature seems to need an exception,
open an issue before implementing it.

- The progression, the games and the settings stay on the device. There is no account, no server
  and no analytics.
- The app makes **no network request at runtime**: no analytics, no CDN, no engine call, no
  tablebase. A feature that would send anything needs the maintainer's approval, and the CSP must
  name the host.
- Self-host every script, stylesheet and font. No CDN.
- Serve every page with `Referrer-Policy: no-referrer`; the header is in `nginx.conf`.
- Ask nothing of the user that the feature does not need: no geolocation, no notification, no
  permission on first load.

## Conventions

Prettier, ESLint and TypeScript enforce the style; follow the neighbouring code for the rest.

- TypeScript strict. Data from outside (`IndexedDB`, a backup file, a content file) is `unknown`
  until a small type guard has parsed it, field by field, each with its default.
- Every user-facing string lives in `src/i18n/fr.ts`; no literal text in a component.
- Units: an Elo is an Elo, a duration is in milliseconds in the data and formatted in the
  interface. Say the unit in the name when it is not obvious.
- Comments explain why, not what. A lasting choice points to its section of
  [DECISIONS.md](./docs/DECISIONS.md).
- Components come before copies: look in `src/ui` and in the feature next door before drawing
  anything.
- Tailwind classes use the tokens of `src/styles/index.css`; no arbitrary colour.
- A dependency is added only when the standard platform cannot do the job, and it is justified in
  the pull request.

## Tests

- Every change comes with unit tests that call functions directly. A flow gets an end-to-end test
  once Playwright is set up; edge cases stay in unit tests.
- Write the test first, watch it fail, then write the minimum code, then refactor.
- A test follows Arrange–Act–Assert and is named by the behaviour it protects, not by the function
  it calls.
- Do not unit-test design or layout.

## Commits and branches

- Branches: `type/short-description` (`feature`, `bugfix`, `hotfix`, `release`, `chore`).
- Commits: Conventional Commits under 72 characters, imperative, no `Co-authored-by:`.
- Do not push, open a pull request or deploy without the maintainer's go-ahead.

## Licensing of contributions

By contributing, you agree to license your contribution under the
[AGPL-3.0-or-later](./LICENSE), like the rest of the project.
