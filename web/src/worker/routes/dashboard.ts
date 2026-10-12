import { createRouter } from '../app';

export const dashboard = createRouter();

dashboard.get('/', (c) => c.redirect('/app/'));

dashboard.get('/app', (c) => c.redirect('/app/'));

dashboard.get('/app/*', async (c) => {
    const asset = await c.env.ASSETS.fetch(c.req.raw);

    if (asset.status !== 404) {
        return asset;
    }

    return c.env.ASSETS.fetch(new Request(new URL('/app/', c.req.url), c.req.raw));
});
