import type { AppContext } from '../app';
import type { DropRow } from '../drops';

/** Streams an R2 object with range support so video seeking works. */
export async function serveObject(c: AppContext, row: DropRow, download: boolean): Promise<Response> {
    const range = c.req.header('Range');
    const object = c.req.method === 'HEAD'
        ? await c.env.BUCKET.head(row.object_key)
        : await c.env.BUCKET.get(row.object_key, { range: c.req.raw.headers, onlyIf: c.req.raw.headers });

    if (!object) {
        return c.text('File not found.', 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Content-Type', row.content_type);
    headers.set('ETag', object.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', row.privacy === 'public' && row.expires_at === null ? 'public, max-age=3600' : 'private, no-store');
    headers.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
    headers.set('X-Content-Type-Options', 'nosniff');

    if (row.kind === 'code') {
        // Show source as text in the browser, whatever type it was uploaded with.
        headers.set('Content-Type', 'text/plain; charset=utf-8');
    }

    if (row.kind === 'text' || row.kind === 'code' || row.kind === 'link' || row.content_type.includes('html') || row.content_type.includes('svg')) {
        // Never let uploaded HTML or SVG run scripts on this origin.
        headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    }

    const body = 'body' in object ? (object as R2ObjectBody).body : null;

    if (!body) {
        const ifMatch = c.req.header('If-Match');
        const unmodifiedSince = c.req.header('If-Unmodified-Since');
        const versionMismatch = ifMatch !== undefined
            ? ifMatch.trim() !== '*' && !ifMatch.split(',').some((etag) => etag.trim() === object.httpEtag)
            : unmodifiedSince !== undefined && Math.floor(object.uploaded.getTime() / 1000) > Math.floor(Date.parse(unmodifiedSince) / 1000);

        if (c.req.method !== 'HEAD' && versionMismatch) {
            headers.set('Content-Length', '0');

            return new Response(null, { status: 412, headers });
        }

        headers.set('Content-Length', String(object.size));

        return new Response(null, { status: c.req.method === 'HEAD' ? 200 : 304, headers });
    }

    if (range && object.range && 'offset' in object.range) {
        const offset = object.range.offset ?? 0;
        const length = object.range.length ?? object.size - offset;
        headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
        headers.set('Content-Length', String(length));

        return new Response(body, { status: 206, headers });
    }

    headers.set('Content-Length', String(object.size));

    return new Response(body, { status: 200, headers });
}
