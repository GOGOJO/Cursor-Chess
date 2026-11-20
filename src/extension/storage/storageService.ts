import { DIFFICULTY_BANDS } from '../../shared/difficulty';
import { DEFAULT_FILTERS, type PlayerSummary, type PuzzleFilters } from '../../shared/types';

/** The subset of `vscode.Memento` we use, so the service can be tested without VS Code. */
export interface KeyValueStore {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
}

const SOLVED_COUNT_KEY = 'cursorChess.solvedCount';
const RECENT_ATTEMPTS_KEY = 'cursorChess.recentAttemptIds';
const FILTERS_KEY = 'cursorChess.filters';
const RECENT_PUZZLES_KEY = 'cursorChess.recentPuzzleIds';
const MAX_RECENT_ATTEMPTS = 200;
const MAX_RECENT_PUZZLES = 150;

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

export class StorageService {
  constructor(private readonly store: KeyValueStore) {}

  getSummary(): PlayerSummary {
    return { solvedCount: this.store.get(SOLVED_COUNT_KEY, 0) };
  }

  /**
   * Records a solve once per attempt id. Returns false when the attempt was already
   * recorded (including a reveal), so a re-sent message can never double-count.
   */
  async recordSolve(attemptId: string): Promise<boolean> {
    if (!(await this.remember(attemptId))) return false;
    await this.store.update(SOLVED_COUNT_KEY, this.getSummary().solvedCount + 1);
    return true;
  }

  /**
   * Marks an attempt spent because the solution was revealed. A later solve of the
   * same attempt does not count.
   */
  async recordFailure(attemptId: string): Promise<boolean> {
    return this.remember(attemptId);
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

  async recordPuzzleShown(puzzleId: string): Promise<void> {
    const recent = this.getRecentPuzzleIds().filter((id) => id !== puzzleId);
    await this.store.update(RECENT_PUZZLES_KEY, [...recent, puzzleId].slice(-MAX_RECENT_PUZZLES));
  }

  private async remember(attemptId: string): Promise<boolean> {
    const recent = this.store.get<string[]>(RECENT_ATTEMPTS_KEY, []);
    if (recent.includes(attemptId)) return false;
    await this.store.update(RECENT_ATTEMPTS_KEY, [...recent, attemptId].slice(-MAX_RECENT_ATTEMPTS));
    return true;
  }
}
