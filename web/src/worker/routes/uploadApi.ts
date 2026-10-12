import { createRouter } from '../app';
import { shortId } from '../ids/shortId';
import { contentTypeFor, kindFor } from '../kinds';

export const uploadApi = createRouter();

uploadApi.post('/api/upload', async (c) => {
    const filename = decodeURIComponent(c.req.header('X-Filename') ?? '').replace(/[/\\]/g, '_').trim();

    if (!filename || !c.req.raw.body) {
        return c.json({ error: 'Missing file.' }, 422);
    }

    const id = shortId();
    const key = [c.env.KEY_PREFIX.replace(/\/+$/, ''), id, filename].filter(Boolean).join('/');
    const title = decodeURIComponent(c.req.header('X-Title') ?? '').trim();
    const contentType = contentTypeFor(filename, c.req.header('Content-Type'));

    const object = await c.env.BUCKET.put(key, c.req.raw.body, { httpMetadata: { contentType } });
    const drops = c.get('drops');

    await drops.insert({ id, objectKey: key, filename, kind: kindFor(filename, contentType), contentType, size: object.size, createdAt: Date.now(), targetUrl: null });

    if (title) {
        await drops.update(id, { title });
    }

    return c.json(await drops.get(id), 201);
});
