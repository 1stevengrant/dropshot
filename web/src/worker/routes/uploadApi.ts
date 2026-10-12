import { createRouter } from '../app';
import { shortId } from '../ids/shortId';
import { contentTypeFor } from '../kinds';
import { recordUpload } from '../uploads/recordUpload';
import { uploadFilename, uploadKey } from '../uploads/uploadKey';
import { parseHttpUrl } from '../urls/parseHttpUrl';

export const uploadApi = createRouter();

/** Single request upload for small files; larger ones go through /api/uploads in parts. */
uploadApi.post('/api/upload', async (c) => {
    const filename = uploadFilename(decodeURIComponent(c.req.header('X-Filename') ?? ''));

    if (!filename || !c.req.raw.body) {
        return c.json({ error: 'Missing file.' }, 422);
    }

    const id = shortId();
    const key = uploadKey(c.env, id, filename);
    const title = decodeURIComponent(c.req.header('X-Title') ?? '').trim();
    // The Chrome extension sends the page a screenshot was taken of, so the drop links back to it.
    const targetUrl = parseHttpUrl(decodeURIComponent(c.req.header('X-Target-Url') ?? ''))?.href ?? null;
    const contentType = contentTypeFor(filename, c.req.header('Content-Type'));
    const object = await c.env.BUCKET.put(key, c.req.raw.body, { httpMetadata: { contentType } });

    return c.json(await recordUpload(c.get('drops'), { id, key, filename, contentType, size: object.size, title, targetUrl }), 201);
});
