import type { ExtensionToWebviewMessage, WebviewToExtensionMessage } from '../shared/messages';
import { SAMPLE_PUZZLES } from '../shared/samplePuzzles';

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
  let index = 0;
  let solvedCount = 0;
  const reply = (message: ExtensionToWebviewMessage) =>
    setTimeout(() => window.postMessage(message, '*'), 0);

  return {
    postMessage(raw) {
      const message = raw as WebviewToExtensionMessage;
      if (message.type === 'ready') {
        reply({ type: 'loadPuzzle', puzzle: SAMPLE_PUZZLES[index]! });
        reply({ type: 'summary', summary: { solvedCount } });
      } else if (message.type === 'requestNextPuzzle') {
        index = (index + 1) % SAMPLE_PUZZLES.length;
        reply({ type: 'loadPuzzle', puzzle: SAMPLE_PUZZLES[index]! });
      } else if (message.type === 'puzzleSolved') {
        solvedCount += 1;
        reply({ type: 'summary', summary: { solvedCount } });
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
