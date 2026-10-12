import { isOwnerAnywhere } from '../auth/ownerCookie';
import { createRouter } from '../app';
import { dropText } from '../http/dropText';
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

    const text = await dropText(c.env, row);

    return c.html(embedPage(row, new URL(c.req.url).origin, text), 200, {
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "frame-ancestors *",
    });
});
