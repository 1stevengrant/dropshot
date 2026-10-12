import { isOwnerAnywhere } from '../auth/ownerCookie';
import { createRouter } from '../app';
import { viewableDrop } from '../http/viewableDrop';
import { embedPage } from '../pages/embedPage';
import { visitFrom } from '../visits/visitFrom';

export const embed = createRouter();

embed.get('/:id/embed', async (c) => {
    const row = await viewableDrop(c);

    if (row instanceof Response) {
        return row;
    }

    if (!(await isOwnerAnywhere(c.req.raw, c.env))) {
        c.executionCtx.waitUntil(c.get('visits').record(row.id, visitFrom(c.req.raw, 'view')));
    }

    const text = row.kind === 'text' && row.size <= 1_000_000 ? await (await c.env.BUCKET.get(row.object_key))?.text() ?? '' : null;

    return c.html(embedPage(row, new URL(c.req.url).origin, text), 200, {
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "frame-ancestors *",
    });
});
