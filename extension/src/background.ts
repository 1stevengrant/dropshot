import { captureAndUpload, type CapturedTab } from './captureAndUpload';
import { captureFullPage } from './captureFullPage';
import { captureSelection } from './captureSelection';
import { runInTab } from './runInTab';
import { selectArea } from './selectArea';

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: 'capture-page', title: 'Capture full page with Dropshot', contexts: ['page', 'selection', 'image', 'link'] });
    chrome.contextMenus.create({ id: 'capture-area', title: 'Capture area with Dropshot', contexts: ['page', 'selection', 'image', 'link'] });
});

chrome.action.onClicked.addListener((tab) => capturePage(tab));

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'capture-area' && tab) {
        void captureArea(tab);
    }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab) {
        return;
    }

    void (info.menuItemId === 'capture-area' ? captureArea(tab) : capturePage(tab));
});

async function capturePage(tab: chrome.tabs.Tab): Promise<void> {
    if (!isCapturable(tab)) {
        return;
    }

    await captureAndUpload(tab, (callbacks) => captureFullPage(tab, callbacks));
}

async function captureArea(tab: chrome.tabs.Tab): Promise<void> {
    if (!isCapturable(tab)) {
        return;
    }

    const selection = await runInTab(tab.id, selectArea, []).catch((error: unknown) => {
        console.error('Dropshot area selection failed', error);

        return null;
    });

    if (selection) {
        await captureAndUpload(tab, (callbacks) => captureSelection(tab, selection, callbacks));
    }
}

function isCapturable(tab: chrome.tabs.Tab): tab is CapturedTab {
    return tab.id !== undefined && Boolean(tab.url);
}
