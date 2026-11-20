import * as vscode from 'vscode';
import { describeFilters } from '../shared/filterLabels';
import { matchesFilters } from '../shared/puzzleLibrary';
import type { PuzzleFilters } from '../shared/types';
import { importLichessRows, LICHESS_PUZZLE_DB_URL } from './providers/lichessCsv';
import type { LocalPuzzleProvider } from './providers/localPuzzleProvider';
import { openLineSource, type PuzzleSourceLocation } from './providers/puzzleSource';

interface Dependencies {
  puzzles: LocalPuzzleProvider;
  filters: () => PuzzleFilters;
  onLibraryChanged: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

async function chooseSource(): Promise<PuzzleSourceLocation | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      {
        label: '$(cloud-download) Download from Lichess',
        detail: 'Streams the CC0 puzzle database and stops as soon as it has enough. Nothing else is downloaded.',
        source: 'url' as const,
      },
      {
        label: '$(file) From a file on this computer',
        detail: 'A lichess_db_puzzle.csv or .csv.zst from database.lichess.org.',
        source: 'file' as const,
      },
    ],
    { title: 'Import Lichess puzzles', placeHolder: 'Where should the puzzles come from?' },
  );
  if (!picked) return undefined;
  if (picked.source === 'url') return { kind: 'url', url: LICHESS_PUZZLE_DB_URL };

  const files = await vscode.window.showOpenDialog({
    title: 'Choose a Lichess puzzle CSV',
    canSelectMany: false,
    filters: { 'Lichess puzzle CSV': ['csv', 'zst'] },
  });
  const file = files?.[0];
  return file ? { kind: 'file', path: file.fsPath } : undefined;
}

async function chooseAmount(filters: PuzzleFilters): Promise<{ limit: number; filtered: boolean } | undefined> {
  const items: (vscode.QuickPickItem & { limit: number; filtered: boolean })[] = [
    { label: '1,000 puzzles', description: 'Any difficulty and theme', limit: 1_000, filtered: false },
    { label: '5,000 puzzles', description: 'Any difficulty and theme', limit: 5_000, filtered: false },
  ];
  const label = describeFilters(filters);
  if (label) {
    items.unshift({
      label: `500 ${label} puzzles`,
      description: 'Matches your current filters. Rare combinations take longer to find.',
      limit: 500,
      filtered: true,
    });
  }
  return vscode.window.showQuickPick(items, { title: 'Import Lichess puzzles', placeHolder: 'How many?' });
}

export async function importPuzzles({ puzzles, filters, onLibraryChanged }: Dependencies): Promise<void> {
  const location = await chooseSource();
  if (!location) return;
  const current = filters();
  const amount = await chooseAmount(current);
  if (!amount) return;

  try {
    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'Importing Lichess puzzles', cancellable: true },
      async (progress, token) => {
        progress.report({ message: location.kind === 'url' ? 'Connecting to Lichess…' : 'Reading the file…' });
        const source = await openLineSource(location);
        token.onCancellationRequested(() => source.close());
        try {
          return await importLichessRows(source.lines, {
            existingIds: puzzles.knownIds(),
            limit: amount.limit,
            accept: amount.filtered ? (p) => matchesFilters(p, current) : undefined,
            isCancelled: () => token.isCancellationRequested,
            onProgress: (rows, added) => progress.report({ message: `${fmt(added)} found in ${fmt(rows)} rows` }),
          });
        } finally {
          source.close();
        }
      },
    );

    if (result.puzzles.length === 0) {
      void vscode.window.showInformationMessage(
        result.stoppedBy === 'cancelled' ? 'Import cancelled. No puzzles were added.' : 'No new puzzles found. Your library already has everything that matched.',
      );
      return;
    }

    await puzzles.addImported(result.puzzles);
    onLibraryChanged();
    const prefix = result.stoppedBy === 'cancelled' ? 'Import cancelled after adding' : 'Added';
    void vscode.window.showInformationMessage(
      `${prefix} ${fmt(result.puzzles.length)} Lichess puzzles. Your library now has ${fmt(puzzles.count())}.`,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`Couldn't import puzzles: ${reason}`);
  }
}

export async function clearImportedPuzzles(puzzles: LocalPuzzleProvider, onLibraryChanged: () => void): Promise<void> {
  const count = puzzles.importedCount;
  if (count === 0) {
    void vscode.window.showInformationMessage('There are no imported puzzles to remove.');
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    `Remove ${fmt(count)} imported puzzles? The bundled puzzles stay.`,
    { modal: true },
    'Remove',
  );
  if (confirm !== 'Remove') return;
  await puzzles.clearImported();
  onLibraryChanged();
}
