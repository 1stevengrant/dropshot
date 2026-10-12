import { showProgress } from './badge';
import { maxHeight, type CaptureCallbacks } from './captureFullPage';
import { beginCapture, hidePinnedElements, restorePage, scrollPage } from './pageControl';
import { runInTab } from './runInTab';
import type { Selection } from './selectArea';
import { tabCamera } from './tabCamera';

/**
 * Captures a picked element or dragged area. One that's fully on screen is a single screenshot of exactly what the
 * user sees; anything taller or out of view scrolls and stitches like a full page, cropped to the selection.
 */
export async function captureSelection(tab: { id: number; windowId: number }, selection: Selection, { onStart, onTile }: CaptureCallbacks): Promise<void> {
    const capture = tabCamera(tab.windowId);

    try {
        const view = await runInTab(tab.id, beginCapture, [false]);
        const height = Math.min(selection.height, maxHeight);
        const left = Math.max(0, selection.x - view.scrollX);

        onStart({
            region: { left, top: 0, width: Math.min(selection.width, view.viewportWidth - left), height: view.viewportHeight },
            height,
            viewportWidth: view.viewportWidth,
        });

        if (selection.y >= view.scrollY && selection.y + height <= view.scrollY + view.viewportHeight) {
            await onTile({ dataUrl: await capture(), offset: view.scrollY - selection.y });

            return;
        }

        const total = Math.ceil(height / view.viewportHeight);
        let previous: number | null = null;

        for (let covered = 0, count = 1; covered < height; count++) {
            await showProgress(tab.id, count, total);

            const scrollY = await runInTab(tab.id, scrollPage, [selection.y + covered]);

            // The page can't scroll any further, so the rest of the selection isn't reachable.
            if (scrollY === previous) {
                break;
            }

            previous = scrollY;
            await onTile({ dataUrl: await capture(), offset: scrollY - selection.y });

            if (count === 1) {
                await runInTab(tab.id, hidePinnedElements, []);
            }

            covered = scrollY - selection.y + view.viewportHeight;
        }
    } finally {
        await runInTab(tab.id, restorePage, []).catch(() => {});
    }
}
