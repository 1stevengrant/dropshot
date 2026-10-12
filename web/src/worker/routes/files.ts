import { createRouter } from '../app';
import { serveFile } from '../http/serveFile';
import { viewableDrop } from '../http/viewableDrop';

export const files = createRouter();

files.on(['GET', 'HEAD'], '/:id/*', async (c) => {
    const row = await viewableDrop(c);

    if (row instanceof Response) {
        return row;
    }

    return serveFile(c, row);
});
