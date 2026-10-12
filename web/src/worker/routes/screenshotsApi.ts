import { createRouter } from '../app';
import { shortId } from '../ids/shortId';
import { capturePage } from '../screenshots/capturePage';
import { recordUpload } from '../uploads/recordUpload';
import { uploadFilename, uploadKey } from '../uploads/uploadKey';
import { parseHttpUrl } from '../urls/parseHttpUrl';

export const screenshotsApi = createRouter();

/** Captures a full length screenshot of a web page and stores it as an image drop that remembers its source. */
screenshotsApi.post('/api/screenshots', async (c) => {
    const { url, title } = await c.req.json<{ url?: string; title?: string }>();
    const target = parseHttpUrl(url);

    if (!target) {
        return c.json({ error: 'Enter a full http or https URL, starting with https://' }, 422);
    }

    let capture: Awaited<ReturnType<typeof capturePage>>;

    try {
        capture = await capturePage(c.env.BROWSER, target);
    } catch (error) {
        console.error('Screenshot capture failed', target.href, error);

        return c.json({ error: `Couldn't capture ${target.host}. The page may be down or too slow to load.` }, 502);
    }

    const id = shortId();
    const filename = uploadFilename(`Screenshot of ${target.host}.png`);
    const key = uploadKey(c.env, id, filename);
    const object = await c.env.BUCKET.put(key, capture.png, { httpMetadata: { contentType: 'image/png' } });

    return c.json(
        await recordUpload(c.get('drops'), {
            id,
            key,
            filename,
            contentType: 'image/png',
            size: object.size,
            title: title?.trim() || capture.title || target.host,
            targetUrl: target.href,
        }),
        201,
    );
});
