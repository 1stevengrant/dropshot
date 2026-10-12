import { createRouter } from '../app';

export const assets = createRouter();

/** The public pages' daisyUI stylesheet. */
assets.get('/_assets/*', (c) => c.env.ASSETS.fetch(c.req.raw));

/** Site icons, copied from web/public into dist at build time. */
for (const icon of ['/favicon.ico', '/favicon.svg', '/apple-touch-icon.png']) {
    assets.get(icon, async (c) => {
        const response = await c.env.ASSETS.fetch(c.req.raw);
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'public, max-age=86400');

        return new Response(response.body, { status: response.status, headers });
    });
}
