import { createRouter } from '../app';

export const boardsApi = createRouter();

boardsApi.get('/api/boards', async (c) => c.json(await c.get('boards').list()));

boardsApi.post('/api/boards', async (c) => {
    const { name } = await c.req.json<{ name: string }>();

    if (!name?.trim()) {
        return c.json({ error: 'A name is required.' }, 422);
    }

    return c.json(await c.get('boards').create(name), 201);
});

boardsApi.delete('/api/boards/:id', async (c) => {
    await c.get('boards').delete(Number(c.req.param('id')));

    return c.body(null, 204);
});

boardsApi.post('/api/boards/:id/drops', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>();
    await c.get('boards').addDrops(Number(c.req.param('id')), ids);

    return c.body(null, 204);
});

boardsApi.delete('/api/boards/:id/drops/:dropId', async (c) => {
    await c.get('boards').removeDrop(Number(c.req.param('id')), c.req.param('dropId'));

    return c.body(null, 204);
});
