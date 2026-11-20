export type DifficultyBand = 'Beginner' | 'Easy' | 'Intermediate' | 'Advanced' | 'Expert';

export function difficultyBand(rating: number): DifficultyBand {
  if (rating < 800) return 'Beginner';
  if (rating < 1200) return 'Easy';
  if (rating < 1600) return 'Intermediate';
  if (rating < 2000) return 'Advanced';
  return 'Expert';
}
