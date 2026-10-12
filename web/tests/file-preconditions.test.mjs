import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const bundle = await build({ stdin: { contents: `export { createRouter } from './src/worker/app'; export { serveObject } from './src/worker/http/serveObject';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { createRouter, serveObject } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const object = { size: 5, httpEtag: '"current"', uploaded: new Date('2026-01-02T00:00:00.500Z'), writeHttpMetadata() {} };
const row = { object_key: 'test/file.txt', content_type: 'text/plain', filename: 'file.txt', kind: 'text', privacy: 'public', expires_at: null };
for (const [headers, expected] of [
    [{ 'If-Match': '"stale"' }, 412],
    [{ 'If-Match': 'W/"current"' }, 412],
    [{ 'If-Unmodified-Since': 'Thu, 01 Jan 2026 00:00:00 GMT' }, 412],
    [{ 'If-None-Match': '"current"' }, 304],
    [{ 'If-Match': '"stale", "current"', 'If-None-Match': '"current"' }, 304],
    [{ 'If-Match': '*', 'If-None-Match': '"current"' }, 304],
    [{ 'If-Match': '"current"', 'If-Unmodified-Since': 'Thu, 01 Jan 2026 00:00:00 GMT', 'If-None-Match': '"current"' }, 304],
    [{ 'If-Unmodified-Since': 'Fri, 02 Jan 2026 00:00:00 GMT', 'If-None-Match': '"current"' }, 304],
]) {
    test(`conditional GET ${JSON.stringify(headers)} returns ${expected}`, async () => {
        const app = createRouter();
        app.get('/file', c => serveObject(c, row, false));
        const response = await app.request('https://example.test/file', { headers }, { BUCKET: { get: async () => object } });
        assert.equal(response.status, expected);
        assert.equal(await response.text(), '');
        assert.equal(response.headers.get('ETag'), '"current"');
        if (expected === 412) assert.equal(response.headers.get('Content-Length'), '0');
    });
}
