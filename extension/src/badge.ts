/** Progress, success and failure on the toolbar icon, scoped to the tab being captured. */
export async function showProgress(tabId: number, done: number, total: number): Promise<void> {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#4b5563' });
    await chrome.action.setBadgeText({ tabId, text: `${done}/${total}` });
}

export async function showUploading(tabId: number): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text: '↑' });
}

export async function showDone(tabId: number): Promise<void> {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#16a34a' });
    await chrome.action.setBadgeText({ tabId, text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {}), 3000);
}

export async function showError(tabId: number, message: string): Promise<void> {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' });
    await chrome.action.setBadgeText({ tabId, text: '!' });
    await chrome.action.setTitle({ tabId, title: `Dropshot: ${message}` });
}

export async function clearBadge(tabId: number): Promise<void> {
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'Capture full page to Dropshot' });
}
