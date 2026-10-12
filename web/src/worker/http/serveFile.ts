import { isOwnerAnywhere } from '../auth/ownerCookie';
import type { AppContext } from '../app';
import type { DropRow } from '../drops';
import { visitFrom } from '../visits/visitFrom';
import { serveObject } from './serveObject';

export async function serveFile(c: AppContext, row: DropRow): Promise<Response> {
    const download = c.req.query('download') === '1';

    const owner = await isOwnerAnywhere(c.req.raw, c.env);

    if (download && !row.allow_download && !owner) {
        return c.text('Downloads are disabled for this drop.', 403);
    }

    if (download && !owner) {
        c.executionCtx.waitUntil(c.get('visits').record(row.id, visitFrom(c.req.raw, 'download')));
    }

    return serveObject(c, row, download);
}
