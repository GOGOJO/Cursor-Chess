import * as vscode from 'vscode';
import { PuzzleViewProvider } from './puzzleViewProvider';

export function registerCommands(provider: PuzzleViewProvider): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('cursorChess.open', () =>
      vscode.commands.executeCommand(`${PuzzleViewProvider.viewId}.focus`),
    ),
    vscode.commands.registerCommand('cursorChess.newPuzzle', async () => {
      await vscode.commands.executeCommand(`${PuzzleViewProvider.viewId}.focus`);
      provider.showNextPuzzle();
    }),
  ];
}
