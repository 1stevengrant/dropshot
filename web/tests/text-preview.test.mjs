import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const bundle = await build({ stdin: { contents: `export { dropText } from './src/worker/http/dropText'; export { dropViewer } from './src/worker/pages/dropViewer'; export { embedPage } from './src/worker/pages/embedPage';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { dropText, dropViewer, embedPage } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const row = { id: 'large123', title: 'Log', filename: 'log.txt', kind: 'text', size: 1_000_001, allow_download: 1 };
test('oversized text offers a file fallback without reading storage', async () => {
    const text = await dropText({ BUCKET: { get() { throw new Error('Oversized preview must not fetch'); } } }, row);
    assert.equal(text, null);
    assert.match(dropViewer(row, '/large123+', text), /Download/);
    assert.doesNotMatch(dropViewer(row, '/large123+', text), /<pre/);
    assert.match(embedPage(row, 'https://example.test', text), /href="https:\/\/example.test\/large123"/);
});
test('disabled downloads remain disabled in fallback', () => {
    assert.match(dropViewer({ ...row, allow_download: 0 }, '/large123+', null), /Downloads are disabled/);
    assert.doesNotMatch(dropViewer({ ...row, allow_download: 0 }, '/large123+', null), /download=1/);
});
test('empty available text is still a valid empty text preview', () => {
    assert.match(dropViewer({ ...row, size: 0 }, '/large123+', ''), /<pre/);
    assert.match(embedPage({ ...row, size: 0 }, 'https://example.test', ''), /<pre/);
});
