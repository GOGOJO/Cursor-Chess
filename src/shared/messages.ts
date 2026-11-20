import type { LibraryInfo, PlayerSummary, Puzzle, PuzzleFilters } from './types';

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'requestNextPuzzle'; currentPuzzleId: string }
  | { type: 'puzzleSolved'; puzzleId: string; attemptId: string; mistakes: number }
  | { type: 'puzzleFailed'; puzzleId: string; attemptId: string }
  | { type: 'setFilters'; filters: PuzzleFilters }
  | { type: 'importPuzzles' };

export type ExtensionToWebviewMessage =
  | { type: 'loadPuzzle'; puzzle: Puzzle; notice?: string }
  | { type: 'summary'; summary: PlayerSummary }
  | { type: 'library'; library: LibraryInfo };
