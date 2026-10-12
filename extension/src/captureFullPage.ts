import { showProgress } from './badge';
import { beginCapture, hidePinnedElements, preparePage, restorePage, scrollPage, type PageMetrics } from './pageControl';
import { runInTab } from './runInTab';
import { tabCamera } from './tabCamera';

export interface Tile {
    dataUrl: string;
    /** Where the tile's top edge sits relative to the top of the capture, in CSS pixels. */
    offset: number;
}

export interface CaptureCallbacks {
    onStart: (metrics: PageMetrics) => void;
    onTile: (tile: Tile) => Promise<void>;
}

/**
 * Longer than the Worker and Mac app's 8192, because the tab is already open and nothing else is waiting on it.
 * Pages past WebP's limit are saved as JPEG instead (see TileStitcher).
 */
export const maxHeight = 32_000;

/**
 * Scrolls the tab one screen at a time and captures each, the way GoFullPage does, handing each tile over as it's
 * taken so long pages never hold every screenshot at once. The scroll and stitch logic also lives in
 * web/src/worker/screenshots and Dropshot/Capture/WebPageCapture.swift; change them together.
 */
export async function captureFullPage(tab: { id: number; windowId: number }, { onStart, onTile }: CaptureCallbacks): Promise<void> {
    const capture = tabCamera(tab.windowId);

    try {
        await runInTab(tab.id, beginCapture, [true]);
        const metrics = await runInTab(tab.id, preparePage, [maxHeight]);
        const total = Math.ceil(metrics.height / metrics.region.height);
        let count = 0;

        onStart(metrics);

        for (let step = 0; step < metrics.height; step += metrics.region.height) {
            await showProgress(tab.id, ++count, total);

            const offset = await runInTab(tab.id, scrollPage, [step]);
            await onTile({ dataUrl: await capture(), offset });

            if (count === 1) {
                await runInTab(tab.id, hidePinnedElements, []);
            }
        }
    } finally {
        await runInTab(tab.id, restorePage, []).catch(() => {});
    }
}
