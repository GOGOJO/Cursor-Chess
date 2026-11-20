import { describe, expect, it } from 'vitest';
import { LocalPuzzleProvider } from '../src/extension/providers/localPuzzleProvider';
import { sanitizeAttempt, sanitizeProgress, StorageService, type KeyValueStore } from '../src/extension/storage/storageService';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/shared/settings';
import type { AttemptState } from '../src/shared/progression';
import { SAMPLE_PUZZLES } from '../src/shared/samplePuzzles';

class MemoryStore implements KeyValueStore {
  private readonly data = new Map<string, unknown>();
  get<T>(key: string, defaultValue: T): T {
    return this.data.has(key) ? (this.data.get(key) as T) : defaultValue;
  }
  async update(key: string, value: unknown): Promise<void> {
    this.data.set(key, structuredClone(value));
  }
}

const puzzle = SAMPLE_PUZZLES[0]!;
const attempt = (overrides: Partial<AttemptState> = {}): AttemptState => ({
  attemptId: 'a1',
  puzzleId: puzzle.id,
  playerMoves: [],
  mistakes: 0,
  hints: 0,
  revealed: false,
  solved: false,
  ...overrides,
});

describe('StorageService progress', () => {
  it('rates and rewards an attempt once, however often it is reported', async () => {
    const storage = new StorageService(new MemoryStore());
    expect(storage.getSnapshot()).toMatchObject({ rating: 1200, solved: 0, totalXp: 0 });

    expect(await storage.recordAttempt(attempt({ playerMoves: ['e2e4'] }), puzzle)).toBe(false);
    const solved = attempt({ playerMoves: ['e2e4'], solved: true });
    expect(await storage.recordAttempt(solved, puzzle)).toBe(true);
    const once = storage.getSnapshot();
    expect(await storage.recordAttempt(solved, puzzle)).toBe(false);
    expect(storage.getSnapshot()).toEqual(once);
    expect(once).toMatchObject({ solved: 1, attempted: 1, wins: 1 });
    expect(once.totalXp).toBeGreaterThan(0);
  });

  it('runs overlapping reports in order so none is lost', async () => {
    const storage = new StorageService(new MemoryStore());
    await Promise.all([
      storage.recordAttempt(attempt({ mistakes: 1 }), puzzle),
      storage.recordAttempt(attempt({ mistakes: 1, solved: true }), puzzle),
      storage.recordAttempt(attempt({ attemptId: 'a2', revealed: true }), puzzle),
    ]);
    expect(storage.getSnapshot()).toMatchObject({ attempted: 2, wins: 0, solved: 1 });
    expect(storage.getActiveAttempt()?.attemptId).toBe('a2');
  });

  it('keeps progress and the active attempt across restarts that reuse the same store', async () => {
    const store = new MemoryStore();
    const first = new StorageService(store);
    await first.recordAttempt(attempt({ attemptId: 'a1', solved: true }), puzzle);
    await first.recordAttempt(attempt({ attemptId: 'a2', playerMoves: ['e2e4'], hints: 1 }), puzzle);

    const restarted = new StorageService(store);
    expect(restarted.getSnapshot()).toEqual(first.getSnapshot());
    expect(restarted.getActiveAttempt()).toMatchObject({ attemptId: 'a2', playerMoves: ['e2e4'], hints: 1 });
    expect(await restarted.recordAttempt(attempt({ attemptId: 'a1', solved: true }), puzzle)).toBe(false);

    await restarted.clearActiveAttempt();
    expect(restarted.getActiveAttempt()).toBeNull();
  });

  it('carries over the solved count saved by earlier versions', () => {
    const store = new MemoryStore();
    void store.update('cursorChess.solvedCount', 7);
    expect(new StorageService(store).getSnapshot()).toMatchObject({ solved: 7, rating: 1200, attempted: 0 });
  });

  it('falls back safely on malformed saved progress and attempts', async () => {
    const store = new MemoryStore();
    await store.update('cursorChess.progress', { version: 1, rating: 'high', totalXp: -5, history: [{ bogus: true }] });
    await store.update('cursorChess.activeAttempt', { ...attempt(), playerMoves: ['not-a-move'] });
    const storage = new StorageService(store);
    expect(storage.getProgress()).toMatchObject({ rating: 1200, totalXp: 0, history: [] });
    expect(storage.getActiveAttempt()).toBeNull();
    expect(sanitizeAttempt({ ...attempt(), mistakes: -1 })).toBeNull();
    expect(sanitizeProgress({ version: 2 }, 3)).toMatchObject({ solved: 3 });
  });
});

describe('StorageService settings', () => {
  it('defaults settings, saves them, and drops malformed values', async () => {
    const store = new MemoryStore();
    const storage = new StorageService(store);
    expect(storage.getSettings()).toEqual(DEFAULT_SETTINGS);

    const saved = await storage.setSettings({ ...DEFAULT_SETTINGS, sound: true, boardTheme: 'slate', pieceStyle: 'letters' });
    expect(saved).toMatchObject({ sound: true, boardTheme: 'slate', pieceStyle: 'letters' });
    expect(new StorageService(store).getSettings()).toEqual(saved);

    await store.update('cursorChess.settings', { sound: 'yes', boardTheme: 'neon', pieceStyle: 'wood', animate: false });
    expect(storage.getSettings()).toMatchObject({ sound: false, boardTheme: 'sage', pieceStyle: 'standard', animate: false });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('StorageService filters and history', () => {
  it('defaults filters and rejects malformed saved values', async () => {
    const store = new MemoryStore();
    const storage = new StorageService(store);
    expect(storage.getFilters()).toEqual({ difficulty: 'any', theme: 'any' });

    await storage.setFilters({ difficulty: 'Expert', theme: 'fork' });
    expect(new StorageService(store).getFilters()).toEqual({ difficulty: 'Expert', theme: 'fork' });

    await store.update('cursorChess.filters', { difficulty: 'Impossible', theme: '<script>' });
    expect(storage.getFilters()).toEqual({ difficulty: 'any', theme: 'any' });
  });

  it('keeps recently shown puzzles oldest first, without duplicates, capped', async () => {
    const storage = new StorageService(new MemoryStore());
    await storage.recordPuzzleShown('a');
    await storage.recordPuzzleShown('b');
    await storage.recordPuzzleShown('a');
    expect(storage.getRecentPuzzleIds()).toEqual(['b', 'a']);
    for (let i = 0; i < 200; i++) await storage.recordPuzzleShown(`p${i}`);
    expect(storage.getRecentPuzzleIds()).toHaveLength(150);
    expect(storage.getRecentPuzzleIds().at(-1)).toBe('p199');
  });
});

describe('LocalPuzzleProvider', () => {
  it('starts on the first sample and works without a cache', () => {
    const provider = new LocalPuzzleProvider();
    expect(provider.first().id).toBe(SAMPLE_PUZZLES[0]!.id);
    expect(provider.count()).toBe(SAMPLE_PUZZLES.length);
    expect(provider.pick({ difficulty: 'any', theme: 'any' }, [])).not.toBeNull();
  });
});
