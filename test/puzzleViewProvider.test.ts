import { describe, expect, it, vi } from 'vitest';
import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../src/shared/messages';
import { difficultyBand } from '../src/shared/difficulty';
import type { AttemptState } from '../src/shared/progression';
import { SAMPLE_PUZZLES } from '../src/shared/samplePuzzles';
import type { Puzzle } from '../src/shared/types';

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

let attemptCounter = 0;
const attemptFor = (puzzleId: string): AttemptState => ({
  attemptId: `attempt-${++attemptCounter}`,
  puzzleId,
  playerMoves: [],
  mistakes: 0,
  hints: 0,
  revealed: false,
  solved: false,
});

/** The player's moves of the solution: every other move after the opponent's setup move. */
const playerMoves = (puzzle: Puzzle) => puzzle.moves.filter((_, i) => i % 2 === 1);

function createHarness(data = new Map<string, unknown>()) {
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

  it('sends library, progress, and the first puzzle on ready, then rates a solve once', async () => {
    const { posted, send, last } = createHarness();
    await send({ type: 'ready' });
    expect(posted.map((m) => m.type)).toEqual(['library', 'progress', 'loadPuzzle']);
    expect(last('library').library).toMatchObject({ totalCount: SAMPLE_PUZZLES.length, importedCount: 0 });
    expect(last('progress').progress).toMatchObject({ rating: 1200, solved: 0 });
    const first = last('loadPuzzle') as Loaded;
    expect(first.puzzle.id).toBe(SAMPLE_PUZZLES[0]!.id);
    expect(first.resume).toBeUndefined();

    const solved = { ...attemptFor(first.puzzle.id), playerMoves: playerMoves(first.puzzle), solved: true };
    await send({ type: 'attempt', attempt: solved });
    await send({ type: 'attempt', attempt: solved });
    expect(posted.filter((m) => m.type === 'progress')).toHaveLength(2);
    const progress = last('progress').progress;
    expect(progress).toMatchObject({ solved: 1, attempted: 1, wins: 1 });
    expect(progress.rating).toBeGreaterThan(1200);
    expect(progress.recent[0]).toMatchObject({ attemptId: solved.attemptId, won: true });
  });

  it('ignores attempts for a puzzle that is not on screen, and malformed ones', async () => {
    const { posted, send } = createHarness();
    await send({ type: 'ready' });
    await send({ type: 'attempt', attempt: { ...attemptFor(SAMPLE_PUZZLES[5]!.id), solved: true } });
    await send({ type: 'attempt', attempt: { attemptId: 'x', puzzleId: SAMPLE_PUZZLES[0]!.id, playerMoves: 'e2e4' } as never });
    expect(posted.filter((m) => m.type === 'progress')).toHaveLength(1);
  });

  it('resumes an unfinished attempt after a restart, and starts fresh once it is finished', async () => {
    const data = new Map<string, unknown>();
    const before = createHarness(data);
    await before.send({ type: 'ready' });
    const puzzle = before.last('loadPuzzle').puzzle;
    const unfinished = { ...attemptFor(puzzle.id), playerMoves: playerMoves(puzzle).slice(0, 1), mistakes: 1 };
    await before.send({ type: 'attempt', attempt: unfinished });
    const rated = before.last('progress').progress;

    const after = createHarness(data);
    await after.send({ type: 'ready' });
    const resumed = after.last('loadPuzzle') as Loaded;
    expect(resumed.puzzle.id).toBe(puzzle.id);
    expect(resumed.resume).toEqual(unfinished);
    expect(after.last('progress').progress).toEqual(rated);

    await after.send({ type: 'attempt', attempt: { ...unfinished, revealed: true } });
    const third = createHarness(data);
    await third.send({ type: 'ready' });
    expect(third.last('loadPuzzle').resume).toBeUndefined();
    expect(third.last('progress').progress.attempted).toBe(1);
  });

  it('forgets the active attempt when moving on to the next puzzle', async () => {
    const { send, last, storage } = createHarness();
    await send({ type: 'ready' });
    await send({ type: 'attempt', attempt: { ...attemptFor(last('loadPuzzle').puzzle.id), hints: 1 } });
    expect(storage.getActiveAttempt()).not.toBeNull();
    await send({ type: 'requestNextPuzzle', currentPuzzleId: '' });
    expect(storage.getActiveAttempt()).toBeNull();
    expect(last('loadPuzzle').resume).toBeUndefined();
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
