import { createRouter } from '../app';
import { shortId } from '../ids/shortId';
import { contentTypeFor } from '../kinds';
import { recordUpload } from '../uploads/recordUpload';
import { uploadFilename, uploadKey } from '../uploads/uploadKey';

/**
 * Chunked uploads for files too big for one Worker request (100 MB on Free and Pro). The browser starts an R2
 * multipart upload, sends each part as its own request, then completes it, which registers the drop.
 * R2 discards uploads that are never completed after seven days.
 */
export const multipartUploadApi = createRouter();

const validId = /^[A-Za-z0-9]{8}$/;

multipartUploadApi.post('/api/uploads', async (c) => {
    const body = await c.req.json<{ filename?: string; contentType?: string }>();
    const filename = uploadFilename(body.filename ?? '');

    if (!filename) {
        return c.json({ error: 'Missing filename.' }, 422);
    }

    const id = shortId();
    const contentType = contentTypeFor(filename, body.contentType);
    const upload = await c.env.BUCKET.createMultipartUpload(uploadKey(c.env, id, filename), { httpMetadata: { contentType } });

    return c.json({ id, filename, uploadId: upload.uploadId }, 201);
});

multipartUploadApi.put('/api/uploads/:id/parts/:part', async (c) => {
    const id = c.req.param('id');
    const part = Number(c.req.param('part'));
    const uploadId = c.req.query('uploadId') ?? '';
    const filename = uploadFilename(c.req.query('filename') ?? '');

    if (!validId.test(id) || !Number.isInteger(part) || part < 1 || part > 10_000 || !uploadId || !filename || !c.req.raw.body) {
        return c.json({ error: 'Invalid part.' }, 422);
    }

    const uploaded = await c.env.BUCKET.resumeMultipartUpload(uploadKey(c.env, id, filename), uploadId).uploadPart(part, c.req.raw.body);

    return c.json(uploaded);
});

multipartUploadApi.post('/api/uploads/:id/complete', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ uploadId?: string; filename?: string; title?: string; parts?: R2UploadedPart[] }>();
    const filename = uploadFilename(body.filename ?? '');

    if (!validId.test(id) || !body.uploadId || !filename || !body.parts?.length) {
        return c.json({ error: 'Invalid upload.' }, 422);
    }

    const key = uploadKey(c.env, id, filename);
    const object = await c.env.BUCKET.resumeMultipartUpload(key, body.uploadId).complete(body.parts);
    const contentType = object.httpMetadata?.contentType ?? contentTypeFor(filename, undefined);

    return c.json(await recordUpload(c.get('drops'), { id, key, filename, contentType, size: object.size, title: (body.title ?? '').trim() }), 201);
});

multipartUploadApi.delete('/api/uploads/:id', async (c) => {
    const id = c.req.param('id');
    const uploadId = c.req.query('uploadId') ?? '';
    const filename = uploadFilename(c.req.query('filename') ?? '');

    if (!validId.test(id) || !uploadId || !filename) {
        return c.json({ error: 'Invalid upload.' }, 422);
    }

    await c.env.BUCKET.resumeMultipartUpload(uploadKey(c.env, id, filename), uploadId).abort();

    return c.body(null, 204);
});
