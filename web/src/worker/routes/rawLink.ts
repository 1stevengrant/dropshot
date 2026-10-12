import { createRouter } from '../app';
import { serveFile } from '../http/serveFile';
import { viewableDrop } from '../http/viewableDrop';

export const rawLink = createRouter();

/** Droplr style raw link: d.ghijk.nz/<id>+ serves the file itself. */
rawLink.on(['GET', 'HEAD'], '/:raw{[A-Za-z0-9_-]{3,40}\\+}', async (c) => {
    const id = c.req.param('raw').slice(0, -1);
    const row = await viewableDrop(c, id);

    if (row instanceof Response) {
        return row;
    }

    return serveFile(c, row);
});
