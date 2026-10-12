import { createRouter } from '../app';
import { thumbnailKey } from '../thumbnails/thumbnailKey';

export const thumbnailsApi = createRouter();

/** Thumbnails are small; anything bigger is an original sent by mistake. */
const maxThumbnailBytes = 2 * 1024 * 1024;

/** Small originals are fine as their own thumbnail, so drops without one still show a picture. */
const maxOriginalAsThumbnailBytes = 1024 * 1024;

thumbnailsApi.get('/api/drops/:id/thumbnail', async (c) => {
    const id = c.req.param('id');
    const thumbnail = await c.env.BUCKET.get(thumbnailKey(c.env, id));

    if (thumbnail) {
        return new Response(thumbnail.body, {
            headers: {
                'Content-Type': thumbnail.httpMetadata?.contentType ?? 'image/webp',
                // The dashboard versions thumbnail URLs by the drop's size, so a replaced image gets a new URL.
                'Cache-Control': c.req.query('v') ? 'private, max-age=31536000, immutable' : 'private, max-age=604800',
            },
        });
    }

    const row = await c.get('drops').find(id);

    if (!row || row.kind !== 'image' || row.size > maxOriginalAsThumbnailBytes) {
        return c.notFound();
    }

    const original = await c.env.BUCKET.get(row.object_key);

    if (!original) {
        return c.notFound();
    }

    return new Response(original.body, { headers: { 'Content-Type': row.content_type, 'Cache-Control': 'private, max-age=3600' } });
});

thumbnailsApi.put('/api/drops/:id/thumbnail', async (c) => {
    const id = c.req.param('id');
    const contentType = c.req.header('Content-Type') ?? '';
    const length = Number(c.req.header('Content-Length') ?? 0);

    if (!contentType.startsWith('image/') || !c.req.raw.body || length > maxThumbnailBytes) {
        return c.json({ error: 'Send a small image as the thumbnail.' }, 422);
    }

    if (!(await c.get('drops').find(id))) {
        return c.notFound();
    }

    await c.env.BUCKET.put(thumbnailKey(c.env, id), c.req.raw.body, { httpMetadata: { contentType } });

    return c.body(null, 204);
});
