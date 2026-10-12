import { clearBadge, showDone, showError, showUploading } from './badge';
import { captureFullPage } from './captureFullPage';
import { dropshotUrl } from './config';
import { copyToClipboard } from './copyToClipboard';
import { stitchTiles } from './stitchTiles';
import { SignInRequired, uploadCapture } from './uploadCapture';

const busy = new Set<number>();

chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined || !tab.url || busy.has(tab.id)) {
        return;
    }

    const target = { ...tab, id: tab.id, windowId: tab.windowId };
    busy.add(tab.id);

    try {
        await clearBadge(tab.id);

        const { tiles, metrics } = await captureFullPage(target);
        await showUploading(tab.id);

        const link = await uploadCapture(await stitchTiles(tiles, metrics), { url: tab.url, title: tab.title ?? '' });
        await copyToClipboard(link);
        await chrome.tabs.create({ url: link, index: tab.index + 1 });
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
});
