/** Chrome allows two captureVisibleTab calls a second. */
const captureInterval = 550;

/** Captures the visible tab as PNG, spacing calls out so Chrome's rate limit never rejects one. */
export function tabCamera(windowId: number): () => Promise<string> {
    let lastCapture = 0;

    return async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, lastCapture + captureInterval - Date.now())));
        lastCapture = Date.now();

        return chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    };
}
