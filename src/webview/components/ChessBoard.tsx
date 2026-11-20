import type { PieceSymbol, Square } from 'chess.js';
import type { CSSProperties } from 'react';
import { Chessboard, defaultArrowOptions } from 'react-chessboard';
import type { BoardPalette, PieceStyleId } from '../../shared/settings';
import { LETTER_PIECES } from '../pieces';
import type { HintMove, PuzzleSession } from '../services/chessService';
import { PromotionPicker } from './PromotionPicker';

interface ChessBoardProps {
  session: PuzzleSession;
  selected: Square | null;
  wrongSquare: Square | null;
  hintSquare: Square | null;
  hintArrow: HintMove | null;
  revealing: boolean;
  promotion: boolean;
  palette: BoardPalette;
  pieceStyle: PieceStyleId;
  motion: boolean;
  coordinates: boolean;
  solved: boolean;
  onMove: (from: Square, to: Square) => boolean;
  onSquareClick: (square: Square) => void;
  onPieceDragStart: (square: Square) => void;
  onDragCancel: () => void;
  onPromote: (piece: PieceSymbol) => void;
  onCancelPromotion: () => void;
}

function buildSquareStyles({
  session,
  selected,
  wrongSquare,
  hintSquare,
  palette,
}: Pick<ChessBoardProps, 'session' | 'selected' | 'wrongSquare' | 'hintSquare' | 'palette'>): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};
  const merge = (square: string, style: CSSProperties) => {
    styles[square] = { ...styles[square], ...style };
  };

  const last = session.lastMove;
  if (last) {
    merge(last.from, { backgroundColor: palette.lastMove });
    merge(last.to, { backgroundColor: palette.lastMove });
  }

  const checked = session.checkedKingSquare;
  if (checked) {
    merge(checked, {
      backgroundImage:
        'radial-gradient(circle, rgba(232, 92, 70, 0.95) 0%, rgba(214, 72, 56, 0.55) 38%, rgba(214, 72, 56, 0) 72%)',
    });
  }

  if (hintSquare) {
    merge(hintSquare, { boxShadow: `inset 0 0 0 3px ${palette.hint}`, backgroundColor: 'rgba(214, 184, 90, 0.28)' });
  }

  if (selected) {
    merge(selected, { backgroundColor: palette.selected });
    for (const target of session.legalTargets(selected)) {
      merge(target, {
        backgroundImage: session.isCapture(selected, target)
          ? `radial-gradient(circle, transparent 58%, ${palette.dot} 60%, ${palette.dot} 72%, transparent 74%)`
          : `radial-gradient(circle, ${palette.dot} 0%, ${palette.dot} 17%, transparent 19%)`,
        cursor: 'pointer',
      });
    }
  }

  if (wrongSquare) merge(wrongSquare, { backgroundColor: palette.wrong });

  return styles;
}

export function ChessBoard(props: ChessBoardProps) {
  const {
    session,
    hintArrow,
    revealing,
    promotion,
    palette,
    pieceStyle,
    motion,
    coordinates,
    solved,
    onMove,
    onSquareClick,
    onPieceDragStart,
    onDragCancel,
    onPromote,
    onCancelPromotion,
  } = props;
  const orientation = session.playerColor === 'w' ? 'white' : 'black';
  const playerPrefix = session.playerColor;
  const pieces = pieceStyle === 'letters' ? LETTER_PIECES : undefined;
  const side = session.playerColor === 'w' ? 'White' : 'Black';

  return (
    <div
      className={`board-frame ${solved ? 'is-solved' : ''}`}
      aria-label={`${side} to move. Drag a piece, or click it and then the square it goes to.`}
    >
      <Chessboard
        options={{
          id: 'cursor-chess-board',
          position: session.fen,
          boardOrientation: orientation,
          pieces,
          squareStyles: buildSquareStyles(props),
          arrows: hintArrow ? [{ startSquare: hintArrow.from, endSquare: hintArrow.to, color: palette.hintArrow }] : [],
          arrowOptions: hintArrow ? { ...defaultArrowOptions, opacity: 1, arrowWidthDenominator: 4, arrowStartOffset: 0.32 } : undefined,
          lightSquareStyle: { backgroundColor: palette.light },
          darkSquareStyle: { backgroundColor: palette.dark },
          lightSquareNotationStyle: { color: palette.dark },
          darkSquareNotationStyle: { color: palette.light },
          alphaNotationStyle: { fontSize: '9px', fontWeight: 600, bottom: 1, right: 3, position: 'absolute' },
          numericNotationStyle: { fontSize: '9px', fontWeight: 600, top: 2, left: 3, position: 'absolute' },
          showNotation: coordinates,
          showAnimations: motion,
          dropSquareStyle: { boxShadow: 'inset 0 0 0 3px rgba(255, 248, 230, 0.55)' },
          boardStyle: { borderRadius: '6px' },
          animationDurationInMs: motion ? (revealing ? 360 : 180) : 0,
          allowDrawingArrows: !promotion,
          allowDragOffBoard: false,
          canDragPiece: ({ piece }) => !promotion && session.isPlayerTurn && piece.pieceType.startsWith(playerPrefix),
          onPieceDrag: ({ square }) => {
            if (square) onPieceDragStart(square as Square);
          },
          onPieceDragCancel: onDragCancel,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || sourceSquare === targetSquare) return false;
            return onMove(sourceSquare as Square, targetSquare as Square);
          },
          onSquareClick: ({ square }) => onSquareClick(square as Square),
        }}
      />
      {promotion && <PromotionPicker color={session.playerColor} pieces={pieces} onPick={onPromote} onCancel={onCancelPromotion} />}
    </div>
  );
}
