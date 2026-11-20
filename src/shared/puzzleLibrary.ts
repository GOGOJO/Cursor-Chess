import { difficultyBand } from './difficulty';
import { noMatchNotice } from './filterLabels';
import { DEFAULT_FILTERS, type Puzzle, type PuzzleFilters } from './types';

interface Picker {
  first(): Puzzle;
  pick(filters: PuzzleFilters, recentIds: readonly string[]): Puzzle | null;
}

/**
 * The next puzzle to show. Falls back to the whole library, with a notice, when
 * nothing matches the filters. A first-time player always starts on `first()`.
 */
export function chooseNextPuzzle(
  source: Picker,
  filters: PuzzleFilters,
  recentIds: readonly string[],
): { puzzle: Puzzle; notice?: string } {
  const isDefault = filters.difficulty === 'any' && filters.theme === 'any';
  if (recentIds.length === 0 && isDefault) return { puzzle: source.first() };
  const match = source.pick(filters, recentIds);
  if (match) return { puzzle: match };
  return { puzzle: source.pick(DEFAULT_FILTERS, recentIds) ?? source.first(), notice: noMatchNotice(filters) };
}

export function matchesFilters(puzzle: Puzzle, filters: PuzzleFilters): boolean {
  if (filters.difficulty !== 'any' && difficultyBand(puzzle.rating) !== filters.difficulty) return false;
  if (filters.theme !== 'any' && !puzzle.themes.includes(filters.theme)) return false;
  return true;
}

/**
 * The bundled sample plus any imported puzzles, with filtering and selection.
 * Pure, so the extension and the browser dev harness share it.
 */
export class PuzzleLibrary {
  private readonly sample: readonly Puzzle[];
  private imported: Puzzle[] = [];
  private pool: Puzzle[] = [];

  constructor(sample: readonly Puzzle[], imported: readonly Puzzle[] = []) {
    if (sample.length === 0) throw new Error('PuzzleLibrary needs at least one bundled puzzle');
    this.sample = sample;
    this.setImported(imported);
  }

  /** Replaces the imported set. Imported puzzles that duplicate a bundled one are dropped. */
  setImported(imported: readonly Puzzle[]): void {
    const sampleIds = new Set(this.sample.map((p) => p.id));
    this.imported = imported.filter((p) => !sampleIds.has(p.id));
    this.pool = [...this.sample, ...this.imported];
  }

  get totalCount(): number {
    return this.pool.length;
  }

  get importedCount(): number {
    return this.imported.length;
  }

  /** The puzzle shown to someone who has never played. */
  first(): Puzzle {
    return this.sample[0]!;
  }

  has(id: string): boolean {
    return this.pool.some((p) => p.id === id);
  }

  matching(filters: PuzzleFilters): Puzzle[] {
    return this.pool.filter((p) => matchesFilters(p, filters));
  }

  /**
   * Picks a puzzle matching `filters`, preferring ones not in `recentIds`
   * (ordered oldest first). When every match was seen recently, returns the
   * one seen longest ago. Returns null when nothing matches.
   */
  pick(filters: PuzzleFilters, recentIds: readonly string[], random: () => number = Math.random): Puzzle | null {
    const candidates = this.matching(filters);
    if (candidates.length === 0) return null;

    const recent = new Map(recentIds.map((id, index) => [id, index]));
    const fresh = candidates.filter((p) => !recent.has(p.id));
    if (fresh.length > 0) return fresh[Math.floor(random() * fresh.length)]!;

    return candidates.reduce((oldest, p) => (recent.get(p.id)! < recent.get(oldest.id)! ? p : oldest));
  }
}
