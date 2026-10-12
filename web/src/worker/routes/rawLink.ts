import { createRouter } from '../app';
import { serveFile } from '../http/serveFile';
import { viewableDrop } from '../http/viewableDrop';

export const rawLink = createRouter();

/** Native short-ID object URLs retain the file extension. */
rawLink.on(['GET', 'HEAD'], '/:file{[A-Za-z0-9_-]{3,40}\\.[A-Za-z0-9]+}', async (c) => {
    const filename = c.req.param('file');
    const id = filename.slice(0, filename.lastIndexOf('.'));
    const row = await viewableDrop(c, id);

    if (row instanceof Response) {
        return row;
    }

    if (row.filename !== filename) {
        return c.text('File not found.', 404);
    }

    return serveFile(c, row);
});

/** Droplr style raw link: d.ghijk.nz/<id>+ serves the file itself. */
rawLink.on(['GET', 'HEAD'], '/:raw{[A-Za-z0-9_-]{3,40}\\+}', async (c) => {
    const id = c.req.param('raw').slice(0, -1);
    const row = await viewableDrop(c, id);

    if (row instanceof Response) {
        return row;
    }

    return serveFile(c, row);
});
