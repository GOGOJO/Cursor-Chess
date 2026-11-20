import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { LocalPuzzleProvider } from './providers/localPuzzleProvider';
import { PuzzleViewProvider } from './puzzleViewProvider';
import { StorageService } from './storage/storageService';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new PuzzleViewProvider(
    context.extensionUri,
    new LocalPuzzleProvider(),
    new StorageService(context.globalState),
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PuzzleViewProvider.viewId, provider),
    ...registerCommands(provider),
  );
}

export function deactivate(): void {}
