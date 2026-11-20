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

  it('keeps progress across restarts that reuse the same store', async () => {
    const store = new MemoryStore();
    await new StorageService(store).recordSolve('a1');
    const restarted = new StorageService(store);
    expect(restarted.getSummary().solvedCount).toBe(1);
    expect(await restarted.recordSolve('a1')).toBe(false);
  });
});

describe('LocalPuzzleProvider', () => {
  it('starts with the first sample and cycles', () => {
    const provider = new LocalPuzzleProvider();
    expect(provider.first().id).toBe(SAMPLE_PUZZLES[0]!.id);
    const last = SAMPLE_PUZZLES[SAMPLE_PUZZLES.length - 1]!;
    expect(provider.next(last.id).id).toBe(SAMPLE_PUZZLES[0]!.id);
    expect(provider.next(SAMPLE_PUZZLES[0]!.id).id).toBe(SAMPLE_PUZZLES[1]!.id);
  });
});
