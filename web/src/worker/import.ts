import { Hono } from 'hono';
import type { DropKind, Privacy } from '../shared/types';
import type { Env } from './drops';
import { automaticTags, contentTypeFor, kindFor, normalizeTag } from './kinds';

type ImportEnv = Env & { IMPORT_TOKEN?: string };

export interface ImportMetadata {
    id: string;
    filename: string;
    title: string;
    contentType?: string;
    kind?: DropKind;
    createdAt: number;
    views: number;
    tags: string[];
    privacy: Privacy;
    allowDownload: boolean;
    targetUrl?: string | null;
}

/**
 * One-off bulk import used by import/import.mjs. Disabled unless the IMPORT_TOKEN secret is set;
 * delete the secret once the import is finished.
 */
export const importer = new Hono<{ Bindings: ImportEnv }>();

importer.use('*', async (c, next) => {
    const expected = c.env.IMPORT_TOKEN;
    const given = (c.req.header('Authorization') ?? '').replace(/^Bearer /, '');

    if (!expected || !(await sameSecret(given, expected))) {
        return c.json({ error: 'Not found' }, 404);
    }

    await next();
});

importer.get('/existing', async (c) => {
    const rows = await c.env.DB.prepare('SELECT id FROM drops').all<{ id: string }>();

    return c.json(rows.results.map((row) => row.id));
});

/** Small files: the body is the file, metadata travels in the X-Drop header as JSON. */
importer.put('/file', async (c) => {
    const meta = JSON.parse(decodeURIComponent(c.req.header('X-Drop') ?? '')) as ImportMetadata;
    const key = `${meta.id}/${meta.filename}`;
    const contentType = contentTypeFor(meta.filename, meta.contentType);

    const object = await c.env.BUCKET.put(key, c.req.raw.body, { httpMetadata: { contentType } });
    await record(c.env, meta, key, contentType, object.size);

    return c.json({ id: meta.id, size: object.size });
});

importer.post('/multipart/start', async (c) => {
    const { id, filename, contentType } = await c.req.json<{ id: string; filename: string; contentType?: string }>();
    const upload = await c.env.BUCKET.createMultipartUpload(`${id}/${filename}`, { httpMetadata: { contentType: contentTypeFor(filename, contentType) } });

    return c.json({ key: upload.key, uploadId: upload.uploadId });
});

importer.put('/multipart/part', async (c) => {
    const upload = c.env.BUCKET.resumeMultipartUpload(c.req.query('key')!, c.req.query('uploadId')!);
    const part = await upload.uploadPart(Number(c.req.query('part')), c.req.raw.body!);

    return c.json(part);
});

importer.post('/multipart/complete', async (c) => {
    const { key, uploadId, parts, meta } = await c.req.json<{ key: string; uploadId: string; parts: R2UploadedPart[]; meta: ImportMetadata }>();
    const object = await c.env.BUCKET.resumeMultipartUpload(key, uploadId).complete(parts);
    await record(c.env, meta, key, contentTypeFor(meta.filename, meta.contentType), object.size);

    return c.json({ id: meta.id, size: object.size });
});

async function record(env: Env, meta: ImportMetadata, key: string, contentType: string, size: number): Promise<void> {
    const kind = meta.kind ?? kindFor(meta.filename, contentType);
    const tags = [...new Set([...automaticTags(meta.filename, kind), ...meta.tags.map(normalizeTag), 'droplr'].filter(Boolean))];

    // Upsert: the hourly sync may have registered the object with default metadata in the meantime.
    await env.DB.batch([
        env.DB.prepare(
            `INSERT INTO drops (id, object_key, filename, title, kind, content_type, size, created_at, privacy, allow_download, views, target_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET object_key = excluded.object_key, filename = excluded.filename, title = excluded.title, kind = excluded.kind,
                content_type = excluded.content_type, size = excluded.size, created_at = excluded.created_at, privacy = excluded.privacy,
                allow_download = excluded.allow_download, views = excluded.views, target_url = excluded.target_url`,
        ).bind(meta.id, key, meta.filename, meta.title, kind, contentType, size, meta.createdAt, meta.privacy, meta.allowDownload ? 1 : 0, meta.views, meta.targetUrl ?? null),
        env.DB.prepare('DELETE FROM drop_tags WHERE drop_id = ?').bind(meta.id),
        ...tags.map((tag) => env.DB.prepare('INSERT INTO drop_tags (drop_id, tag) VALUES (?, ?)').bind(meta.id, tag)),
    ]);
}

async function sameSecret(a: string, b: string): Promise<boolean> {
    const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const [left, right] = await Promise.all([digest(a), digest(b)]);

    return left.every((byte, index) => byte === right[index]);
}
