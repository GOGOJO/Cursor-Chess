import type { PieceSymbol, Square } from 'chess.js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { PlayerSummary, Puzzle } from '../../shared/types';
import { PuzzleSession } from '../services/chessService';
import { areSoundsEnabled, playSound, setSoundsEnabled, type SoundCue } from '../services/soundService';
import { onExtensionMessage, postToExtension } from '../vscode';

export type Feedback =
  | { kind: 'idle' }
  | { kind: 'correct'; san: string }
  | { kind: 'wrong'; san: string }
  | { kind: 'revealing'; san: string }
  | { kind: 'solved'; san: string; counted: boolean }
  | { kind: 'failed' };

export interface PendingPromotion {
  from: Square;
  to: Square;
}

const OPPONENT_REPLY_DELAY_MS = 450;
const REVEAL_START_DELAY_MS = 280;
const REVEAL_PLY_DELAY_MS = 560;
const WRONG_FLASH_MS = 650;

function newAttemptId(puzzleId: string): string {
  return `${puzzleId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

function cueForSan(san: string, inCheck: boolean): SoundCue {
  if (inCheck) return 'check';
  if (san.includes('x')) return 'capture';
  return 'move';
}

export function usePuzzle() {
  const sessionRef = useRef<PuzzleSession | null>(null);
  const attemptIdRef = useRef('');
  const spoiledRef = useRef(false);
  const pendingRef = useRef<PendingPromotion | null>(null);
  const timersRef = useRef<number[]>([]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [wrongSquare, setWrongSquare] = useState<Square | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2>(0);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  const [soundOn, setSoundOn] = useState(areSoundsEnabled);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };
  const setPending = (value: PendingPromotion | null) => {
    pendingRef.current = value;
    setPendingPromotion(value);
  };

  const resetUiState = () => {
    clearTimers();
    setSelected(null);
    setFeedback({ kind: 'idle' });
    setWrongSquare(null);
    setHintLevel(0);
    setPending(null);
  };

  const loadPuzzle = useCallback((puzzle: Puzzle) => {
    resetUiState();
    spoiledRef.current = false;
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

  const tryMove = useCallback((from: Square, to: Square, promotion?: PieceSymbol): boolean => {
    const session = sessionRef.current;
    if (!session || pendingRef.current) return false;
    const result = session.submitMove(from, to, promotion);
    setSelected(null);

    switch (result.kind) {
      case 'illegal':
        return false;
      case 'needsPromotion':
        setPending({ from, to });
        return false;
      case 'wrong':
        setFeedback({ kind: 'wrong', san: result.san });
        setWrongSquare(to);
        playSound('wrong');
        later(() => setWrongSquare(null), WRONG_FLASH_MS);
        rerender();
        return false;
      case 'correct':
        setFeedback({ kind: 'correct', san: result.san });
        setHintLevel(0);
        playSound(cueForSan(result.san, session.inCheck));
        rerender();
        later(() => {
          const san = session.playOpponentReply();
          if (san) playSound(cueForSan(san, session.inCheck));
          rerender();
        }, OPPONENT_REPLY_DELAY_MS);
        return true;
      case 'solved':
        setFeedback({ kind: 'solved', san: result.san, counted: !spoiledRef.current });
        setHintLevel(0);
        playSound('solve');
        if (!spoiledRef.current) {
          postToExtension({
            type: 'puzzleSolved',
            puzzleId: session.puzzle.id,
            attemptId: attemptIdRef.current,
            mistakes: session.mistakes,
          });
        }
        rerender();
        return true;
    }
  }, []);

  const onSquareClick = useCallback(
    (square: Square) => {
      const session = sessionRef.current;
      if (!session?.isPlayerTurn || pendingRef.current) return;
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
    if (pendingRef.current) return;
    if (session?.pieceColorAt(square) === session?.playerColor) setSelected(square);
  }, []);

  const choosePromotion = useCallback(
    (piece: PieceSymbol) => {
      const pending = pendingRef.current;
      if (!pending) return;
      setPending(null);
      tryMove(pending.from, pending.to, piece);
    },
    [tryMove],
  );

  const cancelPromotion = useCallback(() => setPending(null), []);

  const reset = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    resetUiState();
    session.reset();
    rerender();
  }, []);

  const showHint = useCallback(() => {
    setHintLevel((level) => (level >= 2 ? 2 : ((level + 1) as 1 | 2)));
  }, []);

  const revealSolution = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.startReveal()) return;
    spoiledRef.current = true;
    setSelected(null);
    setHintLevel(0);
    setPending(null);
    setWrongSquare(null);
    postToExtension({
      type: 'puzzleFailed',
      puzzleId: session.puzzle.id,
      attemptId: attemptIdRef.current,
    });
    rerender();

    const step = () => {
      const last = session.pliesRemaining === 1;
      const san = session.playRevealPly();
      if (!san) {
        if (session.status === 'failed') setFeedback({ kind: 'failed' });
        rerender();
        return;
      }
      setFeedback({ kind: 'revealing', san });
      playSound(last ? 'reveal' : cueForSan(san, session.inCheck));
      rerender();
      later(step, REVEAL_PLY_DELAY_MS);
    };
    later(step, REVEAL_START_DELAY_MS);
  }, []);

  const nextPuzzle = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    clearTimers();
    postToExtension({ type: 'requestNextPuzzle', currentPuzzleId: session.puzzle.id });
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn(setSoundsEnabled(!areSoundsEnabled()));
  }, []);

  return {
    session: sessionRef.current,
    selected,
    feedback,
    wrongSquare,
    hintLevel,
    pendingPromotion,
    summary,
    soundOn,
    tryMove,
    onSquareClick,
    onPieceDragStart,
    clearSelection: () => setSelected(null),
    choosePromotion,
    cancelPromotion,
    reset,
    showHint,
    revealSolution,
    nextPuzzle,
    toggleSound,
  };
}
