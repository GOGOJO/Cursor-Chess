/**
 * A puzzle in Lichess database format. `fen` is the position *before* the
 * opponent's setup move; `moves[0]` is that setup move and the player's
 * solution starts at `moves[1]`. Moves are UCI (e.g. `e2e4`, `e7e8q`).
 */
export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  gameUrl?: string;
}

export interface PlayerSummary {
  solvedCount: number;
}
