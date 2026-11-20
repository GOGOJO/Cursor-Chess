import { ChessBoard } from './components/ChessBoard';
import { PixelKnight } from './components/PixelKnight';
import { PuzzleControls } from './components/PuzzleControls';
import { PuzzleFeedback } from './components/PuzzleFeedback';
import { PuzzleHeader } from './components/PuzzleHeader';
import { usePuzzle } from './hooks/usePuzzle';

export function App() {
  const puzzle = usePuzzle();
  const { session } = puzzle;

  if (!session) {
    return (
      <main className="flex h-screen items-center justify-center text-ink-faint">
        <PixelKnight size={28} className="animate-pulse" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 pt-3 pb-4">
      <PuzzleHeader puzzle={session.puzzle} summary={puzzle.summary} soundOn={puzzle.soundOn} onToggleSound={puzzle.toggleSound} />
      <ChessBoard
        session={session}
        selected={puzzle.selected}
        wrongSquare={puzzle.wrongSquare}
        hintSquare={puzzle.hintLevel >= 1 ? session.hintSquare : null}
        hintArrow={puzzle.hintLevel >= 2 ? session.hintMove : null}
        revealing={puzzle.feedback.kind === 'revealing'}
        promotion={puzzle.pendingPromotion !== null}
        onMove={puzzle.tryMove}
        onSquareClick={puzzle.onSquareClick}
        onPieceDragStart={puzzle.onPieceDragStart}
        onDragCancel={puzzle.clearSelection}
        onPromote={puzzle.choosePromotion}
        onCancelPromotion={puzzle.cancelPromotion}
      />
      <PuzzleFeedback session={session} feedback={puzzle.feedback} />
      <PuzzleControls
        finished={puzzle.feedback.kind === 'solved' || puzzle.feedback.kind === 'failed'}
        canHint={session.isPlayerTurn && puzzle.hintLevel < 2}
        hintLevel={puzzle.hintLevel}
        canReveal={session.status === 'playing'}
        onHint={puzzle.showHint}
        onReveal={puzzle.revealSolution}
        onReset={puzzle.reset}
        onNext={puzzle.nextPuzzle}
      />
      <footer className="pt-1 text-center text-[10px] text-ink-faint">
        Puzzles from the{' '}
        <a href="https://database.lichess.org/#puzzles" className="underline decoration-dotted underline-offset-2 hover:text-ink-muted">
          Lichess database
        </a>{' '}
        (CC0)
      </footer>
    </main>
  );
}
