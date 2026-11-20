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

  const solved = session.status === 'solved';

  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-3 px-3 pt-3 pb-4">
      <PuzzleHeader puzzle={session.puzzle} summary={puzzle.summary} />
      <ChessBoard
        session={session}
        selected={puzzle.selected}
        wrongSquare={puzzle.wrongSquare}
        hintSquare={puzzle.hintVisible ? session.hintSquare : null}
        onMove={puzzle.tryMove}
        onSquareClick={puzzle.onSquareClick}
        onPieceDragStart={puzzle.onPieceDragStart}
        onDragCancel={puzzle.clearSelection}
      />
      <PuzzleFeedback session={session} feedback={puzzle.feedback} />
      <PuzzleControls
        solved={solved}
        canHint={session.isPlayerTurn}
        onHint={puzzle.showHint}
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
