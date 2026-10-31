# Credits

## Chessnut piece set

Copyright 2019 [Alexis Luengas](https://github.com/LexLuengas).

Licensed under the Apache License, Version 2.0. The files are in
[`public/pieces/chessnut`](./public/pieces/chessnut), with a copy of the licence beside them.

Source: <https://github.com/LexLuengas/chessnut-pieces>, as distributed by
[Lichess](https://github.com/lichess-org/lila/tree/master/public/piece/chessnut). The SVG files are
copied unmodified.

## Lichess puzzle database

The puzzles in [`content/puzzles.jsonl.gz`](./content/puzzles.jsonl.gz) come from the public
[Lichess puzzle database](https://database.lichess.org/#puzzles), released by
[Lichess](https://lichess.org) under the
[Creative Commons CC0 license](https://creativecommons.org/publicdomain/zero/1.0/). The subset is
filtered, re-shaped and compressed by [`scripts/build-puzzles.ts`](./scripts/build-puzzles.ts);
`content/manifest.json` records the export it was taken from and its checksum.

The app is licensed under the [AGPL-3.0-or-later](./LICENSE), which covers the code but neither the
piece set nor the puzzle data.
