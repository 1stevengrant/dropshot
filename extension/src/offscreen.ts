/** Copies text sent by the service worker. navigator.clipboard needs focus, which an offscreen document never has. */
chrome.runtime.onMessage.addListener((message: { target?: string; type?: string; text?: string }, _sender, sendResponse) => {
    if (message.target !== 'offscreen' || message.type !== 'copy') {
        return;
    }

    const field = document.getElementById('clipboard') as HTMLTextAreaElement;
    field.value = message.text ?? '';
    field.select();
    document.execCommand('copy');
    sendResponse();
});
