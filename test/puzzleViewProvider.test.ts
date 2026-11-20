import { describe, expect, it, vi } from 'vitest';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../src/shared/messages';
import { difficultyBand } from '../src/shared/difficulty';
import { SAMPLE_PUZZLES } from '../src/shared/samplePuzzles';

vi.mock('vscode', () => ({
  Uri: {
    joinPath: (base: { path: string }, ...parts: string[]) => ({ path: [base.path, ...parts].join('/') }),
  },
}));

const { PuzzleViewProvider } = await import('../src/extension/puzzleViewProvider');
const { LocalPuzzleProvider } = await import('../src/extension/providers/localPuzzleProvider');
const { StorageService } = await import('../src/extension/storage/storageService');

type Loaded = Extract<ExtensionToWebviewMessage, { type: 'loadPuzzle' }>;
type Library = Extract<ExtensionToWebviewMessage, { type: 'library' }>;

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
  const onImport = vi.fn();
  const provider = new PuzzleViewProvider({ path: '/ext' } as never, new LocalPuzzleProvider(), storage, onImport);
  provider.resolveWebviewView({ webview, onDidDispose: () => {} } as never);
  const last = <T extends ExtensionToWebviewMessage['type']>(type: T) =>
    posted.filter((m) => m.type === type).at(-1) as Extract<ExtensionToWebviewMessage, { type: T }>;
  return { provider, webview, posted, storage, onImport, last, send: (m: WebviewToExtensionMessage) => receive(m) };
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

  it('sends library, summary, and the first puzzle on ready, then counts a solve once', async () => {
    const { posted, send, last } = createHarness();
    await send({ type: 'ready' });
    expect(posted.map((m) => m.type)).toEqual(['library', 'summary', 'loadPuzzle']);
    expect(last('library').library).toMatchObject({ totalCount: SAMPLE_PUZZLES.length, importedCount: 0 });
    const first = last('loadPuzzle') as Loaded;
    expect(first.puzzle.id).toBe(SAMPLE_PUZZLES[0]!.id);

    await send({ type: 'puzzleSolved', puzzleId: first.puzzle.id, attemptId: 'attempt-1', mistakes: 0 });
    await send({ type: 'puzzleSolved', puzzleId: first.puzzle.id, attemptId: 'attempt-1', mistakes: 0 });
    expect(last('summary').summary).toEqual({ solvedCount: 1 });
    expect(posted.filter((m) => m.type === 'summary')).toHaveLength(2);

    await send({ type: 'puzzleFailed', puzzleId: first.puzzle.id, attemptId: 'attempt-revealed' });
    await send({ type: 'puzzleSolved', puzzleId: first.puzzle.id, attemptId: 'attempt-revealed', mistakes: 2 });
    expect(last('summary').summary).toEqual({ solvedCount: 1 });
  });

  it('does not repeat a puzzle until the matching pool runs out', async () => {
    const { send, last } = createHarness();
    await send({ type: 'ready' });
    const seen = new Set([last('loadPuzzle').puzzle.id]);
    for (let i = 0; i < 60; i++) {
      await send({ type: 'requestNextPuzzle', currentPuzzleId: '' });
      seen.add(last('loadPuzzle').puzzle.id);
    }
    expect(seen.size).toBe(61);
  });

  it('saves filters, reports the match count, and loads a matching puzzle', async () => {
    const { send, last, storage } = createHarness();
    await send({ type: 'ready' });
    await send({ type: 'setFilters', filters: { difficulty: 'Advanced', theme: 'fork' } });

    expect(storage.getFilters()).toEqual({ difficulty: 'Advanced', theme: 'fork' });
    const library = (last('library') as Library).library;
    const expected = SAMPLE_PUZZLES.filter((p) => difficultyBand(p.rating) === 'Advanced' && p.themes.includes('fork')).length;
    expect(library.matchingCount).toBe(expected);

    const loaded = last('loadPuzzle') as Loaded;
    expect(difficultyBand(loaded.puzzle.rating)).toBe('Advanced');
    expect(loaded.puzzle.themes).toContain('fork');
    expect(loaded.notice).toBeUndefined();
  });

  it('falls back with a notice when nothing matches, and forwards import requests', async () => {
    const { send, last, onImport } = createHarness();
    await send({ type: 'ready' });
    await send({ type: 'setFilters', filters: { difficulty: 'Beginner', theme: 'nonexistentTheme' } });
    expect(last('library').library.matchingCount).toBe(0);
    expect(last('loadPuzzle').notice).toMatch(/No Beginner .* puzzles yet/);

    await send({ type: 'importPuzzles' });
    expect(onImport).toHaveBeenCalledOnce();
  });
});
