// Imports a Droplr account into Dropshot.
//
// Usage: node import.mjs <export-folder> [--dry-run] [--limit=N]
// Needs droplr-metadata.json and match.json (from match.py) next to this script, and the import token in .import-token.
// Safe to re-run: drops that already exist in Dropshot are skipped.

import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const exportDir = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const limit = limitArgument ? Number(limitArgument.split('=')[1]) : Infinity;
const origin = 'https://d.ghijk.nz';
const token = readFileSync(join(here, '.import-token'), 'utf8').trim();
const cacheDir = join(here, 'originals');
const multipartThreshold = 90 * 1024 * 1024;
const partSize = 50 * 1024 * 1024;
const concurrency = 4;

const extensions = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/svg+xml': 'svg', 'image/tiff': 'tiff',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v',
    'application/pdf': 'pdf', 'application/zip': 'zip', 'text/plain': 'txt',
};

const drops = JSON.parse(readFileSync(join(here, 'droplr-metadata.json'), 'utf8'));
const { matches } = JSON.parse(readFileSync(join(here, 'match.json'), 'utf8'));
const log = createWriteStream(join(here, 'import-log.jsonl'), { flags: 'a' });

const headers = { Authorization: `Bearer ${token}` };
const existing = new Set(await (await fetch(`${origin}/_import/existing`, { headers })).json());

const todo = drops.filter((drop) => !existing.has(drop.code)).sort((a, b) => a.createdAt - b.createdAt).slice(0, limit);
const stats = { imported: 0, failed: 0, downloaded: 0, skipped: drops.filter((drop) => existing.has(drop.code)).length };

console.log(`${drops.length} Droplr drops, ${stats.skipped} already imported, ${todo.length} in this run${dryRun ? ' (dry run)' : ''}`);

let cursor = 0;
await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < todo.length) {
        const drop = todo[cursor++];

        try {
            await importDrop(drop);
            stats.imported++;
            log.write(`${JSON.stringify({ code: drop.code, ok: true })}\n`);
        } catch (error) {
            stats.failed++;
            log.write(`${JSON.stringify({ code: drop.code, ok: false, error: String(error.message ?? error) })}\n`);
            console.error(`✗ ${drop.code} ${drop.title}: ${error.message ?? error}`);
        }

        const done = stats.imported + stats.failed;

        if (done % 50 === 0) {
            console.log(`${done}/${todo.length} (${stats.failed} failed, ${stats.downloaded} downloaded from Droplr)`);
        }
    }
}));

log.end();
console.log(`Done: ${stats.imported} imported, ${stats.failed} failed, ${stats.skipped} skipped, ${stats.downloaded} downloaded from Droplr.`);

async function importDrop(drop) {
    const base = {
        id: drop.code,
        createdAt: drop.createdAt,
        views: drop.views ?? 0,
        tags: (drop.tags ?? []).filter((tag) => !['image', 'video', 'file', 'note', 'link'].includes(tag)),
        privacy: drop.privacy === 'PRIVATE' ? 'private' : 'public',
        allowDownload: drop.downloadable !== false,
    };

    if (drop.type === 'NOTE') {
        const title = drop.title?.trim() || firstLine(drop.content) || 'Note';
        const filename = `${safeName(title).slice(0, 80)}.${drop.variant === 'markdown' ? 'md' : 'txt'}`;

        return put({ ...base, filename, title, kind: 'text', contentType: 'text/plain; charset=utf-8' }, Buffer.from(drop.content ?? '', 'utf8'));
    }

    if (drop.type === 'LINK') {
        const url = String(drop.content ?? '').trim();
        const escaped = url.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const html = `<!doctype html><meta charset=utf-8><meta http-equiv=refresh content="0;url=${escaped}"><title>Redirecting</title><a href="${escaped}">${escaped}</a>`;
        const title = drop.title?.trim().replace(/^- /, '') || url.replace(/^https?:\/\//, '');

        return put({ ...base, filename: 'index.html', title, kind: 'link', contentType: 'text/html', targetUrl: url }, Buffer.from(html, 'utf8'));
    }

    const path = matches[drop.code] ? join(exportDir, matches[drop.code]) : await downloadOriginal(drop);
    const title = drop.title?.trim() || drop.code;
    const filename = matches[drop.code] ?? withExtension(safeName(title), drop.variant);
    const meta = { ...base, filename, title: titleWithoutExtension(title), contentType: drop.variant };

    if (statSync(path).size > multipartThreshold) {
        return putMultipart(meta, path);
    }

    return put(meta, await readFile(path));
}

async function put(meta, body) {
    if (dryRun) {
        return;
    }

    const response = await retry(() => fetch(`${origin}/_import/file`, {
        method: 'PUT',
        headers: { ...headers, 'X-Drop': encodeURIComponent(JSON.stringify(meta)) },
        body,
    }));

    if (!response.ok) {
        throw new Error(`upload failed (${response.status}) ${await response.text()}`);
    }
}

async function putMultipart(meta, path) {
    if (dryRun) {
        return;
    }

    const start = await (await fetch(`${origin}/_import/multipart/start`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: meta.id, filename: meta.filename, contentType: meta.contentType }),
    })).json();

    const file = await open(path);
    const size = (await file.stat()).size;
    const parts = [];

    try {
        for (let offset = 0, number = 1; offset < size; offset += partSize, number++) {
            const buffer = Buffer.alloc(Math.min(partSize, size - offset));
            await file.read(buffer, 0, buffer.length, offset);

            const query = new URLSearchParams({ key: start.key, uploadId: start.uploadId, part: String(number) });
            const response = await retry(() => fetch(`${origin}/_import/multipart/part?${query}`, { method: 'PUT', headers, body: buffer }));

            if (!response.ok) {
                throw new Error(`part ${number} failed (${response.status})`);
            }

            parts.push(await response.json());
        }
    } finally {
        await file.close();
    }

    const response = await fetch(`${origin}/_import/multipart/complete`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: start.key, uploadId: start.uploadId, parts, meta }),
    });

    if (!response.ok) {
        throw new Error(`completing upload failed (${response.status}) ${await response.text()}`);
    }
}

/** Public Droplr drops serve their stored file at d.pr/<type>/<code>+ without signing in. */
async function downloadOriginal(drop) {
    const target = join(cacheDir, drop.code);

    if (existsSync(target) && statSync(target).size > 0) {
        return target;
    }

    if (dryRun) {
        throw new Error('not in export (would download from Droplr)');
    }

    mkdirSync(cacheDir, { recursive: true });

    const letter = { IMAGE: 'i', VIDEO: 'v' }[drop.type] ?? 'f';
    const response = await retry(() => fetch(`https://d.pr/${letter}/${drop.code}+`, { redirect: 'follow' }));
    const type = response.headers.get('content-type') ?? '';

    if (!response.ok || type.startsWith('text/html')) {
        throw new Error(`Droplr returned ${response.status} ${type}`);
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
    stats.downloaded++;

    return target;
}

async function retry(request, attempts = 4) {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await request();

            if (response.status < 500 || attempt === attempts) {
                return response;
            }
        } catch (error) {
            if (attempt === attempts) {
                throw error;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
}

function safeName(name) {
    return name.replace(/[/\\]/g, '-').replace(/[\u0000-\u001f]/g, '').trim() || 'file';
}

function withExtension(name, mime) {
    const extension = extensions[mime];

    if (!extension || name.toLowerCase().endsWith(`.${extension}`) || /\.[a-z0-9]{2,5}$/i.test(name)) {
        return name;
    }

    return `${name}.${extension}`;
}

function titleWithoutExtension(filename) {
    const dot = filename.lastIndexOf('.');

    return dot > 0 ? filename.slice(0, dot) : filename;
}

function firstLine(text) {
    return String(text ?? '').split('\n').map((line) => line.trim()).find(Boolean)?.slice(0, 60);
}
