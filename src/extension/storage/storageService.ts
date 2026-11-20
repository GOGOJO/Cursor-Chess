import { DIFFICULTY_BANDS } from '../../shared/difficulty';
import {
  applyAttempt,
  emptyProgress,
  MAX_HISTORY,
  snapshotProgress,
  type AttemptRecord,
  type AttemptState,
  type ProgressSnapshot,
  type ProgressState,
} from '../../shared/progression';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '../../shared/settings';
import { DEFAULT_FILTERS, type Puzzle, type PuzzleFilters } from '../../shared/types';

/** The subset of `vscode.Memento` we use, so the service can be tested without VS Code. */
export interface KeyValueStore {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
}

const LEGACY_SOLVED_COUNT_KEY = 'cursorChess.solvedCount';
const PROGRESS_KEY = 'cursorChess.progress';
const ACTIVE_ATTEMPT_KEY = 'cursorChess.activeAttempt';
const FILTERS_KEY = 'cursorChess.filters';
const RECENT_PUZZLES_KEY = 'cursorChess.recentPuzzleIds';
const SETTINGS_KEY = 'cursorChess.settings';
const MAX_RECENT_PUZZLES = 150;
const MAX_ATTEMPT_MOVES = 64;

export function sanitizeFilters(value: unknown): PuzzleFilters {
  if (!value || typeof value !== 'object') return { ...DEFAULT_FILTERS };
  const raw = value as Record<string, unknown>;
  const difficulty =
    raw.difficulty === 'any' || DIFFICULTY_BANDS.includes(raw.difficulty as never)
      ? (raw.difficulty as PuzzleFilters['difficulty'])
      : DEFAULT_FILTERS.difficulty;
  const theme = typeof raw.theme === 'string' && /^[A-Za-z0-9]{1,40}$/.test(raw.theme) ? raw.theme : DEFAULT_FILTERS.theme;
  return { difficulty, theme };
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 120;

export function sanitizeAttempt(value: unknown): AttemptState | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  if (!isString(a.attemptId) || !isString(a.puzzleId)) return null;
  if (!Array.isArray(a.playerMoves) || a.playerMoves.length > MAX_ATTEMPT_MOVES) return null;
  if (!a.playerMoves.every((m) => typeof m === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m))) return null;
  if (!isCount(a.mistakes) || !isCount(a.hints)) return null;
  return {
    attemptId: a.attemptId,
    puzzleId: a.puzzleId,
    playerMoves: a.playerMoves as string[],
    mistakes: Math.floor(a.mistakes),
    hints: Math.floor(a.hints),
    revealed: a.revealed === true,
    solved: a.solved === true,
  };
}

function isRecord(value: unknown): value is AttemptRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    isString(r.attemptId) &&
    isString(r.puzzleId) &&
    typeof r.puzzleRating === 'number' &&
    Array.isArray(r.themes) &&
    r.themes.every((t) => typeof t === 'string') &&
    typeof r.at === 'number' &&
    typeof r.won === 'boolean' &&
    typeof r.ratingBefore === 'number' &&
    typeof r.ratingAfter === 'number' &&
    typeof r.solved === 'boolean' &&
    typeof r.revealed === 'boolean' &&
    isCount(r.xp)
  );
}

export function sanitizeProgress(value: unknown, legacySolved: number): ProgressState {
  const fresh = emptyProgress(legacySolved);
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) return fresh;
  const raw = value as Record<string, unknown>;
  const count = (key: keyof ProgressState) => (isCount(raw[key]) ? (raw[key] as number) : (fresh[key] as number));
  return {
    version: 1,
    rating: count('rating'),
    highestRating: count('highestRating'),
    attempted: count('attempted'),
    wins: count('wins'),
    solved: count('solved'),
    currentStreak: count('currentStreak'),
    longestStreak: count('longestStreak'),
    dailyStreak: count('dailyStreak'),
    longestDailyStreak: count('longestDailyStreak'),
    lastSolvedDay: typeof raw.lastSolvedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.lastSolvedDay) ? raw.lastSolvedDay : null,
    totalXp: count('totalXp'),
    history: Array.isArray(raw.history) ? raw.history.filter(isRecord).slice(-MAX_HISTORY) : [],
  };
}

export class StorageService {
  private writes: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  getProgress(): ProgressState {
    return sanitizeProgress(this.store.get<unknown>(PROGRESS_KEY, undefined), this.store.get(LEGACY_SOLVED_COUNT_KEY, 0));
  }

  getSnapshot(): ProgressSnapshot {
    return snapshotProgress(this.getProgress(), this.now());
  }

  /**
   * Saves the attempt in progress and folds it into rating, XP, and streaks.
   * Returns true when progress changed. Repeated reports never double-count.
   */
  recordAttempt(attempt: AttemptState, puzzle: Puzzle): Promise<boolean> {
    return this.serialize(async () => {
      await this.store.update(ACTIVE_ATTEMPT_KEY, attempt);
      const next = applyAttempt(this.getProgress(), attempt, puzzle, this.now());
      if (!next) return false;
      await this.store.update(PROGRESS_KEY, next);
      return true;
    });
  }

  getActiveAttempt(): AttemptState | null {
    return sanitizeAttempt(this.store.get<unknown>(ACTIVE_ATTEMPT_KEY, undefined));
  }

  clearActiveAttempt(): Promise<void> {
    return this.serialize(() => this.store.update(ACTIVE_ATTEMPT_KEY, undefined));
  }

  /** Read-modify-write steps on progress run one at a time, in the order they were asked for. */
  private serialize<T>(step: () => Thenable<T> | Promise<T>): Promise<T> {
    const run = this.writes.then(step);
    this.writes = run.catch(() => undefined);
    return run;
  }

  getFilters(): PuzzleFilters {
    return sanitizeFilters(this.store.get<unknown>(FILTERS_KEY, DEFAULT_FILTERS));
  }

  async setFilters(filters: PuzzleFilters): Promise<PuzzleFilters> {
    const clean = sanitizeFilters(filters);
    await this.store.update(FILTERS_KEY, clean);
    return clean;
  }

  /** Puzzle ids shown recently, oldest first. */
  getRecentPuzzleIds(): string[] {
    return this.store.get<string[]>(RECENT_PUZZLES_KEY, []);
  }

  getSettings(): Settings {
    return sanitizeSettings(this.store.get<unknown>(SETTINGS_KEY, DEFAULT_SETTINGS));
  }

  setSettings(settings: Settings): Promise<Settings> {
    const clean = sanitizeSettings(settings);
    return this.serialize(async () => {
      await this.store.update(SETTINGS_KEY, clean);
      return clean;
    });
  }

  async recordPuzzleShown(puzzleId: string): Promise<void> {
    const recent = this.getRecentPuzzleIds().filter((id) => id !== puzzleId);
    await this.store.update(RECENT_PUZZLES_KEY, [...recent, puzzleId].slice(-MAX_RECENT_PUZZLES));
  }
}
