import { isOwnerAnywhere } from '../auth/ownerCookie';
import { createRouter } from '../app';
import { appShell } from '../http/appShell';
import { viewableDrop } from '../http/viewableDrop';
import { dropPage as renderDropPage } from '../pages/dropPage';
import { visitFrom } from '../visits/visitFrom';

export const dropPage = createRouter();

dropPage.get('/:id', async (c) => {
    const row = await viewableDrop(c);

    if (row instanceof Response) {
        return row;
    }

    const owner = await isOwnerAnywhere(c.req.raw, c.env);

    // Like Droplr, the owner gets the management view at the share link itself (the address stays the same);
    // ?preview shows what visitors see.
    if (owner && c.req.query('preview') === undefined) {
        return appShell(c);
    }

    if (!owner) {
        c.executionCtx.waitUntil(c.get('visits').record(row.id, visitFrom(c.req.raw, 'view')));
    }

    if (row.kind === 'link' && row.target_url) {
        return c.redirect(row.target_url, 302);
    }

    const text = row.kind === 'text' && row.size <= 1_000_000 ? await (await c.env.BUCKET.get(row.object_key))?.text() ?? '' : null;

    return c.html(renderDropPage(row, new URL(c.req.url).origin, text), 200, { 'Cache-Control': 'private, no-store' });
});
