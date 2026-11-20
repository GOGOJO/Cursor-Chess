import type { PieceSymbol, Square } from 'chess.js';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AttemptRecord, AttemptState, ProgressSnapshot } from '../../shared/progression';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../../shared/settings';
import type { LibraryInfo, Puzzle, PuzzleFilters } from '../../shared/types';
import { PuzzleSession } from '../services/chessService';
import { areSoundsEnabled, playSound, setSoundsEnabled, type SoundCue } from '../services/soundService';
import { onExtensionMessage, postToExtension } from '../vscode';

export type Feedback =
  | { kind: 'idle' }
  | { kind: 'correct'; san: string }
  | { kind: 'wrong'; san: string }
  | { kind: 'revealing'; san: string }
  | { kind: 'solved' }
  | { kind: 'failed' };

export interface PendingPromotion {
  from: Square;
  to: Square;
}

const AUTO_NEXT_DELAY_MS = 1500;
const OPPONENT_REPLY_DELAY_MS = 450;
const REVEAL_START_DELAY_MS = 280;
const REVEAL_PLY_DELAY_MS = 560;
const WRONG_FLASH_MS = 650;

function newAttempt(puzzleId: string): AttemptState {
  const attemptId = `${puzzleId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  return { attemptId, puzzleId, playerMoves: [], mistakes: 0, hints: 0, revealed: false, solved: false };
}

function cueForSan(san: string, inCheck: boolean): SoundCue {
  if (inCheck) return 'check';
  if (san.includes('x')) return 'capture';
  return 'move';
}

export function usePuzzle() {
  const sessionRef = useRef<PuzzleSession | null>(null);
  const attemptRef = useRef<AttemptState | null>(null);
  const pendingRef = useRef<PendingPromotion | null>(null);
  const hintLevelRef = useRef<0 | 1 | 2>(0);
  const timersRef = useRef<number[]>([]);
  const autoNextRef = useRef<number | null>(null);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [selected, setSelected] = useState<Square | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  const [wrongSquare, setWrongSquare] = useState<Square | null>(null);
  const [hintLevel, setHintLevelState] = useState<0 | 1 | 2>(0);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [progress, setProgress] = useState<ProgressSnapshot | null>(null);
  const [library, setLibrary] = useState<LibraryInfo | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };
  const cancelAutoNext = () => {
    if (autoNextRef.current !== null) {
      window.clearTimeout(autoNextRef.current);
      autoNextRef.current = null;
    }
  };
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };
  const setPending = (value: PendingPromotion | null) => {
    pendingRef.current = value;
    setPendingPromotion(value);
  };
  const setHintLevel = (level: 0 | 1 | 2) => {
    hintLevelRef.current = level;
    setHintLevelState(level);
  };

  /** Applies a change to the attempt and tells the extension, which persists and rates it. */
  const updateAttempt = (change: (attempt: AttemptState) => AttemptState) => {
    if (!attemptRef.current) return;
    attemptRef.current = change(attemptRef.current);
    postToExtension({ type: 'attempt', attempt: attemptRef.current });
  };

  const resetUiState = () => {
    clearTimers();
    setSelected(null);
    setFeedback({ kind: 'idle' });
    setWrongSquare(null);
    setHintLevel(0);
    setPending(null);
  };

  const loadPuzzle = useCallback((puzzle: Puzzle, resume?: AttemptState) => {
    resetUiState();
    const session = new PuzzleSession(puzzle);
    sessionRef.current = session;
    if (resume?.puzzleId === puzzle.id && session.restore(resume.playerMoves, resume.mistakes, resume.revealed)) {
      attemptRef.current = resume;
      if (session.status === 'solved') setFeedback({ kind: 'solved' });
      else if (session.status === 'failed') setFeedback({ kind: 'failed' });
    } else {
      attemptRef.current = newAttempt(puzzle.id);
    }
    rerender();
  }, []);

  useEffect(() => {
    const unsubscribe = onExtensionMessage((message) => {
      if (message.type === 'loadPuzzle') {
        loadPuzzle(message.puzzle, message.resume);
        setNotice(message.notice ?? null);
      } else if (message.type === 'progress') {
        setProgress(message.progress);
      } else if (message.type === 'library') {
        setLibrary(message.library);
      } else if (message.type === 'settings') {
        const next = sanitizeSettings(message.settings);
        settingsRef.current = next;
        setSettings(next);
        setSoundsEnabled(next.sound);
      }
    });
    postToExtension({ type: 'ready' });
    return () => {
      unsubscribe();
      clearTimers();
      cancelAutoNext();
    };
  }, [loadPuzzle]);

  const tryMove = useCallback((from: Square, to: Square, promotion?: PieceSymbol): boolean => {
    const session = sessionRef.current;
    if (!session || pendingRef.current) return false;
    const result = session.submitMove(from, to, promotion);
    setSelected(null);
    const uci = `${from}${to}${promotion ?? ''}`;

    switch (result.kind) {
      case 'illegal':
        return false;
      case 'needsPromotion':
        setPending({ from, to });
        return false;
      case 'wrong':
        updateAttempt((a) => ({ ...a, mistakes: a.mistakes + 1 }));
        setFeedback({ kind: 'wrong', san: result.san });
        setWrongSquare(to);
        playSound('wrong');
        later(() => setWrongSquare(null), WRONG_FLASH_MS);
        rerender();
        return false;
      case 'correct':
        updateAttempt((a) => ({ ...a, playerMoves: [...a.playerMoves, uci] }));
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
        updateAttempt((a) => ({ ...a, playerMoves: [...a.playerMoves, uci], solved: true }));
        setFeedback({ kind: 'solved' });
        setHintLevel(0);
        playSound('solve');
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

  /** Back to the start position. The attempt keeps its mistakes and hints, so its rating stands. */
  const reset = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    resetUiState();
    session.reset();
    if (attemptRef.current && !attemptRef.current.solved && !attemptRef.current.revealed) {
      updateAttempt((a) => ({ ...a, playerMoves: [] }));
    }
    rerender();
  }, []);

  const showHint = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.isPlayerTurn || hintLevelRef.current >= 2) return;
    setHintLevel((hintLevelRef.current + 1) as 1 | 2);
    updateAttempt((a) => ({ ...a, hints: a.hints + 1 }));
  }, []);

  const revealSolution = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.startReveal()) return;
    setSelected(null);
    setHintLevel(0);
    setPending(null);
    setWrongSquare(null);
    updateAttempt((a) => ({ ...a, revealed: true }));
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
    cancelAutoNext();
    clearTimers();
    postToExtension({ type: 'requestNextPuzzle', currentPuzzleId: session.puzzle.id });
  }, []);

  useEffect(() => {
    cancelAutoNext();
    if (feedback.kind !== 'solved' || !settings.autoNext) return;
    autoNextRef.current = window.setTimeout(() => {
      autoNextRef.current = null;
      nextPuzzle();
    }, AUTO_NEXT_DELAY_MS);
    return cancelAutoNext;
  }, [feedback.kind, settings.autoNext, nextPuzzle]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    const next = sanitizeSettings({ ...settingsRef.current, ...patch });
    settingsRef.current = next;
    setSettings(next);
    setSoundsEnabled(next.sound);
    postToExtension({ type: 'setSettings', settings: next });
  }, []);

  const toggleSound = useCallback(() => {
    updateSettings({ sound: !areSoundsEnabled() });
  }, [updateSettings]);

  const setFilters = useCallback((filters: PuzzleFilters) => {
    clearTimers();
    setLibrary((current) => (current ? { ...current, filters } : current));
    postToExtension({ type: 'setFilters', filters });
  }, []);

  const importPuzzles = useCallback(() => postToExtension({ type: 'importPuzzles' }), []);

  const attempt = attemptRef.current;
  const result: AttemptRecord | null = (attempt && progress?.recent.find((r) => r.attemptId === attempt.attemptId)) || null;

  return {
    session: sessionRef.current,
    attempt,
    result,
    selected,
    feedback,
    wrongSquare,
    hintLevel,
    pendingPromotion,
    progress,
    library,
    notice,
    settings,
    updateSettings,
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
    setFilters,
    importPuzzles,
  };
}
