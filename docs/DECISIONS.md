# Decisions

Lasting choices and the reason behind each. They can be questioned: if one no longer holds,
propose another with your arguments, then rewrite the entry. Git keeps the history.

## Product

- **A static PWA, not an app with a backend.** Practice is local by nature: a puzzle, a position
  and a game are played on the device, and the engine runs there too. A backend would add an
  account, a copy of the progression and a privacy surface for no feature the user asks for. The
  delivered artefact is one nginx image serving the build.
- **The shell and the puzzle archive are precached, and a deploy waits for the user.** The service
  worker caches the build and the archive, so a cold start works offline after the first launch.
  It never reloads itself: a new worker stays waiting and a banner offers "Recharger" or "Plus
  tard", the latter applying the update at the next cold start. The check runs when the app
  returns to the foreground, not on a timer, so an idle app makes no request. A browser may evict
  the cache under storage pressure; the app then falls back to the network and the loader's retry.
- **French only, English code.** The owner practises in French, and a second language is a cost on
  every string and every test. Strings live in `src/i18n/fr.ts`, so adding one later is a file and
  a type, not a rewrite.
- **Mobile first.** Training happens on a phone, often in a short break: the layout, the board and
  the touch targets are designed at 360 px, then widened. The desktop layout adds room, never
  features that the phone lacks.
- **Four modes, not five: a motif is not a mode.** The puzzles already carry their themes; a
  separate mode would add a route, a card and a content pipeline for the same data. The motif is
  shown after the solve, when it teaches something; the screen narrows by length and by rating
  instead, the two measures that say what an exercise costs and how hard other players found it.
- **Calculation is trained by committing the whole line.** A normal puzzle reveals the opponent's
  reply after each move, so it trains recognition, not depth. An option of the puzzle mode lets the
  user enter both sides' moves with no feedback, then checks the sequence and stops at the first
  divergence, which is the metric: the depth in plies. It only serves positions whose defensive
  plies are genuinely forced, precomputed by the content pipeline; the Lichess database has no such
  flag, and rejecting a winning alternative would teach the wrong lesson.
- **A session starts with what is due, then a few new cards.** Without that rule the first weeks
  are random: FSRS has nothing to schedule yet. The session takes the due cards, then N new ones
  (five by default, adjustable), so the habit has something to do from the first day. It
  interleaves the modes, so a sitting is not a pile of puzzles.
- **A puzzle card is a motif at a rating band, not a position.** A due cell serves an unseen
  position of that motif and band, never the same board twice: re-solving a seen puzzle trains
  memory, not calculation. The cell's state is the replay of the attempts of the positions it
  served, and each puzzle belongs to its primary motif (the rarest, as the content pipeline counts
  it). New cells come from the band the user picks on the session card (low by default); the due
  cells follow the journal whatever band they hold. The free puzzle screen and the mistakes list
  stay the places to replay a position on purpose.
- **A session is computed, never stored as a list.** The queue is derived again from the journal
  pinned at the session's start (its last review id); only a cursor of scalars in localStorage
  (start, pin, position, N, band, totals) survives a reload. A review written during the session
  does not reshape the queue, and reloading lands on the same card.
- **A theme's statistics wait for ten reviews.** At one user, a cell below that is noise, and a
  discouraging one. The journal keeps everything; the screen only shows what means something.
- **Difficulty is two measures, one of them named.** The length in plies says what an exercise
  costs and what it trains: the full-line drill counts depth, and a five-move puzzle is a
  different exercise from a one-move one. The rating says how often other players solved it, and
  stays the cold-start prior a single user cannot have on the first day; the picker names it,
  easy, medium, hard or expert, and keeps the number beside the name. A beginner reads "hard"
  where an Elo says nothing, and a regular still finds the figure they know. The cuts sit at
  1200, 1600 and 2000, which give three bands of about 3,400 puzzles over the archive's 800–2200
  and a smaller expert band. The journal takes over as soon as a cell holds the reviews the
  statistics already wait for: the session then follows the user's own record by motif and by
  depth. Folding the length into the same name would lose what it says, so the two stay apart.
- **A solved attempt is good, hard when a hint helped; the only rating left to the user is
  "again".** FSRS wants a grade, and the outcome already says whether a puzzle, an endgame or a
  line was solved: the four Anki buttons mostly collect the same "good" for a second decision
  after every solve. A solve is written `good` when the attempt is left, and one button writes
  `again` instead; a miss writes `again` when it happens. A puzzle attempt that asked for a hint —
  its sentence or its piece — writes `hard`, and so does an endgame attempt that revealed its plan
  or the engine's move: the solve still happened, and a lapse would say the position was
  forgotten. So does a replay after a failure or a revealed line, whose answer the band or the
  sheet just showed. The opening trainer has no hint and keeps writing `good`. A refused
  `good` keeps the screen open for another tap, but a refused miss is not retried, so a back, a
  tab close or an abandonment after a refusal loses the review — the alternative, writing `good`
  at once, would append a second entry when the user demoted it.
- **An endgame's hint is its plan before the engine's move.** The technique is the lesson, and a
  best move alone does not teach it: the first press shows the plan written for that position, the
  second the engine's move at full strength. Reading only the plan already costs the `good` grade,
  because the plan is the answer. The plan is content, required for every entry like an opening's
  note, so a missing one cannot silently drop the teaching from a card.
- **A game has no takeback; a hint marks it as assisted.** Takeback erases the blunder the
  analysis exists to show. A hint is allowed, but the game is marked as assisted and stays out of
  the blunder list. The score sheet reopens any past position read-only, and the clock keeps
  running: reviewing is not a pause.
- **A game follows FIDE's automatic draw limits, with a material check on the flag.** The game
  ends at the automatic fivefold repetition and 75-move limits (9.6), not at the claimable
  threefold and 50-move ones (9.2/9.3), because the app offers no claim. A flag falls drawn when
  the side that still had time cannot mate (6.9), judged on its own material with the FIDE table:
  a bare king, a lone bishop or knight, or bishops all on one colour cannot mate on their own,
  while two knights do count, because the literal rule allows a helpmate against a bare king.
  This is a table, not a search: a lone bishop or knight may still mate under the literal rule
  when the opponent's pieces block, so king and knight against king and knight is a draw here
  where the literal rule would give the win to the side with time.
- **A game can start from a position, and it can be untimed.** The start FEN is the game's whole
  history: the analysis and the move numbers come from it, and a position one move from the
  75-move draw can end there. An untimed game has no clock to flag; the play mode offers it as a
  time control, and the draft and the row say so.
- **A puzzle's final position can be played, and the game is not a review.** After a solve or a
  revealed solution, when the rules do not already end the position, the puzzle screen, the session
  and the mistakes list offer to continue from it. The user plays the side that solved; the game is untimed, stored and analysed
  from its start FEN like any other. It writes no review — the puzzle's review is the only journal
  entry — and does not feed FSRS. No new mode, no card. The start position's Stockfish evaluation
  is shown from the user's side; the end verdict compares it with the result.
- **The app calls no third party at runtime.** No tablebase, no opening explorer, no CDN, no font
  service: every byte it shows comes from the image, and the CSP allows `'self'` only, plus
  `'wasm-unsafe-eval'` so the bundled Stockfish can compile. Reading that image is not a call out:
  the puzzle archive is fetched from the app's own origin and decompressed in the browser, so the
  2 MB of JSONL stay out of the JS bundle. A proxy for a third party would hide the user's IP but
  adds a request path and a cache to operate; a direct call would put a third party in the privacy
  policy. Neither buys a feature the content cannot ship. Revisit only for a mode that cannot exist
  offline.

## Content

- **Puzzles come from the public Lichess database, filtered and baked into the image.** The
  random-puzzle endpoints need an OAuth token, and a login contradicts "no account". A subset of
  about 12,000 puzzles keeps the image small, works offline from the first launch, and can be
  regenerated by `scripts/` from a dated export. The filter keeps a rating band, a minimum of
  plays and popularity, and a spread of themes and ratings; the exact rules live in the script
  header. **The generated subset is committed with the code**, so a clone, a build and a release
  never reach Lichess; only a regeneration does, from a CC0 export whose date the manifest
  records. Lichess is a source of content, not a service the app depends on.
- **A puzzle has one answer, and the build proves it.** The Lichess export is generated on that
  rule but ships no proof, and about a fifth of the retained lines have a defensive ply where the
  engine would choose another move, so the app would play a scripted opponent rather than the best
  defence. A pass over the subset replays every line with a native Stockfish, off the runtime: at
  each user ply the expected move must be the engine's first choice and the second must fall behind
  by a mate or by 100 cp; a one-move mate is accepted as the app accepts any mate. A line that fails
  is dropped and the selection refills it, so answering "wrong" to a move that also wins never
  happens. At each defensive ply the stored reply is checked the same way, but it does not drop the
  line: a defence the engine would not choose only clears the puzzle's `fullLine` index, because
  the normal mode plays the stored move and only the full-line drill needs a forced one. Dropping
  every such line would cost a fifth of the content for no normal-mode benefit, and leave the
  drill's index with nothing to filter. The engine, its version and the analysis settings go into
  the manifest, so a regeneration is reproducible like the export itself; the exact margins live in
  the header of the script that verifies. The binary is a build tool, never a runtime dependency or
  a file in the image.
- **The opening repertoire is curated, not imported.** A hand-written set of lines for both
  colours (London and Queen's Gambit with White, French and Slav with Black) is small, coherent
  and reviewable. An opening explorer would grow an unbounded tree the user has to prune by hand.
  The trainer plays a line back move by move: the app answers for the opponent, and a move outside
  the line stops the attempt, because a line is a card, not a search for any playable move. That
  move is written to the journal at once; a rewind then puts the board back before it, so the rest
  of the line can be practised without re-reciting the start. The rewind corrects the attempt, not
  the record: the `again` review stands, and a line finished afterwards adds none, since the miss
  is that attempt's review.
- **Endgames are a fixed set of classic positions.** The expected result (win or draw) is part of
  the content, Stockfish plays the opponent, and the app checks the conversion locally. No
  tablebase call: a local Syzygy set would add gigabytes, and the remote one would be the only
  network request of the app.
- **No import of the user's own PGN or FEN.** The owner asked to train on known material, not to
  manage a personal database. Revisit only if a mode needs the user's games.

## Engine

- **Stockfish, single-threaded WebAssembly, in a Worker.** Multi-threaded Stockfish needs
  `SharedArrayBuffer`, so COOP and COEP headers, which complicate the CSP and every embed. The
  single-threaded build plays strong enough at every level the trainer offers, and the app stays a
  plain static site.
- **The games are played by Maia; Stockfish keeps the verdict.** Maia predicts the move a player of
  the chosen rating would play and does not search, which is a better partner than an engine bridged
  to a weaker level; a hint and a review need a best move and a score, which it cannot give. Its
  level also sets a pause before the move, because a model that does not search answers in
  milliseconds and would never spend its clock.
- **The Maia weights come from the AGPL-3.0 repository, and the export that ships is ours.** The
  model card says "CC BY 4.0 (paper); see repo for code/weights license": the article is CC BY, the
  weights are deferred to the repository, whose licence is AGPL-3.0. They live outside the
  repository, so the credit pins the checkpoint revision and its SHA-256, and the ONNX is converted
  from it by `scripts/export-maia.py` rather than taken from another project's build. The 5M model
  is the one kept: 25 to 57 ms an answer in the browser, against 86 ms for the Maia platform's 23M
  export measured the same way; the larger models were not measured.

## Persistence

- **The `reviews` journal is the source of truth; FSRS state is derived from it.** A review is
  appended and never edited. The statistics, the due dates and an undo are then computations. The
  scheduler is therefore pinned with its parameters, fuzzing is off, and the short steps (1 min,
  10 min) are kept: replaying the same journal must give the same due date, and the scheduler that
  produced it is written in the database's `meta` table. The 21 FSRS-6 weights are the exception,
  left to the package's defaults: pinning a copy would freeze a tuning the library keeps refining,
  and the journal records the build that wrote each review. A bump of the defaults moves every due
  date, and the golden test in `fsrs.test.ts` fails on it: `pnpm test` is the gate, before the
  build ships.
- **A finished game is stored as its move list, not a PGN.** The analysis will replay it from its
  start position; a PGN string would need parsing and would freeze the notation. The row and the
  draft carry the start FEN and whether the game is clocked; the analysis and the move numbers come
  from the FEN, and the halfmove clock and the repetition count start there, not at a line the
  position was reached by. Old rows and drafts default to the initial position and a clock. An
  abandoned game is not stored: only a game that reached a result is worth analysing.
- **An unfinished game is a draft in localStorage, not a row in `games`.** It is rewritten after
  every move and on the way out, with the time left frozen at that instant, so a reload, a
  navigation or a closed tab resumes the same position without charging the absence; the clock
  starts again once the engine is ready. The draft carries the start FEN and the clock choice, so a
  reload resumes the same board. The finished game is then written once, with the start time the
  draft carried. The draft is small, synchronous to write as the page closes and ephemeral, so it
  stays out of IndexedDB like the session cursor; two tabs share one draft and the last writer
  wins.
- **Storage is not made persistent.** `navigator.storage.persist()` would ask for a permission the
  app does not need on first load.
- **IndexedDB, through Dexie.** The data is structured and can exceed the few megabytes of
  `localStorage`; Dexie gives a versioned schema and transactions without a custom layer.

## Interface

- **The theme is "Papier & bois"**: cream paper, wood board, a serif for titles and a terracotta
  accent. Tokens live in `src/styles/index.css`; no colour, size or spacing outside them.
- **The board is chessground.** It is the board of Lichess, handles drag and tap, promotions and
  coordinates, and it is accessible enough to build on. css only, no framework.
- **Accessibility is WCAG 2.2 AA.** Touch targets of 44 px, keyboard play, visible focus, state
  exposed to assistive technology, and no animation under `prefers-reduced-motion`. A board is
  hard to use blind; the app still names every piece and every move.

## Testing

- **Vitest for logic; Playwright for flows once there are flows.** A pure function, a scheduler or
  a content loader is tested directly. A screen is not unit-tested: its behaviour is covered by an
  end-to-end test of the path a user takes.
- **No coverage threshold yet.** It will be set with the first feature, when the tested surface
  means something. A threshold on a shell tests the shell.
