import type { Drop } from '../../shared/types';
import { api } from './api';
import { sendPart } from './sendPart';

interface UploadedPart {
    partNumber: number;
    etag: string;
}

/** Files above this go up in parts; each part is one Worker request, well under its 100 MB limit. */
export const partSize = 25 * 1024 * 1024;
const concurrency = 3;
const attempts = 4;

/**
 * Uploads a file, in parts when it's large, and reports bytes sent. A failed part is retried on its own with
 * backoff; if one gives up, the whole upload is aborted so R2 doesn't keep the parts.
 */
export async function chunkedUpload(file: Blob, options: { filename?: string; title?: string; onProgress?: (loaded: number) => void } = {}): Promise<Drop> {
    const filename = options.filename ?? (file as File).name;
    const report = options.onProgress ?? (() => {});

    if (file.size <= partSize) {
        const drop = await api.upload(file, filename, options.title);
        report(file.size);

        return drop;
    }

    const { id, uploadId } = await api.startUpload(filename, file.type);
    const query = new URLSearchParams({ uploadId, filename });
    const count = Math.ceil(file.size / partSize);
    const loaded = new Array<number>(count).fill(0);
    const parts: UploadedPart[] = [];
    const stop = new AbortController();
    let next = 0;

    async function sendWithRetry(index: number): Promise<UploadedPart> {
        const chunk = file.slice(index * partSize, Math.min(file.size, (index + 1) * partSize));

        for (let attempt = 1; ; attempt++) {
            try {
                return await sendPart<UploadedPart>(`/api/uploads/${id}/parts/${index + 1}?${query}`, chunk, (bytes) => {
                    loaded[index] = bytes;
                    report(loaded.reduce((sum, value) => sum + value, 0));
                }, stop.signal);
            } catch (error) {
                loaded[index] = 0;

                if (attempt >= attempts || stop.signal.aborted) {
                    throw error;
                }

                await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
            }
        }
    }

    async function worker(): Promise<void> {
        while (next < count && !stop.signal.aborted) {
            const index = next++;
            parts.push(await sendWithRetry(index));
        }
    }

    try {
        await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));
    } catch (error) {
        // Stop the other parts before telling R2 to discard the upload.
        stop.abort();
        await api.abortUpload(id, uploadId, filename).catch(() => {});
        throw error;
    }

    return api.completeUpload(id, { uploadId, filename, title: options.title, parts: parts.sort((a, b) => a.partNumber - b.partNumber) });
}
