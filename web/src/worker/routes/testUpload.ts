import { createRouter } from '../app';

export const testUpload = createRouter();

/** The Mac app's "Test Upload" writes here to check the bucket is reachable; it is never a drop. */
testUpload.get('/_test/:file', async (c) => {
    const object = await c.env.BUCKET.get(`_test/${c.req.param('file')}`);

    return object ? new Response(object.body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }) : c.notFound();
});
