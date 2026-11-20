import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Puzzle } from '../../shared/types';

export type PuzzleStatus = 'playing' | 'solved' | 'failed';

export type MoveResult =
  | { kind: 'illegal' }
  | { kind: 'needsPromotion' }
  | { kind: 'wrong'; san: string }
  | { kind: 'correct'; san: string }
  | { kind: 'solved'; san: string };

export interface LastMove {
  from: Square;
  to: Square;
}

export interface HintMove {
  from: Square;
  to: Square;
}

interface UciMove {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export function parseUci(uci: string): UciMove {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error(`Invalid UCI move: ${uci}`);
  }
  return {
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci[4] as PieceSymbol | undefined,
  };
}

function toUci(move: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/**
 * Runs one attempt at a Lichess-format puzzle. chess.js is the source of truth:
 * the board only ever shows `fen`, and every position change goes through here.
 *
 * Flow: the constructor plays the opponent's setup move (`moves[0]`). The player
 * then submits moves; a correct move is applied and the opponent's reply waits in
 * `pendingReply` until the UI calls `playOpponentReply()`, so the board can
 * animate the two moves separately. A promoting move is refused until the caller
 * names the piece. Revealing the line marks the attempt failed and plays the
 * remaining moves one ply at a time.
 */
export class PuzzleSession {
  readonly puzzle: Puzzle;
  readonly playerColor: Color;
  private chess!: Chess;
  private nextPly = 1;
  private _lastMove: LastMove | null = null;
  private _status: PuzzleStatus = 'playing';
  private _mistakes = 0;

  constructor(puzzle: Puzzle) {
    if (puzzle.moves.length < 2) {
      throw new Error(`Puzzle ${puzzle.id} needs a setup move and at least one solution move`);
    }
    this.puzzle = puzzle;
    this.reset();
    this.playerColor = this.chess.turn();
  }

  reset(): void {
    this.chess = new Chess(this.puzzle.fen);
    this.nextPly = 1;
    this._status = 'playing';
    this._mistakes = 0;
    this._lastMove = null;
    this.applyUci(this.puzzle.moves[0]!);
  }

  get fen(): string {
    return this.chess.fen();
  }

  get turn(): Color {
    return this.chess.turn();
  }

  get status(): PuzzleStatus {
    return this._status;
  }

  get mistakes(): number {
    return this._mistakes;
  }

  get lastMove(): LastMove | null {
    return this._lastMove;
  }

  /** True when the opponent must reply before the player can move again. */
  get pendingReply(): boolean {
    return this._status === 'playing' && this.chess.turn() !== this.playerColor;
  }

  get isPlayerTurn(): boolean {
    return this._status === 'playing' && this.chess.turn() === this.playerColor;
  }

  /** Number of moves the player must find in total. */
  get totalPlayerMoves(): number {
    return Math.floor(this.puzzle.moves.length / 2);
  }

  get playerMovesMade(): number {
    return Math.floor(this.nextPly / 2);
  }

  /** Scripted plies not yet played, including an opponent reply that is due. */
  get pliesRemaining(): number {
    return Math.max(0, this.puzzle.moves.length - this.nextPly);
  }

  get inCheck(): boolean {
    return this.chess.inCheck();
  }

  get isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  get isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  get checkedKingSquare(): Square | null {
    if (!this.chess.inCheck()) return null;
    const turn = this.chess.turn();
    for (const row of this.chess.board()) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === turn) return cell.square;
      }
    }
    return null;
  }

  pieceColorAt(square: Square): Color | null {
    return this.chess.get(square)?.color ?? null;
  }

  legalTargets(from: Square): Square[] {
    if (!this.isPlayerTurn) return [];
    return this.chess.moves({ square: from, verbose: true }).map((m) => m.to);
  }

  isCapture(from: Square, to: Square): boolean {
    return this.chess
      .moves({ square: from, verbose: true })
      .some((m) => m.to === to && (m.isCapture() || m.isEnPassant()));
  }

  /** The move the player should find next. Null when it is not their turn. */
  get hintMove(): HintMove | null {
    if (!this.isPlayerTurn) return null;
    const { from, to } = parseUci(this.puzzle.moves[this.nextPly]!);
    return { from, to };
  }

  /** The from-square of the move the player should play next, for the first hint. */
  get hintSquare(): Square | null {
    return this.hintMove?.from ?? null;
  }

  submitMove(from: Square, to: Square, promotion?: PieceSymbol): MoveResult {
    if (!this.isPlayerTurn) return { kind: 'illegal' };

    const candidates = this.chess.moves({ square: from, verbose: true }).filter((m) => m.to === to);
    if (candidates.length === 0) return { kind: 'illegal' };

    const isPromotion = candidates.some((m) => m.promotion);
    if (isPromotion && !promotion) return { kind: 'needsPromotion' };
    if (isPromotion && !candidates.some((m) => m.promotion === promotion)) return { kind: 'illegal' };

    const chosenPromotion = isPromotion ? promotion : undefined;
    const expected = this.puzzle.moves[this.nextPly]!;
    const uci = toUci({ from, to, promotion: chosenPromotion });

    const isFinalMove = this.nextPly === this.puzzle.moves.length - 1;
    let accepted = uci === expected;
    if (!accepted && isFinalMove) {
      // Lichess accepts any checkmate on the final move, not only the recorded one.
      const probe = new Chess(this.chess.fen());
      probe.move({ from, to, promotion: chosenPromotion });
      accepted = probe.isCheckmate();
    }

    if (!accepted) {
      this._mistakes += 1;
      const san = candidates.find((m) => (m.promotion ?? undefined) === chosenPromotion)?.san ?? candidates[0]!.san;
      return { kind: 'wrong', san };
    }

    const move = this.chess.move({ from, to, promotion: chosenPromotion });
    this._lastMove = { from: move.from, to: move.to };
    this.nextPly += 1;

    if (this.nextPly >= this.puzzle.moves.length) {
      this._status = 'solved';
      return { kind: 'solved', san: move.san };
    }
    return { kind: 'correct', san: move.san };
  }

  /** Plays the opponent's scripted reply. Returns its SAN, or null if none is due. */
  playOpponentReply(): string | null {
    if (!this.pendingReply) return null;
    const san = this.applyUci(this.puzzle.moves[this.nextPly]!);
    this.nextPly += 1;
    return san;
  }

  /**
   * Gives up on the attempt. The remaining line is played back with `playRevealPly`.
   * Returns false when the puzzle is already solved or already revealed.
   */
  startReveal(): boolean {
    if (this._status !== 'playing') return false;
    this._status = 'failed';
    return true;
  }

  /** Plays the next scripted ply of a revealed line. Returns its SAN, or null when finished. */
  playRevealPly(): string | null {
    if (this._status !== 'failed') return null;
    if (this.nextPly >= this.puzzle.moves.length) return null;
    const san = this.applyUci(this.puzzle.moves[this.nextPly]!);
    this.nextPly += 1;
    return san;
  }

  /**
   * Rebuilds an attempt from the player's accepted moves, for resuming after a
   * restart. Opponent replies are replayed too. Returns false and leaves a fresh
   * start if any move no longer fits the puzzle.
   */
  restore(playerMoves: readonly string[], mistakes: number, revealed: boolean): boolean {
    this.reset();
    for (const uci of playerMoves) {
      let result: MoveResult;
      try {
        const { from, to, promotion } = parseUci(uci);
        result = this.submitMove(from, to, promotion);
      } catch {
        result = { kind: 'illegal' };
      }
      if (result.kind !== 'correct' && result.kind !== 'solved') {
        this.reset();
        return false;
      }
      this.playOpponentReply();
    }
    this._mistakes = Math.max(0, Math.floor(mistakes));
    if (revealed && this.startReveal()) {
      while (this.playRevealPly()) {
        // Play the rest of the line instantly.
      }
    }
    return true;
  }

  private applyUci(uci: string): string {
    const { from, to, promotion } = parseUci(uci);
    const move = this.chess.move({ from, to, promotion });
    this._lastMove = { from: move.from, to: move.to };
    return move.san;
  }
}
