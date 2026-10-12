import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const run = promisify(execFile);

test('todo 960: successful visitor unlock permits the raw + URL', async () => {
    const temporary = await mkdtemp(join(tmpdir(), 'dropshot-960-'));
    let server;
    try {
        // Bundle the actual routers with existing tooling. Storage is an isolated fixture.
        const bundled = await build({
            stdin: {
                contents: `export { createRouter } from '../src/worker/app';
export { unlock } from '../src/worker/routes/unlock';
export { rawLink } from '../src/worker/routes/rawLink';
export { files } from '../src/worker/routes/files';
export { hashPassword } from '../src/worker/password';`,
                resolveDir: dirname(fileURLToPath(import.meta.url)),
                loader: 'ts',
            },
            bundle: true, platform: 'node', format: 'esm', write: false,
        });
        const modulePath = join(temporary, 'routers.mjs');
        await writeFile(modulePath, bundled.outputFiles[0].text);
        const { createRouter, unlock, rawLink, files, hashPassword } = await import(pathToFileURL(modulePath));
        const source = 'console.log("fixture");\n';
        const protectedDrop = {
            id: 'repro960', privacy: 'password', password_hash: await hashPassword('correct-password'),
            deleted_at: null, expires_at: null, filename: 'example.js', kind: 'code',
            object_key: 'repro960/example.js', content_type: 'text/javascript', allow_download: true,
        };
        const publicDrop = { ...protectedDrop, id: 'public960', privacy: 'public', password_hash: null };
        const app = createRouter();
        app.use('*', async (c, next) => {
            c.set('drops', { find: async (id) => id === protectedDrop.id ? protectedDrop : id === publicDrop.id ? publicDrop : null });
            await next();
        });
        app.route('/', unlock);
        app.route('/', rawLink);
        app.route('/', files);
        const env = { BUCKET: { get: async () => ({
            body: source, size: Buffer.byteLength(source), httpEtag: '"fixture"', writeHttpMetadata() {},
        }) } };
        server = createServer(async (req, res) => {
            try {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const response = await app.fetch(new Request(`http://localhost${req.url}`, {
                    method: req.method, headers: req.headers,
                    ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
                }), env);
                res.writeHead(response.status, { ...Object.fromEntries(response.headers), 'set-cookie': response.headers.getSetCookie() });
                res.end(Buffer.from(await response.arrayBuffer()));
            } catch (error) { res.writeHead(500); res.end(String(error)); }
        });
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, '127.0.0.1', resolve);
        });
        const origin = `http://localhost:${server.address().port}`;
        const jar = join(temporary, 'cookies.txt');
        const request = async (path, extra = []) => {
            const { stdout } = await run('curl', ['--silent', '--show-error', '--noproxy', '*',
                '--cookie', jar, '--cookie-jar', jar, '--write-out', '\n%{http_code}', ...extra, origin + path]);
            const split = stdout.lastIndexOf('\n');
            return { body: stdout.slice(0, split), status: Number(stdout.slice(split + 1)) };
        };
        assert.equal((await request('/repro960+')).status, 401, 'locked raw URL must require a password');
        assert.equal((await request('/public960+')).status, 200, 'public raw route must serve normally');
        assert.equal((await request('/repro960/unlock', ['--data', 'password=wrong'])).status, 401);
        assert.equal((await request('/repro960/unlock', ['--data', 'password=correct-password'])).status, 303);
        const nested = await request('/repro960/example.js');
        assert.equal(nested.status, 200, 'curl must retain and send the Secure unlock cookie on localhost');
        assert.equal(nested.body, source);
        const raw = await request('/repro960+');
        assert.equal(raw.status, 200,
            `successful unlock must permit raw + URL; observed ${raw.status}: ${raw.body.includes('This drop is password protected') ? 'password form' : raw.body}`);
        assert.equal(raw.body, source);
    } finally {
        if (server) await new Promise((resolve) => server.close(resolve));
        await rm(temporary, { recursive: true, force: true });
    }
});
