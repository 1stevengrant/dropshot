import type { Drops } from '../drops';
import { kindFor } from '../kinds';

/** Registers a finished upload as a drop and returns it. */
export async function recordUpload(drops: Drops, upload: { id: string; key: string; filename: string; contentType: string; size: number; title: string; targetUrl?: string | null }) {
    await drops.insert({
        id: upload.id,
        objectKey: upload.key,
        filename: upload.filename,
        kind: kindFor(upload.filename, upload.contentType),
        contentType: upload.contentType,
        size: upload.size,
        createdAt: Date.now(),
        targetUrl: upload.targetUrl ?? null,
    });

    if (upload.title) {
        await drops.update(upload.id, { title: upload.title });
    }

    return drops.get(upload.id);
}
