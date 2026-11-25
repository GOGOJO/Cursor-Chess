# Cursor Chess

Bite-sized tactical chess puzzles in the Cursor or VS Code sidebar, for the minutes while an agent works.

**[Install from Open VSX](https://open-vsx.org/extension/gogojo/cursor-chess).** In Cursor, open Extensions and search for **Cursor Chess**. Cursor installs extensions from Open VSX.

## While an agent works

1. Run **Cursor Chess: Enable Agent Notices…** once. It adds a small hook in `~/.cursor` that records when an agent starts and finishes. The hook does not read prompts.
2. **Open with the agent** is on by default. The puzzle sidebar opens when an agent starts and closes when that agent finishes. A board you already had open stays open. Closing the board yourself keeps it closed until the next agent. Turn this off in Settings.
3. A gold dot and a status-bar item show while an agent is working. When it finishes, a quiet notice appears. If a puzzle is on screen, the notice waits, and the status bar stays on "Agent finished" until the puzzle is done.

**Cursor Chess: Mark Agent Working** and **Cursor Chess: Agent Finished** do the same thing by hand. Use them when a hook cannot see the agent, including cloud agents. **Toggle Notifications** turns the notice off. **Show Statistics** opens the Progress view.

## Play

- Click the knight in the activity bar to open the **Puzzle** view.
- Drag a piece or click to move. The board shows legal-move dots and capture rings, highlights the last move, glows the king in check, and blocks illegal moves.
- Puzzles come from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0). The opponent's setup move plays itself. Solutions are multi-move, with automatic replies, and any checkmate is accepted on the final move.
- A wrong move can be retried without showing the solution. Reset and Next are always available.
- A promotion picker, so underpromotion puzzles work.
- Hint, in two steps: the first press highlights the piece, and the second draws the move as an arrow.
- Reveal plays the rest of the solution. A revealed puzzle counts as a miss and earns no XP.
- Check, checkmate, and stalemate messages. Sound is off until you turn it on from the header.
- 246 curated puzzles across common tactics and every difficulty band. `scripts/curate-puzzles.mjs` regenerates them.
- Difficulty and theme filters: fork, pin, skewer, discovered attack, double check, deflection, back-rank mate, hanging piece, mate in 1, and mate in 2. The choice is saved, and puzzles do not repeat until every match has been shown. When nothing matches, you get a puzzle from the whole library and a note saying so.

## Rating and progress

- Your rating starts at 1200 and moves like Elo against each puzzle's Lichess rating. It moves fastest over the first 10 rated puzzles and settles after 100. A clean solve is a win. The first mistake, hint, or reveal makes the attempt a loss. Each attempt is rated once, even if you reset it.
- XP for every solve. Harder puzzles earn more, and a clean solve earns 50% more. Solving after a mistake still earns XP. A reveal does not.
- A solve streak (clean solves in a row) and a daily streak (days in a row with at least one solve), each with a best.
- **Progress**, opened from the rating in the header: rating, band, and best rating; solved, accuracy, XP, and both streaks; a chart of the last 60 rated puzzles; most-played themes with win rates; and recent attempts with rating changes and XP.
- An unfinished puzzle is saved as you play and restored, moves included, after you reload the window or restart the editor.
- Progress is stored in the editor's `globalState`. A solved count from earlier versions carries over.

## More puzzles

**Import Lichess Puzzles…** is in the Command Palette, the view's `…` menu, and as "Import more" under the board. It can stream the Lichess database and stop as soon as it has enough, or read a `.csv` or `.csv.zst` you downloaded. Import 1,000 or 5,000 puzzles, or 500 that match the current filters. Every row is checked by replaying it with chess.js.

Imported puzzles are cached in the extension's storage, up to 20,000, and work offline. **Remove Imported Puzzles…** clears them.

The only network access is an import you start yourself.

## Settings

Open Settings from the gear in the header.

- Board colors: Sage, Walnut, Slate, Contrast.
- Standard or letter pieces.
- Sound, move animation, coordinates, and automatic next puzzle after a solve.
- **Open with the agent.**

A short glow marks a solve. Animations turn off when the system asks for reduced motion. Controls keep a name for screen readers when the sidebar is too narrow for labels, and the layout holds together down to about 280px wide.

## Install from source

```bash
npm install
npm run package          # typecheck + tests + build + cursor-chess-<version>.vsix
```

In Cursor, run **Extensions: Install from VSIX…** and pick the `.vsix` file, or run `cursor --install-extension cursor-chess-<version>.vsix`.

To publish a new version to the `gogojo` namespace on Open VSX:

```bash
npx ovsx publish -p "$OVSX_PAT"
```

`OVSX_PAT` is an access token from the [Open VSX tokens page](https://open-vsx.org/user-settings/tokens).

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
  agent/         agent-notice hook, board follow, status bar
src/webview/     React UI: components/, hooks/usePuzzle.ts, services/chessService.ts (PuzzleSession)
src/shared/      types, message protocol, sample puzzles, PuzzleLibrary, themes, rating and progression
scripts/         curate-puzzles.mjs, which rebuilds the bundled sample
test/            Vitest unit tests
media/           activity-bar icon (icon.svg) and marketplace icon (icon.png)
```

## License

The extension code is [MIT](LICENSE). The bundled puzzles are from the Lichess puzzle database, which is CC0.
