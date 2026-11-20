import type { Puzzle } from '../../shared/types';

/** A single text file, so the cache can be tested without VS Code. */
export interface TextFile {
  read(): Promise<string | undefined>;
  write(text: string): Promise<void>;
  delete(): Promise<void>;
}

interface CacheFile {
  version: 1;
  puzzles: Puzzle[];
}

export const MAX_CACHED_PUZZLES = 20_000;

function isPuzzle(value: unknown): value is Puzzle {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.fen === 'string' &&
    typeof p.rating === 'number' &&
    Array.isArray(p.moves) &&
    p.moves.length >= 2 &&
    p.moves.every((m) => typeof m === 'string') &&
    Array.isArray(p.themes) &&
    p.themes.every((t) => typeof t === 'string')
  );
}

/**
 * Imported puzzles, kept as JSON in the extension's global storage folder rather
 * than `globalState`, which is meant for small values.
 */
export class PuzzleCache {
  constructor(
    private readonly file: TextFile,
    private readonly max = MAX_CACHED_PUZZLES,
  ) {}

  /** Returns the cached puzzles. A missing or corrupt file reads as empty. */
  async load(): Promise<Puzzle[]> {
    const text = await this.file.read();
    if (!text) return [];
    try {
      const data = JSON.parse(text) as Partial<CacheFile>;
      return Array.isArray(data.puzzles) ? data.puzzles.filter(isPuzzle) : [];
    } catch {
      return [];
    }
  }

  /** Writes the set, keeping the newest `max` when it is too large. Returns what was kept. */
  async save(puzzles: readonly Puzzle[]): Promise<Puzzle[]> {
    const kept = puzzles.slice(-this.max);
    const data: CacheFile = { version: 1, puzzles: kept };
    await this.file.write(JSON.stringify(data));
    return kept;
  }

  async clear(): Promise<void> {
    await this.file.delete();
  }
}
