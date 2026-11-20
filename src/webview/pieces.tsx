import type { PieceRenderObject } from 'react-chessboard';

const LETTER: Record<string, string> = { K: 'K', Q: 'Q', R: 'R', B: 'B', N: 'N', P: 'P' };

function letterPiece(code: string): PieceRenderObject[string] {
  const white = code.startsWith('w');
  const letter = LETTER[code.slice(1)] ?? '?';
  return ({ svgStyle } = {}) => (
    <svg viewBox="0 0 40 40" style={svgStyle}>
      <circle cx="20" cy="21" r="15" fill={white ? '#f4efe6' : '#232426'} stroke={white ? '#2c2e30' : '#efe8da'} strokeWidth="1.5" />
      <text
        x="20"
        y="26.5"
        textAnchor="middle"
        fontSize="16"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fill={white ? '#232426' : '#f4efe6'}
      >
        {letter}
      </text>
    </svg>
  );
}

/** High-contrast letters, easier to tell apart than shaped pieces at sidebar size. */
export const LETTER_PIECES: PieceRenderObject = Object.fromEntries(
  ['w', 'b'].flatMap((color) => Object.keys(LETTER).map((piece) => [`${color}${piece}`, letterPiece(`${color}${piece}`)])),
);
