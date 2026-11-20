import type { PlayerSummary, Puzzle } from './types';

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'requestNextPuzzle'; currentPuzzleId: string }
  | { type: 'puzzleSolved'; puzzleId: string; attemptId: string; mistakes: number };

export type ExtensionToWebviewMessage =
  | { type: 'loadPuzzle'; puzzle: Puzzle }
  | { type: 'summary'; summary: PlayerSummary };
