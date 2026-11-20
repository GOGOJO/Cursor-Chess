import type { AttemptState, ProgressSnapshot } from './progression';
import type { LibraryInfo, Puzzle, PuzzleFilters } from './types';

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'requestNextPuzzle'; currentPuzzleId: string }
  /** Sent whenever the attempt changes: a found move, a mistake, a hint, a reveal, or the solve. */
  | { type: 'attempt'; attempt: AttemptState }
  | { type: 'setFilters'; filters: PuzzleFilters }
  | { type: 'importPuzzles' };

export type ExtensionToWebviewMessage =
  /** `resume` is the unfinished attempt at this puzzle, to replay instead of starting over. */
  | { type: 'loadPuzzle'; puzzle: Puzzle; notice?: string; resume?: AttemptState }
  | { type: 'progress'; progress: ProgressSnapshot }
  | { type: 'library'; library: LibraryInfo };
