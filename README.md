# Cursor Chess

Bite-sized tactical chess puzzles in your Cursor (or VS Code) sidebar, for the minutes while your agents work.

## Status

Phase 1 (foundation) of 7. You get:

- An activity-bar icon and a **Puzzle** sidebar view.
- An interactive board (react-chessboard, with chess.js as the source of truth). It supports drag-and-drop and click-to-move, shows legal-move dots and capture rings, highlights the last move, glows the king when in check, and blocks illegal moves.
- Real puzzles from the [Lichess puzzle database](https://database.lichess.org/#puzzles) (CC0). The opponent's setup move is auto-played, the solutions are multi-move with automatic replies, and any checkmate is accepted on the final move.
- Wrong-move feedback with a retry that doesn't reveal the solution, plus Hint (highlights the piece to move), Reset, and Next.
- A solved banner, and a solved counter persisted in `globalState` (each attempt is counted at most once).

See the implementation plan for the roadmap: rating, XP, Lichess import, themes, settings, and agent-hook notifications.

## Install the VSIX

```bash
npm install
npm run package          # typecheck + tests + build + cursor-chess-<version>.vsix
```

Then in Cursor, open the Command Palette and run **Extensions: Install from VSIX…**, and pick the `.vsix` file. You can also run `cursor --install-extension cursor-chess-0.1.0.vsix`. Click the knight icon in the activity bar to open it.

## Develop

| Command | What it does |
|---|---|
| `npm run build` | Bundles the extension (esbuild → `dist/extension.js`) and the webview (Vite → `dist/webview/`) |
| `npm test` | Runs the Vitest unit tests (puzzle engine, sample data, storage) |
| `npm run typecheck` | Runs strict TypeScript over everything |
| `npm run dev:webview` | Serves the UI in a browser at Vite's dev URL, with a built-in stand-in for the extension host |
| `npm run watch:webview` / `npm run watch:extension` | Rebuild on change |

Press **F5** in Cursor or VS Code ("Run Cursor Chess") to build and launch an Extension Development Host with the extension loaded.

## Layout

```
src/extension/   extension host: view provider (CSP + nonce), commands, puzzle provider, storage
src/webview/     React UI: components/, hooks/usePuzzle.ts, services/chessService.ts (PuzzleSession)
src/shared/      types, message protocol, sample puzzles
test/            Vitest unit tests
media/icon.svg   activity-bar icon
```

Puzzle data: Lichess puzzle database, released under CC0.
