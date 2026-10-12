import { clearBadge, showDone, showError, showUploading } from './badge';
import type { CaptureCallbacks } from './captureFullPage';
import { dropshotUrl } from './config';
import { copyToClipboard } from './copyToClipboard';
import { TileStitcher } from './TileStitcher';
import { SignInRequired, uploadCapture } from './uploadCapture';
import { uploadThumbnail } from './uploadThumbnail';

export type CapturedTab = chrome.tabs.Tab & { id: number; url: string };

const busy = new Set<number>();

/** Runs a capture, stitches it, uploads it with a thumbnail, copies the link and opens the drop. */
export async function captureAndUpload(tab: CapturedTab, capture: (callbacks: CaptureCallbacks) => Promise<void>): Promise<void> {
    if (busy.has(tab.id)) {
        return;
    }

    busy.add(tab.id);

    try {
        await clearBadge(tab.id);

        let stitcher: TileStitcher | null = null;
        await capture({
            onStart: (metrics) => (stitcher = new TileStitcher(metrics)),
            onTile: (tile) => stitcher!.draw(tile),
        });
        await showUploading(tab.id);

        const drop = await uploadCapture(await stitcher!.encode(), { url: tab.url, title: tab.title ?? '' });
        await copyToClipboard(drop.pageUrl);
        await uploadThumbnail(drop.id, await stitcher!.thumbnail());
        await chrome.tabs.create({ url: drop.pageUrl, index: tab.index + 1 });
        await showDone(tab.id);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Dropshot capture failed', error);
        await showError(tab.id, message);

        if (error instanceof SignInRequired) {
            await chrome.tabs.create({ url: `${dropshotUrl}/app`, index: tab.index + 1 });
        }
    } finally {
        busy.delete(tab.id);
    }
}
