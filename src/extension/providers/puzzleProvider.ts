import type { Puzzle, PuzzleFilters } from '../../shared/types';

/**
 * Where puzzles come from. The local provider (bundled sample plus imported cache)
 * is the only one today; an online source would implement the same surface.
 */
export interface PuzzleProvider {
  /** The puzzle shown to someone who has never played. */
  first(): Puzzle;
  /** A puzzle matching `filters`, avoiding `recentIds` (oldest first) when possible. */
  pick(filters: PuzzleFilters, recentIds: readonly string[]): Puzzle | null;
  count(filters?: PuzzleFilters): number;
  readonly importedCount: number;
}
