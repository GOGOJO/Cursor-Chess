import type { PlayerSummary } from '../../shared/types';

/** The subset of `vscode.Memento` we use, so the service can be tested without VS Code. */
export interface KeyValueStore {
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: unknown): Thenable<void>;
}

const SOLVED_COUNT_KEY = 'cursorChess.solvedCount';
const RECENT_ATTEMPTS_KEY = 'cursorChess.recentAttemptIds';
const MAX_RECENT_ATTEMPTS = 200;

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

  private async remember(attemptId: string): Promise<boolean> {
    const recent = this.store.get<string[]>(RECENT_ATTEMPTS_KEY, []);
    if (recent.includes(attemptId)) return false;
    await this.store.update(RECENT_ATTEMPTS_KEY, [...recent, attemptId].slice(-MAX_RECENT_ATTEMPTS));
    return true;
  }
}
