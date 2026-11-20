import { describe, expect, it } from 'vitest';
import { LocalPuzzleProvider } from '../src/extension/providers/localPuzzleProvider';
import { StorageService, type KeyValueStore } from '../src/extension/storage/storageService';
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

describe('StorageService', () => {
  it('counts each attempt once', async () => {
    const storage = new StorageService(new MemoryStore());
    expect(storage.getSummary().solvedCount).toBe(0);
    expect(await storage.recordSolve('a1')).toBe(true);
    expect(await storage.recordSolve('a1')).toBe(false);
    expect(await storage.recordSolve('a2')).toBe(true);
    expect(storage.getSummary().solvedCount).toBe(2);
  });

  it('spends an attempt when the solution is revealed, so a later solve does not count', async () => {
    const storage = new StorageService(new MemoryStore());
    expect(await storage.recordFailure('attempt-1')).toBe(true);
    expect(await storage.recordFailure('attempt-1')).toBe(false);
    expect(await storage.recordSolve('attempt-1')).toBe(false);
    expect(storage.getSummary().solvedCount).toBe(0);
    expect(await storage.recordSolve('attempt-2')).toBe(true);
    expect(storage.getSummary().solvedCount).toBe(1);
  });

  it('keeps progress across restarts that reuse the same store', async () => {
    const store = new MemoryStore();
    await new StorageService(store).recordSolve('a1');
    const restarted = new StorageService(store);
    expect(restarted.getSummary().solvedCount).toBe(1);
    expect(await restarted.recordSolve('a1')).toBe(false);
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
