import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/messages';
import { chooseNextPuzzle } from '../shared/puzzleLibrary';
import type { LibraryInfo, Puzzle } from '../shared/types';
import type { LocalPuzzleProvider } from './providers/localPuzzleProvider';
import { sanitizeAttempt, type StorageService } from './storage/storageService';

export class PuzzleViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'cursorChess.puzzleView';

  private view?: vscode.WebviewView;
  private current?: { puzzle: Puzzle; notice?: string };

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly puzzles: LocalPuzzleProvider,
    private readonly storage: StorageService,
    private readonly onImportRequested: () => void = () => {},
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    const webviewRoot = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [webviewRoot, vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = this.renderHtml(view.webview, webviewRoot);
    view.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => this.handleMessage(message));
    view.onDidDispose(() => {
      this.view = undefined;
    });
  }

  async showNextPuzzle(): Promise<void> {
    await this.storage.clearActiveAttempt();
    this.current = chooseNextPuzzle(this.puzzles, this.storage.getFilters(), this.storage.getRecentPuzzleIds());
    await this.storage.recordPuzzleShown(this.current.puzzle.id);
    this.postCurrent();
  }

  /** Re-sends library counts, for example after an import. */
  refreshLibrary(): void {
    this.post({ type: 'library', library: this.libraryInfo() });
  }

  /**
   * Picks up where the player left off: the puzzle on screen if the view was only
   * hidden, or an unfinished attempt saved before the editor closed.
   */
  private async showCurrentOrResume(): Promise<void> {
    if (this.current && this.puzzles.has(this.current.puzzle.id)) {
      this.postCurrent();
      return;
    }
    const saved = this.storage.getActiveAttempt();
    const puzzle = saved && !saved.solved && !saved.revealed ? this.puzzles.get(saved.puzzleId) : undefined;
    if (puzzle) {
      this.current = { puzzle };
      this.postCurrent();
      return;
    }
    await this.showNextPuzzle();
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.refreshLibrary();
        this.post({ type: 'progress', progress: this.storage.getSnapshot() });
        await this.showCurrentOrResume();
        break;
      case 'requestNextPuzzle':
        await this.showNextPuzzle();
        break;
      case 'attempt': {
        const attempt = sanitizeAttempt(message.attempt);
        if (!attempt || attempt.puzzleId !== this.current?.puzzle.id) break;
        if (await this.storage.recordAttempt(attempt, this.current.puzzle)) {
          this.post({ type: 'progress', progress: this.storage.getSnapshot() });
        }
        break;
      }
      case 'setFilters':
        await this.storage.setFilters(message.filters);
        this.refreshLibrary();
        await this.showNextPuzzle();
        break;
      case 'importPuzzles':
        this.onImportRequested();
        break;
    }
  }

  private libraryInfo(): LibraryInfo {
    const filters = this.storage.getFilters();
    return {
      filters,
      totalCount: this.puzzles.count(),
      importedCount: this.puzzles.importedCount,
      matchingCount: this.puzzles.count(filters),
    };
  }

  private postCurrent(): void {
    if (!this.current) return;
    const saved = this.storage.getActiveAttempt();
    const resume = saved?.puzzleId === this.current.puzzle.id ? saved : undefined;
    this.post({ type: 'loadPuzzle', puzzle: this.current.puzzle, notice: this.current.notice, resume });
  }

  private post(message: ExtensionToWebviewMessage): void {
    void this.view?.webview.postMessage(message);
  }

  private renderHtml(webview: vscode.Webview, webviewRoot: vscode.Uri): string {
    const asset = (name: string) => webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'assets', name));
    const nonce = createNonce();
    // react-chessboard positions pieces with inline styles, so style-src needs 'unsafe-inline'.
    const csp = [
      `default-src 'none'`,
      `img-src ${webview.cspSource} data:`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${asset('index.css')}" />
  <title>Cursor Chess</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${asset('index.js')}"></script>
</body>
</html>`;
  }
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  return nonce;
}
