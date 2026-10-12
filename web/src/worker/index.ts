import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { DropKind, DropQuery, DropUpdate } from '../shared/types';
import { isOwner, isOwnerAnywhere, ownerCookieHeader } from './access';
import { type DropRow, Drops, type Env } from './drops';
import { contentTypeFor, kindFor } from './kinds';
import { importer } from './import';
import { dropPage, embedPage, messagePage, passwordPage } from './page';
import { unlockToken, verifyPassword } from './password';

type App = { Bindings: Env; Variables: { drops: Drops } };

const app = new Hono<App>();

app.use('*', async (c, next) => {
    c.set('drops', new Drops(c.env, new URL(c.req.url).origin));
    await next();
});

// Dashboard and API: Cloudflare Access guards these at the edge; the JWT is verified again here.
app.use('/app/*', ownerOnly);
app.use('/app', ownerOnly);
app.use('/api/*', ownerOnly);

async function ownerOnly(c: Context<App>, next: () => Promise<void>) {
    if (!(await isOwner(c.req.raw, c.env))) {
        return c.text('Sign in through Cloudflare Access to use the dashboard.', 403);
    }

    await next();

    const header = c.req.path.startsWith('/app') ? await ownerCookieHeader(c.env) : null;

    if (header) {
        c.res = new Response(c.res.body, c.res);
        c.res.headers.append('Set-Cookie', header);
    }
}

app.route('/_import', importer);

app.get('/', (c) => c.redirect('/app/'));

app.get('/app', (c) => c.redirect('/app/'));

app.get('/app/*', async (c) => {
    const asset = await c.env.ASSETS.fetch(c.req.raw);

    if (asset.status !== 404) {
        return asset;
    }

    return c.env.ASSETS.fetch(new Request(new URL('/app/', c.req.url), c.req.raw));
});

app.get('/api/drops', async (c) => {
    const drops = c.get('drops');
    // Listing the bucket takes seconds with thousands of drops; never make the dashboard wait for it.
    c.executionCtx.waitUntil(drops.syncIfStale());

    const query: DropQuery = {
        q: c.req.query('q') || undefined,
        kind: (c.req.query('kind') as DropKind) || undefined,
        tag: c.req.query('tag') || undefined,
        board: c.req.query('board') ? Number(c.req.query('board')) : undefined,
        sort: (c.req.query('sort') as DropQuery['sort']) || undefined,
        dir: (c.req.query('dir') as DropQuery['dir']) || undefined,
        page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
    };

    return c.json(await drops.list(query));
});

app.get('/api/drops/:id', async (c) => {
    const drop = await c.get('drops').get(c.req.param('id'));

    return drop ? c.json(drop) : c.json({ error: 'Not found' }, 404);
});

app.patch('/api/drops/:id', async (c) => {
    const drops = c.get('drops');
    const update = await c.req.json<DropUpdate>();

    if (update.privacy === 'password' && !update.password && !(await drops.find(c.req.param('id')))?.password_hash) {
        return c.json({ error: 'A password is required.' }, 422);
    }

    await drops.update(c.req.param('id'), update);

    return c.json(await drops.get(c.req.param('id')));
});

app.delete('/api/drops/:id', async (c) => {
    await c.get('drops').delete([c.req.param('id')]);

    return c.body(null, 204);
});

app.post('/api/drops/delete', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>();
    await c.get('drops').delete(ids);

    return c.body(null, 204);
});

/** Owner preview of any drop, including private and password-protected ones. */
app.get('/api/drops/:id/file', async (c) => {
    const row = await c.get('drops').find(c.req.param('id'));

    return row ? serveObject(c, row, c.req.query('download') === '1') : c.notFound();
});

app.get('/api/drops/:id/activity', async (c) => c.json(await c.get('drops').activity(c.req.param('id'))));

app.put('/api/drops/:id/file', async (c) => {
    const drops = c.get('drops');
    const row = await drops.find(c.req.param('id'));
    const filename = decodeURIComponent(c.req.header('X-Filename') ?? '').replace(/[/\\]/g, '_').trim();

    if (!row || !filename || !c.req.raw.body) {
        return c.json({ error: 'Missing drop or file.' }, 422);
    }

    await drops.replaceFile(row, filename, contentTypeFor(filename, c.req.header('Content-Type')), c.req.raw.body);

    return c.json(await drops.get(row.id));
});

app.post('/api/upload', async (c) => {
    const filename = decodeURIComponent(c.req.header('X-Filename') ?? '').replace(/[/\\]/g, '_').trim();

    if (!filename || !c.req.raw.body) {
        return c.json({ error: 'Missing file.' }, 422);
    }

    const id = shortId();
    const key = [c.env.KEY_PREFIX.replace(/\/+$/, ''), id, filename].filter(Boolean).join('/');
    const title = decodeURIComponent(c.req.header('X-Title') ?? '').trim();
    const contentType = contentTypeFor(filename, c.req.header('Content-Type'));

    const object = await c.env.BUCKET.put(key, c.req.raw.body, { httpMetadata: { contentType } });
    const drops = c.get('drops');

    await drops.insert({ id, objectKey: key, filename, kind: kindFor(filename, contentType), contentType, size: object.size, createdAt: Date.now(), targetUrl: null });

    if (title) {
        await drops.update(id, { title });
    }

    return c.json(await drops.get(id), 201);
});

app.get('/api/tags', async (c) => c.json(await c.get('drops').tags()));

app.get('/api/boards', async (c) => c.json(await c.get('drops').boards()));

app.post('/api/boards', async (c) => {
    const { name } = await c.req.json<{ name: string }>();

    if (!name?.trim()) {
        return c.json({ error: 'A name is required.' }, 422);
    }

    return c.json(await c.get('drops').createBoard(name), 201);
});

app.delete('/api/boards/:id', async (c) => {
    await c.get('drops').deleteBoard(Number(c.req.param('id')));

    return c.body(null, 204);
});

app.post('/api/boards/:id/drops', async (c) => {
    const { ids } = await c.req.json<{ ids: string[] }>();
    await c.get('drops').addToBoard(Number(c.req.param('id')), ids);

    return c.body(null, 204);
});

app.delete('/api/boards/:id/drops/:dropId', async (c) => {
    await c.get('drops').removeFromBoard(Number(c.req.param('id')), c.req.param('dropId'));

    return c.body(null, 204);
});

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Public drop pages and files.

/** The Mac app's "Test Upload" writes here to check the bucket is reachable; it is never a drop. */
app.get('/_test/:file', async (c) => {
    const object = await c.env.BUCKET.get(`_test/${c.req.param('file')}`);

    return object ? new Response(object.body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } }) : c.notFound();
});

app.get('/:id', async (c) => {
    const drops = c.get('drops');
    const row = await viewableDrop(c);

    if (row instanceof Response) {
        return row;
    }

    const owner = await isOwnerAnywhere(c.req.raw, c.env);

    // Like Droplr, the owner gets the management view at the share link; ?preview shows what visitors see.
    if (owner && c.req.query('preview') === undefined) {
        return c.redirect(`/app/d/${row.id}`, 302);
    }

    if (!owner) {
        c.executionCtx.waitUntil(drops.recordVisit(row.id, visitFrom(c.req.raw, 'view')));
    }

    if (row.kind === 'link' && row.target_url) {
        return c.redirect(row.target_url, 302);
    }

    const text = row.kind === 'text' && row.size <= 1_000_000 ? await (await c.env.BUCKET.get(row.object_key))?.text() ?? '' : null;

    return c.html(dropPage(row, new URL(c.req.url).origin, text), 200, { 'Cache-Control': 'private, no-store' });
});

app.get('/:id/embed', async (c) => {
    const row = await viewableDrop(c);

    if (row instanceof Response) {
        return row;
    }

    if (!(await isOwnerAnywhere(c.req.raw, c.env))) {
        c.executionCtx.waitUntil(c.get('drops').recordVisit(row.id, visitFrom(c.req.raw, 'view')));
    }

    const text = row.kind === 'text' && row.size <= 1_000_000 ? await (await c.env.BUCKET.get(row.object_key))?.text() ?? '' : null;

    return c.html(embedPage(row, new URL(c.req.url).origin, text), 200, {
        'Cache-Control': 'private, no-store',
        'Content-Security-Policy': "frame-ancestors *",
    });
});

app.post('/:id/unlock', async (c) => {
    const row = await c.get('drops').find(c.req.param('id'));

    if (!row || row.privacy !== 'password' || !row.password_hash) {
        return c.redirect(`/${c.req.param('id')}`);
    }

    const form = await c.req.formData();
    const password = String(form.get('password') ?? '');

    if (!(await verifyPassword(password, row.password_hash))) {
        return c.html(passwordPage(row, true), 401);
    }

    setCookie(c, `unlock_${row.id}`, await unlockToken(row.id, row.password_hash), {
        path: `/${row.id}`,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        maxAge: 60 * 60 * 24 * 30,
    });

    return c.redirect(`/${row.id}`, 303);
});

app.on(['GET', 'HEAD'], '/:id/*', async (c) => {
    const row = await viewableDrop(c);

    if (row instanceof Response) {
        return row;
    }

    const download = c.req.query('download') === '1';

    const owner = await isOwnerAnywhere(c.req.raw, c.env);

    if (download && !row.allow_download && !owner) {
        return c.text('Downloads are disabled for this drop.', 403);
    }

    if (download && !owner) {
        c.executionCtx.waitUntil(c.get('drops').recordVisit(row.id, visitFrom(c.req.raw, 'download')));
    }

    return serveObject(c, row, download);
});

/** Applies expiry, privacy and password rules. Returns the drop, or the response to send instead. */
async function viewableDrop(c: Context<App>): Promise<DropRow | Response> {
    const drops = c.get('drops');
    const id = c.req.param('id') ?? '';
    let row = await drops.find(id);

    if (!row) {
        // A drop uploaded moments ago by the Mac app may not be registered yet.
        await drops.syncIfStale(5_000);
        row = await drops.find(id);
    }

    if (!row) {
        return c.html(messagePage('Drop not found', 'This link doesn’t point to anything. It may have been deleted.'), 404);
    }

    if (row.expires_at !== null && row.expires_at <= Date.now()) {
        return c.html(messagePage('This drop has expired', 'Its owner set it to self-destruct, and it’s gone.'), 410);
    }

    if (row.privacy === 'public') {
        return row;
    }

    if (await isOwnerAnywhere(c.req.raw, c.env)) {
        return row;
    }

    if (row.privacy === 'private') {
        return c.html(messagePage('This drop is private', 'Only its owner can view it.', { label: 'Sign in', href: `/app/d/${row.id}` }), 403);
    }

    const cookie = getCookie(c, `unlock_${row.id}`);

    if (row.password_hash && cookie && cookie === (await unlockToken(row.id, row.password_hash))) {
        return row;
    }

    return c.html(passwordPage(row, false), 401);
}

/** Streams an R2 object with range support so video seeking works. */
async function serveObject(c: Context<App>, row: DropRow, download: boolean): Promise<Response> {
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

    if (row.kind === 'text' || row.kind === 'link' || row.content_type.includes('html') || row.content_type.includes('svg')) {
        // Never let uploaded HTML or SVG run scripts on this origin.
        headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox");
    }

    const body = 'body' in object ? (object as R2ObjectBody).body : null;

    if (!body) {
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

function visitFrom(request: Request, kind: 'view' | 'download') {
    const cf = (request as Request & { cf?: { country?: string; city?: string } }).cf;
    const referrer = request.headers.get('Referer');
    let referrerHost: string | null = null;

    try {
        referrerHost = referrer ? new URL(referrer).hostname : null;
    } catch {
        referrerHost = null;
    }

    return { kind, country: cf?.country ?? null, city: cf?.city ?? null, referrer: referrerHost, browser: browserName(request.headers.get('User-Agent') ?? '') };
}

function browserName(agent: string): string | null {
    const bots = /(bot|crawler|spider|slack|discord|twitter|facebook|whatsapp|telegram|preview)/i.exec(agent);

    if (bots) {
        return `${bots[1][0].toUpperCase()}${bots[1].slice(1).toLowerCase()} preview`;
    }

    const browsers: [RegExp, string][] = [[/Edg\//, 'Edge'], [/OPR\//, 'Opera'], [/Firefox\//, 'Firefox'], [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari'], [/curl\//, 'curl']];
    const browser = browsers.find(([pattern]) => pattern.test(agent))?.[1] ?? null;
    const os = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : null;

    return [browser, os].filter(Boolean).join(' on ') || null;
}

function shortId(length = 8): string {
    const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(length));

    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export default {
    fetch: app.fetch,

    async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
        const drops = new Drops(env, '');
        ctx.waitUntil(drops.sync().catch((error) => console.error('Scheduled sync failed', error)).then(() => drops.purgeExpired()));
    },
} satisfies ExportedHandler<Env>;
