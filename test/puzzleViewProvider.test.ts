import { describe, expect, it, vi } from 'vitest';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../src/shared/messages';

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (base: { path: string }, ...parts: string[]) => ({ path: [base.path, ...parts].join('/') }),
  },
}));

const { PuzzleViewProvider } = await import('../src/extension/puzzleViewProvider');
const { LocalPuzzleProvider } = await import('../src/extension/providers/localPuzzleProvider');
const { StorageService } = await import('../src/extension/storage/storageService');

function createHarness() {
  const data = new Map<string, unknown>();
  const storage = new StorageService({
    get: <T,>(key: string, fallback: T) => (data.has(key) ? (data.get(key) as T) : fallback),
    update: async (key, value) => void data.set(key, value),
  });
  const posted: ExtensionToWebviewMessage[] = [];
  let receive: (message: WebviewToExtensionMessage) => Promise<void> = async () => {};
  const webview = {
    options: {},
    html: '',
    cspSource: 'vscode-resource:',
    asWebviewUri: (uri: { path: string }) => `webview:${uri.path}`,
    postMessage: async (message: ExtensionToWebviewMessage) => posted.push(message),
    onDidReceiveMessage: (handler: (message: WebviewToExtensionMessage) => Promise<void>) => {
      receive = handler;
    },
  };
  const provider = new PuzzleViewProvider({ path: '/ext' } as never, new LocalPuzzleProvider(), storage);
  provider.resolveWebviewView({ webview, onDidDispose: () => {} } as never);
  return { provider, webview, posted, send: (m: WebviewToExtensionMessage) => receive(m) };
}

describe('PuzzleViewProvider', () => {
  it('renders HTML with a nonce-locked CSP pointing at the bundled assets', () => {
    const { webview } = createHarness();
    const nonce = /script-src 'nonce-([A-Za-z0-9]+)'/.exec(webview.html)?.[1];
    expect(nonce).toBeTruthy();
    expect(webview.html).toContain(`nonce="${nonce}" src="webview:/ext/dist/webview/assets/index.js"`);
    expect(webview.html).toContain('href="webview:/ext/dist/webview/assets/index.css"');
    expect(webview.html).toContain("default-src 'none'");
  });

  it('sends the puzzle and summary on ready, counts a solve once, and advances on request', async () => {
    const { posted, send } = createHarness();
    await send({ type: 'ready' });
    expect(posted.map((m) => m.type)).toEqual(['loadPuzzle', 'summary']);
    const first = posted[0] as Extract<ExtensionToWebviewMessage, { type: 'loadPuzzle' }>;

    await send({ type: 'puzzleSolved', puzzleId: first.puzzle.id, attemptId: 'attempt-1', mistakes: 0 });
    await send({ type: 'puzzleSolved', puzzleId: first.puzzle.id, attemptId: 'attempt-1', mistakes: 0 });
    const summaries = posted.filter((m) => m.type === 'summary');
    expect(summaries.at(-1)).toEqual({ type: 'summary', summary: { solvedCount: 1 } });
    expect(summaries).toHaveLength(2);

    await send({ type: 'requestNextPuzzle', currentPuzzleId: first.puzzle.id });
    const next = posted.at(-1) as Extract<ExtensionToWebviewMessage, { type: 'loadPuzzle' }>;
    expect(next.type).toBe('loadPuzzle');
    expect(next.puzzle.id).not.toBe(first.puzzle.id);
  });
});
