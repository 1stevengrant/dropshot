import { createRouter } from '../app';
import { shortId } from '../ids/shortId';
import { escape } from '../pages/html';

export const linksApi = createRouter();

/** Shortens a URL into a link drop. The redirect is stored like the Mac app's, as a tiny HTML page in R2. */
linksApi.post('/api/links', async (c) => {
    const { url, title } = await c.req.json<{ url?: string; title?: string }>();
    let target: URL;

    try {
        target = new URL(String(url ?? '').trim());
    } catch {
        return c.json({ error: 'Enter a full URL, starting with https://' }, 422);
    }

    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
        return c.json({ error: 'Only http and https links can be shortened.' }, 422);
    }

    const id = shortId();
    const key = [c.env.KEY_PREFIX.replace(/\/+$/, ''), id, 'index.html'].filter(Boolean).join('/');
    const href = escape(target.href);
    const html = `<!doctype html><meta charset=utf-8><meta http-equiv=refresh content="0;url=${href}"><title>Redirecting</title><a href="${href}">${href}</a>`;
    const object = await c.env.BUCKET.put(key, html, { httpMetadata: { contentType: 'text/html' } });
    const drops = c.get('drops');

    await drops.insert({ id, objectKey: key, filename: 'index.html', kind: 'link', contentType: 'text/html', size: object.size, createdAt: Date.now(), targetUrl: target.href });

    if (title?.trim()) {
        await drops.update(id, { title });
    }

    return c.json(await drops.get(id), 201);
});
