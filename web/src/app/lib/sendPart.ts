/** PUTs one chunk with XMLHttpRequest, because fetch can't report upload progress. Resolves with the parsed JSON reply. */
export function sendPart<T>(url: string, body: Blob, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.open('PUT', url);
        request.responseType = 'json';
        request.upload.onprogress = (event) => onProgress(event.loaded);
        request.onload = () => (request.status >= 200 && request.status < 300 ? resolve(request.response as T) : reject(new Error(`Part failed (${request.status})`)));
        request.onerror = () => reject(new Error('Network error'));
        request.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
        signal?.addEventListener('abort', () => request.abort());
        request.send(body);
    });
}
