export const BOARD_THEME_IDS = ['sage', 'walnut', 'slate', 'contrast'] as const;
export type BoardThemeId = (typeof BOARD_THEME_IDS)[number];

export const PIECE_STYLES = ['standard', 'letters'] as const;
export type PieceStyleId = (typeof PIECE_STYLES)[number];

export interface Settings {
  sound: boolean;
  /** Slide pieces between squares. */
  animate: boolean;
  coordinates: boolean;
  /** Load another puzzle a moment after a solve. */
  autoNext: boolean;
  /** Quiet notice when an agent finishes. Read by the agent integration in the next phase. */
  notifyOnAgent: boolean;
  boardTheme: BoardThemeId;
  pieceStyle: PieceStyleId;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: false,
  animate: true,
  coordinates: true,
  autoNext: false,
  notifyOnAgent: true,
  boardTheme: 'sage',
  pieceStyle: 'standard',
};

export interface BoardPalette {
  name: string;
  light: string;
  dark: string;
  lastMove: string;
  selected: string;
  wrong: string;
  dot: string;
  hint: string;
  hintArrow: string;
}

export const BOARD_THEMES: Record<BoardThemeId, BoardPalette> = {
  sage: {
    name: 'Sage',
    light: '#e3d9c3',
    dark: '#7d8f68',
    lastMove: 'rgba(214, 186, 92, 0.45)',
    selected: 'rgba(143, 181, 115, 0.55)',
    wrong: 'rgba(205, 96, 80, 0.55)',
    dot: 'rgba(24, 25, 27, 0.32)',
    hint: '#c5e2ad',
    hintArrow: '#e2c56b',
  },
  walnut: {
    name: 'Walnut',
    light: '#f0d9b5',
    dark: '#b58863',
    lastMove: 'rgba(214, 168, 64, 0.5)',
    selected: 'rgba(196, 146, 74, 0.55)',
    wrong: 'rgba(196, 84, 66, 0.55)',
    dot: 'rgba(62, 36, 18, 0.4)',
    hint: '#f0d27a',
    hintArrow: '#e2b84a',
  },
  slate: {
    name: 'Slate',
    light: '#dee3ea',
    dark: '#6f7f90',
    lastMove: 'rgba(214, 186, 92, 0.5)',
    selected: 'rgba(120, 156, 186, 0.55)',
    wrong: 'rgba(205, 96, 80, 0.55)',
    dot: 'rgba(22, 28, 36, 0.4)',
    hint: '#d5e4b4',
    hintArrow: '#e2c56b',
  },
  contrast: {
    name: 'Contrast',
    light: '#f7f4ee',
    dark: '#2a2c2e',
    lastMove: 'rgba(214, 184, 90, 0.72)',
    selected: 'rgba(143, 181, 115, 0.7)',
    wrong: 'rgba(214, 92, 74, 0.72)',
    dot: 'rgba(214, 184, 90, 0.95)',
    hint: '#d6e7b8',
    hintArrow: '#e2c56b',
  },
};

const isTheme = (value: unknown): value is BoardThemeId => BOARD_THEME_IDS.includes(value as BoardThemeId);
const isPieceStyle = (value: unknown): value is PieceStyleId => PIECE_STYLES.includes(value as PieceStyleId);

export function sanitizeSettings(value: unknown): Settings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const bool = (key: keyof Settings, fallback: boolean) => (typeof raw[key] === 'boolean' ? (raw[key] as boolean) : fallback);
  return {
    sound: bool('sound', DEFAULT_SETTINGS.sound),
    animate: bool('animate', DEFAULT_SETTINGS.animate),
    coordinates: bool('coordinates', DEFAULT_SETTINGS.coordinates),
    autoNext: bool('autoNext', DEFAULT_SETTINGS.autoNext),
    notifyOnAgent: bool('notifyOnAgent', DEFAULT_SETTINGS.notifyOnAgent),
    boardTheme: isTheme(raw.boardTheme) ? raw.boardTheme : DEFAULT_SETTINGS.boardTheme,
    pieceStyle: isPieceStyle(raw.pieceStyle) ? raw.pieceStyle : DEFAULT_SETTINGS.pieceStyle,
  };
}
