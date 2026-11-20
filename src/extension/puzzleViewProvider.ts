import * as vscode from 'vscode';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/messages';
import type { Puzzle } from '../shared/types';
import { LocalPuzzleProvider } from './providers/localPuzzleProvider';
import { StorageService } from './storage/storageService';

export class PuzzleViewProvider implements vscode.WebviewViewProvider {
  static readonly viewId = 'cursorChess.puzzleView';

  private view?: vscode.WebviewView;
  private currentPuzzle: Puzzle;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly puzzles: LocalPuzzleProvider,
    private readonly storage: StorageService,
  ) {
    this.currentPuzzle = puzzles.first();
  }

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

  showNextPuzzle(): void {
    this.currentPuzzle = this.puzzles.next(this.currentPuzzle.id);
    this.post({ type: 'loadPuzzle', puzzle: this.currentPuzzle });
  }

  private async handleMessage(message: WebviewToExtensionMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        this.post({ type: 'loadPuzzle', puzzle: this.currentPuzzle });
        this.post({ type: 'summary', summary: this.storage.getSummary() });
        break;
      case 'requestNextPuzzle':
        this.showNextPuzzle();
        break;
      case 'puzzleSolved':
        if (await this.storage.recordSolve(message.attemptId)) {
          this.post({ type: 'summary', summary: this.storage.getSummary() });
        }
        break;
      case 'puzzleFailed':
        await this.storage.recordFailure(message.attemptId);
        break;
    }
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
