import * as vscode from 'vscode';
import { startAgentNotices } from './agent/startAgentNotices';
import { registerCommands } from './commands';
import { clearImportedPuzzles, importPuzzles } from './importPuzzles';
import { LocalPuzzleProvider } from './providers/localPuzzleProvider';
import { PuzzleCache, type TextFile } from './providers/puzzleCache';
import { PuzzleViewProvider } from './puzzleViewProvider';
import { StorageService } from './storage/storageService';

function storageFile(context: vscode.ExtensionContext, name: string): TextFile {
  const uri = vscode.Uri.joinPath(context.globalStorageUri, name);
  return {
    async read() {
      try {
        return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
      } catch {
        return undefined;
      }
    },
    async write(text) {
      await vscode.workspace.fs.createDirectory(context.globalStorageUri);
      await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
    },
    async delete() {
      try {
        await vscode.workspace.fs.delete(uri);
      } catch {
        // Already gone.
      }
    },
  };
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const storage = new StorageService(context.globalState);
  const puzzles = new LocalPuzzleProvider(new PuzzleCache(storageFile(context, 'imported-puzzles.json')));
  await puzzles.load();

  const runImport = () =>
    importPuzzles({ puzzles, filters: () => storage.getFilters(), onLibraryChanged: () => provider.refreshLibrary() });
  const provider = new PuzzleViewProvider(context.extensionUri, puzzles, storage, () => void runImport());

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PuzzleViewProvider.viewId, provider),
    ...registerCommands(provider, {
      importPuzzles: runImport,
      clearImportedPuzzles: () => clearImportedPuzzles(puzzles, () => provider.refreshLibrary()),
    }),
    startAgentNotices(storage, provider),
  );
}

export function deactivate(): void {}
