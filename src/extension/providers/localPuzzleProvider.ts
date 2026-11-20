import { SAMPLE_PUZZLES } from '../../shared/samplePuzzles';
import type { Puzzle } from '../../shared/types';

export class LocalPuzzleProvider {
  constructor(private readonly puzzles: Puzzle[] = SAMPLE_PUZZLES) {
    if (puzzles.length === 0) throw new Error('LocalPuzzleProvider needs at least one puzzle');
  }

  first(): Puzzle {
    return this.puzzles[0]!;
  }

  /** The puzzle after `currentId`, wrapping around at the end. */
  next(currentId?: string): Puzzle {
    const index = this.puzzles.findIndex((p) => p.id === currentId);
    return this.puzzles[(index + 1) % this.puzzles.length]!;
  }
}
