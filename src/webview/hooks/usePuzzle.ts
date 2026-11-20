import type { Square } from 'chess.js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { PlayerSummary, Puzzle } from '../../shared/types';
import { PuzzleSession } from '../services/chessService';
import { onExtensionMessage, postToExtension } from '../vscode';

export type Feedback =
  | { kind: 'idle' }
  | { kind: 'correct'; san: string }
  | { kind: 'wrong'; san: string }
  | { kind: 'solved'; san: string };

const OPPONENT_REPLY_DELAY_MS = 450;
const WRONG_FLASH_MS = 650;

function newAttemptId(puzzleId: string): string {
  return `${puzzleId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export function usePuzzle() {
  const sessionRef = useRef<PuzzleSession | null>(null);
  const attemptIdRef = useRef('');
  const timersRef = useRef<number[]>([]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [wrongSquare, setWrongSquare] = useState<Square | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [summary, setSummary] = useState<PlayerSummary | null>(null);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const resetUiState = () => {
    clearTimers();
    setSelected(null);
    setFeedback({ kind: 'idle' });
    setWrongSquare(null);
    setHintVisible(false);
  };

  const loadPuzzle = useCallback((puzzle: Puzzle) => {
    resetUiState();
    sessionRef.current = new PuzzleSession(puzzle);
    attemptIdRef.current = newAttemptId(puzzle.id);
    rerender();
  }, []);

  useEffect(() => {
    const unsubscribe = onExtensionMessage((message) => {
      if (message.type === 'loadPuzzle') loadPuzzle(message.puzzle);
      else if (message.type === 'summary') setSummary(message.summary);
    });
    postToExtension({ type: 'ready' });
    return () => {
      unsubscribe();
      clearTimers();
    };
  }, [loadPuzzle]);

  const tryMove = useCallback((from: Square, to: Square): boolean => {
    const session = sessionRef.current;
    if (!session) return false;
    const result = session.submitMove(from, to);
    setSelected(null);

    switch (result.kind) {
      case 'illegal':
        return false;
      case 'wrong':
        setFeedback({ kind: 'wrong', san: result.san });
        setWrongSquare(to);
        later(() => setWrongSquare(null), WRONG_FLASH_MS);
        rerender();
        return false;
      case 'correct':
        setFeedback({ kind: 'correct', san: result.san });
        setHintVisible(false);
        rerender();
        later(() => {
          session.playOpponentReply();
          rerender();
        }, OPPONENT_REPLY_DELAY_MS);
        return true;
      case 'solved':
        setFeedback({ kind: 'solved', san: result.san });
        setHintVisible(false);
        postToExtension({
          type: 'puzzleSolved',
          puzzleId: session.puzzle.id,
          attemptId: attemptIdRef.current,
          mistakes: session.mistakes,
        });
        rerender();
        return true;
    }
  }, []);

  const onSquareClick = useCallback(
    (square: Square) => {
      const session = sessionRef.current;
      if (!session?.isPlayerTurn) return;
      if (selected && selected !== square && session.legalTargets(selected).includes(square)) {
        tryMove(selected, square);
        return;
      }
      if (session.pieceColorAt(square) === session.playerColor && selected !== square) {
        setSelected(square);
      } else {
        setSelected(null);
      }
    },
    [selected, tryMove],
  );

  const onPieceDragStart = useCallback((square: Square) => {
    const session = sessionRef.current;
    if (session?.pieceColorAt(square) === session?.playerColor) setSelected(square);
  }, []);

  const reset = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    resetUiState();
    session.reset();
    rerender();
  }, []);

  const showHint = useCallback(() => setHintVisible(true), []);

  const nextPuzzle = useCallback(() => {
    const session = sessionRef.current;
    if (session) postToExtension({ type: 'requestNextPuzzle', currentPuzzleId: session.puzzle.id });
  }, []);

  return {
    session: sessionRef.current,
    selected,
    feedback,
    wrongSquare,
    hintVisible,
    summary,
    tryMove,
    onSquareClick,
    onPieceDragStart,
    clearSelection: () => setSelected(null),
    reset,
    showHint,
    nextPuzzle,
  };
}
