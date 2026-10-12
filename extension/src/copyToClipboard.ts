/** Service workers have no clipboard, so the copy happens in an offscreen document. */
export async function copyToClipboard(text: string): Promise<void> {
    if (!(await chrome.offscreen.hasDocument())) {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: [chrome.offscreen.Reason.CLIPBOARD],
            justification: 'Copy the share link of a new drop',
        });
    }

    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'copy', text });
}
