# Cursor Chess

Bite-sized tactical chess puzzles in your Cursor (or VS Code) sidebar, for the minutes while your agents work.

## Status

Phase 6 (agent notices) of 7. You get:

- An activity-bar icon and a **Puzzle** sidebar view.
- An interactive board (react-chessboard, with chess.js as the source of truth). It supports drag-and-drop and click-to-move, shows legal-move dots and capture rings, highlights the last move, glows the king when in check, and blocks illegal moves.
- Real puzzles from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0). The opponent's setup move is auto-played, the solutions are multi-move with automatic replies, and any checkmate is accepted on the final move.
- Wrong-move feedback with a retry that doesn't reveal the solution, plus Reset and Next.
- A promotion picker, so underpromotion puzzles work.
- A two-step Hint: the first press highlights the piece to move, and the second draws the move as an arrow.
- Reveal, which plays the rest of the solution move by move. A revealed puzzle counts as a miss and earns no XP.
- Check, checkmate, and stalemate messages, plus optional sound (off by default, toggled from the header).
- 246 curated Lichess puzzles across common tactics and every difficulty band. `scripts/curate-puzzles.mjs` regenerates them.
- Difficulty and theme filters (fork, pin, skewer, discovered attack, double check, deflection, back-rank mate, hanging piece, mate in 1, mate in 2). Your choice is saved, and puzzles don't repeat until every match has been shown. When nothing matches, you get a puzzle from the whole library and a note saying so.
- **Import Lichess Puzzles…** (Command Palette, the view's `…` menu, or "Import more" under the board). It can stream the Lichess database straight from database.lichess.org and stop as soon as it has enough, or read a `.csv` / `.csv.zst` you downloaded. You can import 1,000 or 5,000 puzzles, or 500 that match your current filters. Every row is checked by replaying it with chess.js.
- Imported puzzles are cached in the extension's global storage (up to 20,000) and work offline. **Remove Imported Puzzles…** clears them.
- A puzzle rating that starts at 1200 and moves like Elo against each puzzle's Lichess rating. It moves fastest over your first 10 rated puzzles and settles after 100. As on Lichess, a clean solve is a win, and the first mistake, hint, or reveal makes the attempt a loss. Each attempt is rated once, even if you reset it.
- XP for every solve. Harder puzzles earn more, and a clean solve earns a 50% bonus. Solving after a mistake still earns XP, but a reveal doesn't.
- A solve streak (clean solves in a row) and a daily streak (days in a row with at least one solve), each with your best.
- A **Progress** view, opened from the rating in the header. It shows your rating, band, and best rating; solved, accuracy, XP, and both streaks; a chart of your last 60 rated puzzles; your most-played themes with win rates; and recent attempts with rating changes and XP.
- Resume: an unfinished puzzle is saved as you play and restored, moves included, after you reload the window or restart the editor.
- Everything is stored in `globalState`, and the solved count from earlier versions carries over.
- **Settings**, from the gear in the header. Board colors (Sage, Walnut, Slate, Contrast), standard or letter pieces, sound, move animation, coordinates, and automatic next puzzle after a solve. Sound and the rest are remembered.
- **Agent notices.** Run **Cursor Chess: Enable Agent Notices…** once. It adds a small hook in `~/.cursor` that records when an agent starts and finishes, not your prompts. A gold dot and a status-bar item show while an agent is working. When it finishes, a quiet notice appears. If a puzzle is on screen, the notice waits, and the status bar stays on "Agent finished" until the puzzle is done.
- **Cursor Chess: Agent Finished** and **Mark Agent Working** do the same thing by hand, which is the fallback when a hook can't see the agent (cloud agents included). **Toggle Notifications** turns the notice off. **Show Statistics** opens the Progress view.
- A short glow around the board on a solve. Animations turn off when the system asks for reduced motion.
- Controls keep a name for screen readers when the sidebar is too narrow for labels, and the layout holds together down to about 280px wide.

The only network access is an import you start yourself. See the implementation plan for the roadmap: distribution.

## Install the VSIX

```bash
npm install
npm run package          # typecheck + tests + build + cursor-chess-<version>.vsix
```

Then in Cursor, open the Command Palette and run **Extensions: Install from VSIX…**, and pick the `.vsix` file. You can also run `cursor --install-extension cursor-chess-0.6.0.vsix`. Click the knight icon in the activity bar to open it.

## Develop

| Command | What it does |
|---|---|
| `npm run build` | Bundles the extension (esbuild → `dist/extension.js`) and the webview (Vite → `dist/webview/`) |
| `npm test` | Runs the Vitest unit tests (puzzle engine, sample data, filters, import, rating and progression, storage) |
| `npm run typecheck` | Runs strict TypeScript over everything |
| `npm run dev:webview` | Serves the UI in a browser at Vite's dev URL, with a built-in stand-in for the extension host |
| `npm run watch:webview` / `npm run watch:extension` | Rebuild on change |

Press **F5** in Cursor or VS Code ("Run Cursor Chess") to build and launch an Extension Development Host with the extension loaded.

## Layout

```
src/extension/   extension host: view provider (CSP + nonce), commands, storage, Lichess import
  providers/     PuzzleProvider interface, local provider, imported-puzzle cache, CSV parser, file/URL streaming
src/webview/     React UI: components/, hooks/usePuzzle.ts, services/chessService.ts (PuzzleSession)
src/shared/      types, message protocol, sample puzzles, PuzzleLibrary (filtering and selection), themes, rating and progression
scripts/         curate-puzzles.mjs, which rebuilds the bundled sample
test/            Vitest unit tests
media/icon.svg   activity-bar icon
```

Puzzle data: Lichess puzzle database, released under CC0.
