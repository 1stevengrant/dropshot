import { createRouter } from '../app';

export const tagsApi = createRouter();

tagsApi.get('/api/tags', async (c) => c.json(await c.get('tags').counts()));
