import * as vscode from 'vscode';
import { PuzzleViewProvider } from './puzzleViewProvider';

export interface CommandHandlers {
  importPuzzles: () => Promise<void>;
  clearImportedPuzzles: () => Promise<void>;
}

export function registerCommands(provider: PuzzleViewProvider, handlers: CommandHandlers): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('cursorChess.open', () =>
      vscode.commands.executeCommand(`${PuzzleViewProvider.viewId}.focus`),
    ),
    vscode.commands.registerCommand('cursorChess.newPuzzle', async () => {
      await vscode.commands.executeCommand(`${PuzzleViewProvider.viewId}.focus`);
      await provider.showNextPuzzle();
    }),
    vscode.commands.registerCommand('cursorChess.importPuzzles', handlers.importPuzzles),
    vscode.commands.registerCommand('cursorChess.clearImportedPuzzles', handlers.clearImportedPuzzles),
  ];
}
