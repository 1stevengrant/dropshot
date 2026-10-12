import type { DropKind, DropQuery, DropUpdate } from '../../shared/types';
import { createRouter } from '../app';
import { serveObject } from '../http/serveObject';
import { contentTypeFor } from '../kinds';

export const dropsApi = createRouter();

dropsApi.get('/api/drops', async (c) => {
    const drops = c.get('drops');
    // Listing the bucket takes seconds with thousands of drops; never make the dashboard wait for it.
    c.executionCtx.waitUntil(c.get('sync').syncIfStale());

    const query: DropQuery = {
        q: c.req.query('q') || undefined,
        kind: (c.req.query('kind') as DropKind) || undefined,
        tag: c.req.query('tag') || undefined,
        board: c.req.query('board') ? Number(c.req.query('board')) : undefined,
        sort: (c.req.query('sort') as DropQuery['sort']) || undefined,
        trash: ['1', 'true'].includes(c.req.query('trash') ?? '') || undefined,
        dir: (c.req.query('dir') as DropQuery['dir']) || undefined,
        page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
    };

    return c.json(await drops.list(query));
});

dropsApi.get('/api/drops/:id', async (c) => {
    const drop = await c.get('drops').get(c.req.param('id'));

    return drop ? c.json(drop) : c.json({ error: 'Not found' }, 404);
});

dropsApi.patch('/api/drops/:id', async (c) => {
    const drops = c.get('drops');
    const update = await c.req.json<DropUpdate>();

    if (update.privacy === 'password' && !update.password && !(await drops.find(c.req.param('id')))?.password_hash) {
        return c.json({ error: 'A password is required.' }, 422);
    }

    await drops.update(c.req.param('id'), update);

    return c.json(await drops.get(c.req.param('id')));
});

/** Deleting moves drops to the trash; they are purged after 30 days or with Delete forever. */
dropsApi.delete('/api/drops/:id', async (c) => {
    await c.get('drops').trash([c.req.param('id')]);

    return c.body(null, 204);
});

dropsApi.post('/api/drops/delete', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>();
    await c.get('drops').trash(ids);

    return c.body(null, 204);
});

/** Owner preview of any drop, including private and password-protected ones. */
dropsApi.get('/api/drops/:id/file', async (c) => {
    const row = await c.get('drops').find(c.req.param('id'));

    if (!row) {
        return c.notFound();
    }

    const response = await serveObject(c, row, c.req.query('download') === '1');

    // The dashboard versions display URLs by size (a replaced file gets a new URL), so the browser can keep them.
    if (c.req.query('v') && response.ok) {
        response.headers.set('Cache-Control', 'private, max-age=31536000, immutable');
    }

    return response;
});

dropsApi.get('/api/drops/:id/activity', async (c) => c.json(await c.get('visits').forDrop(c.req.param('id'))));

dropsApi.put('/api/drops/:id/file', async (c) => {
    const drops = c.get('drops');
    const row = await drops.find(c.req.param('id'));
    const filename = decodeURIComponent(c.req.header('X-Filename') ?? '').replace(/[/\\]/g, '_').trim();

    if (!row || !filename || !c.req.raw.body) {
        return c.json({ error: 'Missing drop or file.' }, 422);
    }

    await drops.replaceFile(row, filename, contentTypeFor(filename, c.req.header('Content-Type')), c.req.raw.body);

    return c.json(await drops.get(row.id));
});
