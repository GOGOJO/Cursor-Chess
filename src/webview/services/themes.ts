const THEME_LABELS: Record<string, string> = {
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discoveredAttack: 'Discovered attack',
  doubleCheck: 'Double check',
  deflection: 'Deflection',
  backRankMate: 'Back-rank mate',
  hangingPiece: 'Hanging piece',
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  mate: 'Checkmate',
  sacrifice: 'Sacrifice',
  trappedPiece: 'Trapped piece',
  attraction: 'Attraction',
  promotion: 'Promotion',
  endgame: 'Endgame',
  middlegame: 'Middlegame',
  opening: 'Opening',
};

/** Lichess tags that describe puzzle length or evaluation rather than the tactic. */
const META_THEMES = new Set(['crushing', 'advantage', 'equality', 'long', 'short', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM']);

export function displayThemes(themes: string[]): string[] {
  const tactical = themes.filter((t) => !META_THEMES.has(t));
  return tactical.map((t) => THEME_LABELS[t] ?? t.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()));
}
