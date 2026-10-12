import { showProgress } from './badge';
import { hidePinnedElements, preparePage, restorePage, scrollPage, type PageMetrics } from './pageControl';

export interface Tile {
    dataUrl: string;
    /** Where the page actually stopped scrolling, in CSS pixels. */
    offset: number;
}

/** Matches the Worker and Mac app, so endless pages stay a sane size. */
const maxHeight = 8192;
/** Chrome allows two captureVisibleTab calls a second. */
const captureInterval = 550;

/**
 * Scrolls the tab one viewport at a time and captures each, the way GoFullPage does. The scroll and stitch logic also
 * lives in web/src/worker/screenshots and Dropshot/Capture/WebPageCapture.swift; change them together.
 */
export async function captureFullPage(tab: chrome.tabs.Tab & { id: number; windowId: number }): Promise<{ tiles: Tile[]; metrics: PageMetrics }> {
    const metrics = await run(tab.id, preparePage, [maxHeight]);
    const tiles: Tile[] = [];
    const total = Math.ceil(metrics.height / metrics.viewportHeight);
    let lastCapture = 0;

    try {
        for (let step = 0; step < metrics.height; step += metrics.viewportHeight) {
            await showProgress(tab.id, tiles.length + 1, total);

            const offset = await run(tab.id, scrollPage, [step]);
            await new Promise((resolve) => setTimeout(resolve, Math.max(0, lastCapture + captureInterval - Date.now())));
            lastCapture = Date.now();

            tiles.push({ dataUrl: await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }), offset });

            if (tiles.length === 1) {
                await run(tab.id, hidePinnedElements, []);
            }
        }
    } finally {
        await run(tab.id, restorePage, []).catch(() => {});
    }

    return { tiles, metrics };
}

async function run<Args extends unknown[], Result>(tabId: number, func: (...args: Args) => Result | Promise<Result>, args: Args): Promise<Result> {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func, args });

    return injection?.result as Result;
}
