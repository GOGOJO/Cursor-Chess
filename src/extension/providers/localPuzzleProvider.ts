import { PuzzleLibrary } from '../../shared/puzzleLibrary';
import { SAMPLE_PUZZLES } from '../../shared/samplePuzzles';
import type { Puzzle, PuzzleFilters } from '../../shared/types';
import type { PuzzleCache } from './puzzleCache';
import type { PuzzleProvider } from './puzzleProvider';

/** The bundled sample plus puzzles imported from Lichess. Works fully offline. */
export class LocalPuzzleProvider implements PuzzleProvider {
  private readonly library: PuzzleLibrary;
  private imported: Puzzle[] = [];

  constructor(
    private readonly cache?: PuzzleCache,
    private readonly sample: readonly Puzzle[] = SAMPLE_PUZZLES,
  ) {
    this.library = new PuzzleLibrary(sample);
  }

  /** Loads previously imported puzzles from the cache. */
  async load(): Promise<void> {
    if (!this.cache) return;
    this.imported = await this.cache.load();
    this.library.setImported(this.imported);
  }

  first(): Puzzle {
    return this.library.first();
  }

  pick(filters: PuzzleFilters, recentIds: readonly string[]): Puzzle | null {
    return this.library.pick(filters, recentIds);
  }

  count(filters?: PuzzleFilters): number {
    return filters ? this.library.matching(filters).length : this.library.totalCount;
  }

  get importedCount(): number {
    return this.library.importedCount;
  }

  has(id: string): boolean {
    return this.library.has(id);
  }

  /** Every id in the library, so an import can skip puzzles it already has. */
  knownIds(): Set<string> {
    return new Set([...this.sample.map((p) => p.id), ...this.imported.map((p) => p.id)]);
  }

  /** Adds imported puzzles and persists them. Returns how many are in the library now. */
  async addImported(puzzles: readonly Puzzle[]): Promise<number> {
    const merged = [...this.imported, ...puzzles];
    this.imported = this.cache ? await this.cache.save(merged) : merged;
    this.library.setImported(this.imported);
    return this.library.importedCount;
  }

  async clearImported(): Promise<void> {
    await this.cache?.clear();
    this.imported = [];
    this.library.setImported([]);
  }
}
