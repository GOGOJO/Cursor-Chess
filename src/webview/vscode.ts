import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/messages';
import { chooseNextPuzzle, PuzzleLibrary } from '../shared/puzzleLibrary';
import { SAMPLE_PUZZLES } from '../shared/samplePuzzles';
import { DEFAULT_FILTERS, type PuzzleFilters } from '../shared/types';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

type Listener = (message: ExtensionToWebviewMessage) => void;
const listeners = new Set<Listener>();

window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMessage>) => {
  for (const listener of listeners) listener(event.data);
});

/** Stands in for the extension host when the UI runs in a plain browser (`npm run dev:webview`). */
function createBrowserFallback(): VsCodeApi {
  const library = new PuzzleLibrary(SAMPLE_PUZZLES);
  let filters: PuzzleFilters = { ...DEFAULT_FILTERS };
  const recent: string[] = [];
  let solvedCount = 0;
  const reply = (message: ExtensionToWebviewMessage) => setTimeout(() => window.postMessage(message, '*'), 0);

  const sendLibrary = () =>
    reply({
      type: 'library',
      library: { filters, totalCount: library.totalCount, importedCount: 0, matchingCount: library.matching(filters).length },
    });
  const sendNext = () => {
    const next = chooseNextPuzzle(library, filters, recent);
    recent.push(next.puzzle.id);
    reply({ type: 'loadPuzzle', ...next });
  };

  return {
    postMessage(raw) {
      const message = raw as WebviewToExtensionMessage;
      switch (message.type) {
        case 'ready':
          sendLibrary();
          reply({ type: 'summary', summary: { solvedCount } });
          sendNext();
          break;
        case 'requestNextPuzzle':
          sendNext();
          break;
        case 'puzzleSolved':
          solvedCount += 1;
          reply({ type: 'summary', summary: { solvedCount } });
          break;
        case 'puzzleFailed':
          break;
        case 'setFilters':
          filters = message.filters;
          sendLibrary();
          sendNext();
          break;
        case 'importPuzzles':
          console.info('Importing needs the extension host. Run the extension with F5 to try it.');
          break;
      }
    },
  };
}

const api: VsCodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : createBrowserFallback();

export function postToExtension(message: WebviewToExtensionMessage): void {
  api.postMessage(message);
}

export function onExtensionMessage(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
