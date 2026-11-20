export const STARTING_RATING = 1200;
export const RATING_FLOOR = 400;

/** Chance of solving a puzzle, by the Elo formula. */
export function expectedScore(playerRating: number, puzzleRating: number): number {
  return 1 / (1 + 10 ** ((puzzleRating - playerRating) / 400));
}

/** Big swings while the rating is still being found, smaller once it settles. */
export function kFactor(ratedAttempts: number): number {
  if (ratedAttempts < 10) return 40;
  if (ratedAttempts < 30) return 32;
  if (ratedAttempts < 100) return 24;
  return 16;
}

/**
 * The rating after one rated attempt. A win against a harder puzzle gains more,
 * and a loss against an easier one costs more. Never drops below the floor.
 */
export function nextRating(playerRating: number, puzzleRating: number, won: boolean, ratedAttempts: number): number {
  const delta = kFactor(ratedAttempts) * ((won ? 1 : 0) - expectedScore(playerRating, puzzleRating));
  return Math.max(RATING_FLOOR, Math.round(playerRating + delta));
}

/** XP for finishing a puzzle: more for harder puzzles, and half again for a clean solve. */
export function solveXp(puzzleRating: number, clean: boolean): number {
  const base = 8 + Math.max(0, puzzleRating - 600) / 100;
  return Math.round(base * (clean ? 1.5 : 1));
}
