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
  underPromotion: 'Underpromotion',
  smotheredMate: 'Smothered mate',
  exposedKing: 'Exposed king',
  xRayAttack: 'X-ray',
  capturingDefender: 'Remove the defender',
  advancedPawn: 'Advanced pawn',
  quietMove: 'Quiet move',
  intermezzo: 'Intermezzo',
  kingsideAttack: 'Kingside attack',
  queensideAttack: 'Queenside attack',
  clearance: 'Clearance',
  interference: 'Interference',
  zugzwang: 'Zugzwang',
  endgame: 'Endgame',
  middlegame: 'Middlegame',
  opening: 'Opening',
};

/** The tactics offered in the theme filter, in display order. */
export const FILTER_THEMES: readonly string[] = [
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleCheck',
  'deflection',
  'backRankMate',
  'hangingPiece',
  'mateIn1',
  'mateIn2',
];

/** Lichess tags that describe puzzle length or evaluation rather than the tactic. */
const META_THEMES = new Set(['crushing', 'advantage', 'equality', 'long', 'short', 'veryLong', 'oneMove', 'master', 'masterVsMaster', 'superGM']);
const PHASE_THEMES = new Set(['opening', 'middlegame', 'endgame']);

export function themeLabel(theme: string): string {
  return THEME_LABELS[theme] ?? theme.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

export function displayThemes(themes: string[]): string[] {
  const tactical = themes.filter((t) => !META_THEMES.has(t) && !PHASE_THEMES.has(t));
  const phase = themes.filter((t) => PHASE_THEMES.has(t));
  return [...tactical, ...phase].slice(0, 3).map(themeLabel);
}
