import { createRouter } from '../app';

export const trashApi = createRouter();

trashApi.get('/api/trash', async (c) => c.json({ count: await c.get('drops').trashCount() }));

trashApi.post('/api/trash/restore', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>();
    await c.get('drops').restore(ids);

    return c.body(null, 204);
});

/** Delete forever: removes the files from R2 and every record of the drops. */
trashApi.post('/api/trash/purge', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>();
    const drops = c.get('drops');
    const trashed = (await Promise.all(ids.map((id) => drops.find(id)))).filter((row) => row?.deleted_at != null).map((row) => row!.id);

    await drops.purge(trashed);

    return c.body(null, 204);
});

trashApi.post('/api/trash/empty', async (c) => c.json({ purged: await c.get('drops').emptyTrash() }));
