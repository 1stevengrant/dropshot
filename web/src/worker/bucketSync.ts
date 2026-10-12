import { contentTypeFor, kindFor } from './kinds';
import type { Drops } from './drops';
import type { Env } from './types';
import { parseHttpUrl } from './urls/parseHttpUrl';

let inflightSync: Promise<number> | null = null;
let lastSyncAt = 0;

/** Registers objects the Mac app uploads straight to R2 as drops. */
export class BucketSync {
    constructor(private readonly env: Env, private readonly drops: Drops) {}

    /**
     * Registers new uploads, at most every 30 seconds per isolate and never more than one at a time. Listing the whole
     * bucket on every request made R2 refuse concurrent lists (10058); a failed sync now only delays new drops.
     */
    async syncIfStale(maxAgeMs = 30_000): Promise<void> {
        if (inflightSync) {
            await inflightSync.catch(() => 0);

            return;
        }

        if (Date.now() - lastSyncAt < maxAgeMs) {
            return;
        }

        inflightSync = this.sync();

        try {
            await inflightSync;
            lastSyncAt = Date.now();
        } catch (error) {
            console.error('Sync failed', error);
        } finally {
            inflightSync = null;
        }
    }

    /**
     * The Mac app uploads straight to R2, so new objects are registered here. Keys look like `<id>/<filename>`
     * (or `<id>.<ext>` for short-ID links), under an optional prefix. Keys starting with `_` are ignored.
     */
    async sync(): Promise<number> {
        const known = new Set(
            (await this.env.DB.prepare('SELECT object_key FROM drops').all<{ object_key: string }>()).results.map((row) => row.object_key),
        );

        const prefix = this.env.KEY_PREFIX ? `${this.env.KEY_PREFIX.replace(/\/+$/, '')}/` : '';
        let cursor: string | undefined;
        let added = 0;

        do {
            const page = await this.env.BUCKET.list({ prefix, cursor, include: ['httpMetadata', 'customMetadata'] });
            cursor = page.truncated ? page.cursor : undefined;

            for (const object of page.objects) {
                if (known.has(object.key)) {
                    continue;
                }

                if (await this.register(object, prefix)) {
                    added++;
                }
            }
        } while (cursor);

        return added;
    }

    private async register(object: R2Object, prefix: string): Promise<boolean> {
        const relative = object.key.slice(prefix.length);

        if (!relative || relative.startsWith('_')) {
            return false;
        }

        const slash = relative.indexOf('/');
        const filename = slash === -1 ? relative : relative.slice(slash + 1);
        const id = slash === -1 ? relative.replace(/\.[^.]+$/, '') : relative.slice(0, slash);

        if (!/^[A-Za-z0-9_-]{3,40}$/.test(id) || !filename) {
            return false;
        }

        const contentType = contentTypeFor(filename, object.httpMetadata?.contentType);
        const kind = filename === 'index.html' ? 'link' : kindFor(filename, contentType);
        const targetUrl = kind === 'link' ? await this.redirectTarget(object.key) : this.sourceUrl(object);

        await this.drops.insert({
            id,
            objectKey: object.key,
            filename,
            kind,
            contentType,
            size: object.size,
            createdAt: object.uploaded.getTime(),
            targetUrl,
        });

        const title = this.metadata(object, 'title');

        if (title) {
            await this.drops.update(id, { title });
        }

        return true;
    }

    /** Web page captures from the Mac app carry the page they came from as `x-amz-meta-source-url`. */
    private sourceUrl(object: R2Object): string | null {
        return parseHttpUrl(this.metadata(object, 'source-url'))?.href ?? null;
    }

    /** The Mac app percent-encodes metadata values because S3 headers must be ASCII. */
    private metadata(object: R2Object, name: string): string {
        const value = object.customMetadata?.[name] ?? '';

        try {
            return decodeURIComponent(value).trim();
        } catch {
            return value.trim();
        }
    }

    private async redirectTarget(key: string): Promise<string | null> {
        const object = await this.env.BUCKET.get(key);
        const html = object ? await object.text() : '';
        const match = html.match(/url=([^"]+)"/i);

        return match ? match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<') : null;
    }
}
