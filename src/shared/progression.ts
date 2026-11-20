import { difficultyBand, type DifficultyBand } from './difficulty';
import { nextRating, solveXp, STARTING_RATING } from './rating';
import type { Puzzle } from './types';

/** The attempt in progress, as the webview reports it. Also what restart and resume replays. */
export interface AttemptState {
  attemptId: string;
  puzzleId: string;
  /** Moves the player found, in UCI, in order. */
  playerMoves: string[];
  mistakes: number;
  hints: number;
  revealed: boolean;
  solved: boolean;
}

/** One rated attempt in the history. */
export interface AttemptRecord {
  attemptId: string;
  puzzleId: string;
  puzzleRating: number;
  themes: string[];
  at: number;
  /** A clean solve with no mistakes or hints. Anything else is a loss. */
  won: boolean;
  ratingBefore: number;
  ratingAfter: number;
  solved: boolean;
  revealed: boolean;
  xp: number;
}

export interface ProgressState {
  version: 1;
  rating: number;
  highestRating: number;
  /** Rated attempts. */
  attempted: number;
  wins: number;
  /** Puzzles finished, including ones solved after a mistake. */
  solved: number;
  currentStreak: number;
  longestStreak: number;
  dailyStreak: number;
  longestDailyStreak: number;
  lastSolvedDay: string | null;
  totalXp: number;
  /** Oldest first. */
  history: AttemptRecord[];
}

export interface ThemeStat {
  theme: string;
  attempted: number;
  wins: number;
}

export interface ProgressSnapshot {
  rating: number;
  highestRating: number;
  band: DifficultyBand;
  attempted: number;
  wins: number;
  solved: number;
  /** Share of rated attempts solved cleanly, or null before the first one. */
  accuracy: number | null;
  currentStreak: number;
  longestStreak: number;
  /** Zero once a day has been missed. */
  dailyStreak: number;
  longestDailyStreak: number;
  totalXp: number;
  /** Newest first. */
  recent: AttemptRecord[];
  /** Rating before the first attempt shown, then after each one, oldest first. */
  ratingSeries: number[];
  topThemes: ThemeStat[];
}

export const MAX_HISTORY = 200;
const RECENT_COUNT = 20;
const SERIES_COUNT = 60;
const TOP_THEME_COUNT = 4;

/** Lichess tags that describe length, phase, or evaluation rather than a tactic. */
const NON_TACTIC_THEMES = new Set([
  'crushing',
  'advantage',
  'equality',
  'long',
  'short',
  'veryLong',
  'oneMove',
  'master',
  'masterVsMaster',
  'superGM',
  'opening',
  'middlegame',
  'endgame',
  'mate',
]);

export function emptyProgress(legacySolved = 0): ProgressState {
  return {
    version: 1,
    rating: STARTING_RATING,
    highestRating: STARTING_RATING,
    attempted: 0,
    wins: 0,
    solved: legacySolved,
    currentStreak: 0,
    longestStreak: 0,
    dailyStreak: 0,
    longestDailyStreak: 0,
    lastSolvedDay: null,
    totalXp: 0,
    history: [],
  };
}

/** `YYYY-MM-DD` in local time. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y!, m! - 1, d! - 1, 12));
}

function isFlawed(attempt: AttemptState): boolean {
  return attempt.mistakes > 0 || attempt.hints > 0 || attempt.revealed;
}

/**
 * Folds the latest report of an attempt into the progress state. Safe to call with
 * the same report any number of times: the attempt is rated once, when its outcome
 * is first known (the first mistake, hint, or reveal is a loss; a clean solve is a
 * win), and XP is given once, when it is first solved. Returns null when nothing changed.
 */
export function applyAttempt(state: ProgressState, attempt: AttemptState, puzzle: Puzzle, now: Date): ProgressState | null {
  if (attempt.puzzleId !== puzzle.id) return null;
  const index = state.history.findIndex((r) => r.attemptId === attempt.attemptId);
  let next: ProgressState | null = null;
  let record = index >= 0 ? state.history[index]! : null;

  if (!record) {
    if (!isFlawed(attempt) && !attempt.solved) return null;
    const won = attempt.solved && !isFlawed(attempt);
    const ratingAfter = nextRating(state.rating, puzzle.rating, won, state.attempted);
    record = {
      attemptId: attempt.attemptId,
      puzzleId: puzzle.id,
      puzzleRating: puzzle.rating,
      themes: puzzle.themes,
      at: now.getTime(),
      won,
      ratingBefore: state.rating,
      ratingAfter,
      solved: false,
      revealed: false,
      xp: 0,
    };
    const currentStreak = won ? state.currentStreak + 1 : 0;
    next = {
      ...state,
      rating: ratingAfter,
      highestRating: Math.max(state.highestRating, ratingAfter),
      attempted: state.attempted + 1,
      wins: state.wins + (won ? 1 : 0),
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
      history: [...state.history, record].slice(-MAX_HISTORY),
    };
  }

  const base = next ?? state;
  const replace = (updated: AttemptRecord) => base.history.map((r) => (r.attemptId === updated.attemptId ? updated : r));

  if (attempt.solved && !record.solved && !record.revealed) {
    const xp = solveXp(puzzle.rating, record.won);
    const today = dayKey(now);
    let { dailyStreak, lastSolvedDay } = base;
    if (lastSolvedDay !== today) {
      dailyStreak = lastSolvedDay === previousDay(today) ? dailyStreak + 1 : 1;
      lastSolvedDay = today;
    }
    record = { ...record, solved: true, xp };
    next = {
      ...base,
      solved: base.solved + 1,
      totalXp: base.totalXp + xp,
      dailyStreak,
      longestDailyStreak: Math.max(base.longestDailyStreak, dailyStreak),
      lastSolvedDay,
      history: replace(record),
    };
  } else if (attempt.revealed && !record.revealed && !record.solved) {
    record = { ...record, revealed: true };
    next = { ...base, history: replace(record) };
  }

  return next;
}

export function topThemes(history: readonly AttemptRecord[], count = TOP_THEME_COUNT): ThemeStat[] {
  const stats = new Map<string, ThemeStat>();
  for (const record of history) {
    for (const theme of record.themes) {
      if (NON_TACTIC_THEMES.has(theme)) continue;
      const stat = stats.get(theme) ?? { theme, attempted: 0, wins: 0 };
      stat.attempted += 1;
      if (record.won) stat.wins += 1;
      stats.set(theme, stat);
    }
  }
  return [...stats.values()]
    .sort((a, b) => b.attempted - a.attempted || b.wins - a.wins || a.theme.localeCompare(b.theme))
    .slice(0, count);
}

export function snapshotProgress(state: ProgressState, now: Date): ProgressSnapshot {
  const today = dayKey(now);
  const streakAlive = state.lastSolvedDay === today || state.lastSolvedDay === previousDay(today);
  const series = state.history.slice(-SERIES_COUNT);
  return {
    rating: state.rating,
    highestRating: state.highestRating,
    band: difficultyBand(state.rating),
    attempted: state.attempted,
    wins: state.wins,
    solved: state.solved,
    accuracy: state.attempted > 0 ? state.wins / state.attempted : null,
    currentStreak: state.currentStreak,
    longestStreak: state.longestStreak,
    dailyStreak: streakAlive ? state.dailyStreak : 0,
    longestDailyStreak: state.longestDailyStreak,
    totalXp: state.totalXp,
    recent: state.history.slice(-RECENT_COUNT).reverse(),
    ratingSeries: series.length > 0 ? [series[0]!.ratingBefore, ...series.map((r) => r.ratingAfter)] : [state.rating],
    topThemes: topThemes(state.history),
  };
}
