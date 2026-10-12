import { createRouter } from '../app';
import { isOwnerAnywhere } from '../auth/ownerCookie';
import { appShell } from '../http/appShell';

export const dashboard = createRouter();

/** The library lives at the root. Signed-out visitors go through Cloudflare Access at /app first. */
dashboard.get('/', async (c) => {
    if (!(await isOwnerAnywhere(c.req.raw, c.env))) {
        return c.redirect(`/app/${new URL(c.req.url).search}`);
    }

    return appShell(c);
});

/**
 * /app is only the Access sign-in entry point (and where the built assets live). Once signed in, which also sets the
 * owner cookie, it forwards to the same view at the root.
 */
dashboard.get('/app', (c) => c.redirect(`/${new URL(c.req.url).search}`));

dashboard.get('/app/*', async (c) => {
    const url = new URL(c.req.url);

    if (url.pathname.startsWith('/app/assets/')) {
        const response = await c.env.ASSETS.fetch(c.req.raw);

        if (!response.ok) {
            return response;
        }

        // Vite puts a content hash in every asset name, so a given URL never changes.
        const headers = new Headers(response.headers);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new Response(response.body, { status: response.status, headers });
    }

    const legacyDrop = url.pathname.match(/^\/app\/d\/([A-Za-z0-9_-]+)$/);

    return c.redirect(legacyDrop ? `/${legacyDrop[1]}` : `/${url.search}`);
});
