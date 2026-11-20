import { describe, expect, it } from 'vitest';
import {
  applyAttempt,
  dayKey,
  emptyProgress,
  MAX_HISTORY,
  previousDay,
  snapshotProgress,
  topThemes,
  type AttemptRecord,
  type AttemptState,
  type ProgressState,
} from '../src/shared/progression';
import { expectedScore, kFactor, nextRating, RATING_FLOOR, solveXp, STARTING_RATING } from '../src/shared/rating';
import { SAMPLE_PUZZLES } from '../src/shared/samplePuzzles';
import { themeLabel } from '../src/shared/themes';
import type { Puzzle } from '../src/shared/types';
import { parseUci, PuzzleSession } from '../src/webview/services/chessService';

const day = (iso: string) => new Date(`${iso}T12:00:00`);

const puzzle = (rating: number, themes = ['fork', 'middlegame']): Puzzle => ({
  ...SAMPLE_PUZZLES[0]!,
  id: `p${rating}`,
  rating,
  themes,
});

let counter = 0;
const attempt = (p: Puzzle, overrides: Partial<AttemptState> = {}): AttemptState => ({
  attemptId: `a${++counter}`,
  puzzleId: p.id,
  playerMoves: [],
  mistakes: 0,
  hints: 0,
  revealed: false,
  solved: false,
  ...overrides,
});

/** Applies an attempt that is expected to change progress. */
function apply(state: ProgressState, a: AttemptState, p: Puzzle, now = day('2026-11-19')): ProgressState {
  const next = applyAttempt(state, a, p, now);
  expect(next).not.toBeNull();
  return next!;
}

describe('rating', () => {
  it('expects an even score against an equal rating and favours the stronger side', () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11);
    expect(expectedScore(1500, 1900)).toBeCloseTo(1 / 11);
  });

  it('settles the K-factor as more puzzles are rated', () => {
    expect([0, 9, 10, 29, 30, 99, 100, 5000].map(kFactor)).toEqual([40, 40, 32, 32, 24, 24, 16, 16]);
  });

  it('moves the rating by K times the surprise, with a floor', () => {
    expect(nextRating(1200, 1200, true, 0)).toBe(1220);
    expect(nextRating(1200, 1200, false, 0)).toBe(1180);
    expect(nextRating(1200, 1200, true, 200)).toBe(1208);
    expect(nextRating(1200, 2400, true, 0)).toBeGreaterThan(1235);
    expect(nextRating(1200, 400, false, 0)).toBeLessThan(1165);
    expect(nextRating(RATING_FLOOR, 2000, false, 0)).toBe(RATING_FLOOR);
  });

  it('gives more XP for harder puzzles and a bonus for a clean solve', () => {
    expect(solveXp(600, false)).toBe(8);
    expect(solveXp(1600, false)).toBe(18);
    expect(solveXp(1600, true)).toBe(27);
    expect(solveXp(300, true)).toBe(12);
  });
});

describe('applyAttempt', () => {
  it('does nothing until the outcome is known', () => {
    const p = puzzle(1200);
    expect(applyAttempt(emptyProgress(), attempt(p, { playerMoves: ['e2e4'] }), p, day('2026-11-19'))).toBeNull();
  });

  it('rates a clean solve as a win and pays XP once', () => {
    const p = puzzle(1500);
    const a = attempt(p, { solved: true });
    const state = apply(emptyProgress(), a, p);
    expect(state).toMatchObject({ attempted: 1, wins: 1, solved: 1, currentStreak: 1, totalXp: solveXp(1500, true) });
    expect(state.rating).toBeGreaterThan(STARTING_RATING);
    expect(state.highestRating).toBe(state.rating);
    expect(state.history[0]).toMatchObject({ attemptId: a.attemptId, won: true, solved: true, ratingBefore: 1200 });
    expect(applyAttempt(state, a, p, day('2026-11-19'))).toBeNull();
  });

  it('rates the first mistake as a loss, then still pays reduced XP for the solve', () => {
    const p = puzzle(1500);
    const missed = apply(emptyProgress(), attempt(p, { attemptId: 'm', mistakes: 1 }), p);
    expect(missed).toMatchObject({ attempted: 1, wins: 0, solved: 0, totalXp: 0 });
    expect(missed.rating).toBeLessThan(STARTING_RATING);

    expect(applyAttempt(missed, attempt(p, { attemptId: 'm', mistakes: 3 }), p, day('2026-11-19'))).toBeNull();

    const solved = apply(missed, attempt(p, { attemptId: 'm', mistakes: 3, solved: true }), p);
    expect(solved.rating).toBe(missed.rating);
    expect(solved).toMatchObject({ attempted: 1, solved: 1, totalXp: solveXp(1500, false), currentStreak: 0 });
    expect(solved.history).toHaveLength(1);
  });

  it('counts a hint as a miss', () => {
    const p = puzzle(1200);
    const state = apply(emptyProgress(), attempt(p, { hints: 1, solved: true }), p);
    expect(state).toMatchObject({ wins: 0, solved: 1 });
    expect(state.history[0]!.won).toBe(false);
  });

  it('rates a reveal as a loss with no XP, and a reveal after a mistake changes nothing more', () => {
    const p = puzzle(1200);
    const revealed = apply(emptyProgress(), attempt(p, { attemptId: 'r', revealed: true }), p);
    expect(revealed).toMatchObject({ attempted: 1, solved: 0, totalXp: 0 });
    expect(revealed.history[0]).toMatchObject({ revealed: true, solved: false });
    expect(applyAttempt(revealed, attempt(p, { attemptId: 'r', revealed: true, solved: true }), p, day('2026-11-19'))).toBeNull();

    const missed = apply(emptyProgress(), attempt(p, { attemptId: 'x', mistakes: 1 }), p);
    const thenRevealed = apply(missed, attempt(p, { attemptId: 'x', mistakes: 1, revealed: true }), p);
    expect(thenRevealed.rating).toBe(missed.rating);
    expect(thenRevealed.history[0]!.revealed).toBe(true);
  });

  it('ignores an attempt for a different puzzle', () => {
    const p = puzzle(1200);
    expect(applyAttempt(emptyProgress(), attempt(puzzle(1300), { solved: true }), p, day('2026-11-19'))).toBeNull();
  });

  it('tracks the solve streak and the best rating', () => {
    const p = puzzle(1200);
    let state = emptyProgress();
    for (let i = 0; i < 3; i++) state = apply(state, attempt(p, { solved: true }), p);
    const peak = state.rating;
    state = apply(state, attempt(p, { mistakes: 1 }), p);
    state = apply(state, attempt(p, { solved: true }), p);
    expect(state).toMatchObject({ currentStreak: 1, longestStreak: 3, highestRating: peak });
    expect(state.rating).toBeLessThan(peak);
  });

  it('counts days in a row with a solve, and restarts after a gap', () => {
    const p = puzzle(1200);
    let state = emptyProgress();
    state = apply(state, attempt(p, { solved: true }), p, day('2026-02-27'));
    state = apply(state, attempt(p, { solved: true }), p, day('2026-02-27'));
    expect(state.dailyStreak).toBe(1);
    state = apply(state, attempt(p, { solved: true }), p, day('2026-02-28'));
    state = apply(state, attempt(p, { solved: true }), p, day('2026-03-01'));
    expect(state).toMatchObject({ dailyStreak: 3, longestDailyStreak: 3, lastSolvedDay: '2026-03-01' });

    state = apply(state, attempt(p, { revealed: true }), p, day('2026-03-02'));
    expect(state.dailyStreak).toBe(3);
    state = apply(state, attempt(p, { solved: true }), p, day('2026-03-04'));
    expect(state).toMatchObject({ dailyStreak: 1, longestDailyStreak: 3 });
  });

  it('keeps the history bounded', () => {
    const p = puzzle(1200);
    let state = emptyProgress();
    for (let i = 0; i < MAX_HISTORY + 15; i++) state = apply(state, attempt(p, { solved: true }), p);
    expect(state.history).toHaveLength(MAX_HISTORY);
    expect(state.attempted).toBe(MAX_HISTORY + 15);
  });
});

describe('days', () => {
  it('uses local calendar days across month and year ends', () => {
    expect(dayKey(day('2026-11-19'))).toBe('2026-11-19');
    expect(previousDay('2026-03-01')).toBe('2026-02-28');
    expect(previousDay('2024-03-01')).toBe('2024-02-29');
    expect(previousDay('2027-01-01')).toBe('2026-12-31');
  });
});

describe('snapshotProgress', () => {
  it('starts at 1200 with nothing to show', () => {
    expect(snapshotProgress(emptyProgress(), day('2026-11-19'))).toMatchObject({
      rating: 1200,
      band: 'Intermediate',
      accuracy: null,
      recent: [],
      ratingSeries: [1200],
      topThemes: [],
    });
  });

  it('summarises accuracy, recent history, and the rating series', () => {
    const p = puzzle(1200);
    let state = emptyProgress();
    state = apply(state, attempt(p, { attemptId: 'w1', solved: true }), p);
    state = apply(state, attempt(p, { attemptId: 'l1', mistakes: 1 }), p);
    state = apply(state, attempt(p, { attemptId: 'w2', solved: true }), p);
    const snap = snapshotProgress(state, day('2026-11-19'));
    expect(snap.accuracy).toBeCloseTo(2 / 3);
    expect(snap.recent.map((r) => r.attemptId)).toEqual(['w2', 'l1', 'w1']);
    expect(snap.ratingSeries).toEqual([1200, ...state.history.map((r) => r.ratingAfter)]);
    expect(snap.ratingSeries.at(-1)).toBe(snap.rating);
  });

  it('shows a broken daily streak as zero but keeps the best', () => {
    const p = puzzle(1200);
    const state = apply(emptyProgress(), attempt(p, { solved: true }), p, day('2026-11-10'));
    expect(snapshotProgress(state, day('2026-11-11')).dailyStreak).toBe(1);
    expect(snapshotProgress(state, day('2026-11-13'))).toMatchObject({ dailyStreak: 0, longestDailyStreak: 1 });
  });
});

describe('topThemes', () => {
  const record = (themes: string[], won: boolean) => ({ themes, won }) as AttemptRecord;

  it('ranks tactics by how often they come up and skips phase and length tags', () => {
    const history = [
      record(['fork', 'middlegame', 'short'], true),
      record(['fork', 'pin'], false),
      record(['pin', 'endgame'], true),
      record(['fork'], true),
      record(['mateIn2', 'mate'], false),
    ];
    expect(topThemes(history)).toEqual([
      { theme: 'fork', attempted: 3, wins: 2 },
      { theme: 'pin', attempted: 2, wins: 1 },
      { theme: 'mateIn2', attempted: 1, wins: 0 },
    ]);
  });

  it('labels unlisted Lichess themes in sentence case like the listed ones', () => {
    expect(themeLabel('discoveredCheck')).toBe('Discovered check');
    expect(themeLabel('mateIn6')).toBe('Mate in 6');
    expect(themeLabel('fork')).toBe('Fork');
  });
});

describe('PuzzleSession.restore', () => {
  const multiMove = SAMPLE_PUZZLES.find((p) => p.moves.length >= 4)!;
  const solution = multiMove.moves.filter((_, i) => i % 2 === 1);

  it('replays found moves and the replies, then carries on from there', () => {
    const session = new PuzzleSession(multiMove);
    expect(session.restore(solution.slice(0, 1), 2, false)).toBe(true);
    expect(session.status).toBe('playing');
    expect(session.mistakes).toBe(2);
    expect(session.isPlayerTurn).toBe(true);
    expect(session.playerMovesMade).toBe(1);

    const fresh = new PuzzleSession(multiMove);
    const { from, to, promotion } = parseUci(solution[0]!);
    fresh.submitMove(from, to, promotion);
    fresh.playOpponentReply();
    expect(session.fen).toBe(fresh.fen);
  });

  it('restores a solved attempt as solved and a revealed one at the end of the line', () => {
    const solved = new PuzzleSession(multiMove);
    expect(solved.restore(solution, 0, false)).toBe(true);
    expect(solved.status).toBe('solved');

    const revealed = new PuzzleSession(multiMove);
    expect(revealed.restore(solution.slice(0, 1), 1, true)).toBe(true);
    expect(revealed.status).toBe('failed');
    expect(revealed.pliesRemaining).toBe(0);
  });

  it('refuses moves that are not the solution and leaves a fresh start', () => {
    const session = new PuzzleSession(multiMove);
    const startFen = session.fen;
    expect(session.restore(['a1a1'], 0, false)).toBe(false);
    expect(session.restore([solution[1] ?? 'h7h8'], 0, false)).toBe(false);
    expect(session.fen).toBe(startFen);
    expect(session.status).toBe('playing');
  });
});