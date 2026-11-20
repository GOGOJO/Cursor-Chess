import type { AttemptState, ProgressSnapshot } from './progression';
import type { Settings } from './settings';
import type { LibraryInfo, Puzzle, PuzzleFilters } from './types';

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'requestNextPuzzle'; currentPuzzleId: string }
  /** Sent whenever the attempt changes: a found move, a mistake, a hint, a reveal, or the solve. */
  | { type: 'attempt'; attempt: AttemptState }
  | { type: 'setFilters'; filters: PuzzleFilters }
  | { type: 'setSettings'; settings: Settings }
  | { type: 'importPuzzles' }
  | { type: 'puzzleBusy'; busy: boolean }
  | { type: 'installAgentHook' };

export type ExtensionToWebviewMessage =
  /** `resume` is the unfinished attempt at this puzzle, to replay instead of starting over. */
  | { type: 'loadPuzzle'; puzzle: Puzzle; notice?: string; resume?: AttemptState }
  | { type: 'progress'; progress: ProgressSnapshot }
  | { type: 'library'; library: LibraryInfo }
  | { type: 'settings'; settings: Settings }
  | { type: 'agent'; working: boolean; hookInstalled: boolean }
  | { type: 'showView'; view: 'progress' };
