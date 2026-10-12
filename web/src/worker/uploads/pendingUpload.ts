import type { Env } from '../types';

/** A marker older than this belongs to an upload that crashed or gave up, so its link shows "not found" again. */
const pendingLifetimeMs = 24 * 3_600_000;

/**
 * With instant links the Mac app copies a drop's link before its upload finishes. While the upload runs it keeps a
 * marker at `<prefix>/_pending/<id>`, which bucket sync ignores like every key starting with `_`.
 */
function pendingPrefix(env: Env): string {
    return [env.KEY_PREFIX.replace(/\/+$/, ''), '_pending'].filter(Boolean).join('/') + '/';
}

export async function isUploadPending(env: Env, id: string): Promise<boolean> {
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(id)) {
        return false;
    }

    const marker = await env.BUCKET.head(`${pendingPrefix(env)}${id}`);

    return marker !== null && Date.now() - marker.uploaded.getTime() < pendingLifetimeMs;
}

/** Removes markers the app never cleared, for example when it quit mid upload. */
export async function purgeStalePendingUploads(env: Env): Promise<number> {
    const prefix = pendingPrefix(env);
    const cutoff = Date.now() - pendingLifetimeMs;
    let cursor: string | undefined;
    let purged = 0;

    do {
        const page = await env.BUCKET.list({ prefix, cursor });
        cursor = page.truncated ? page.cursor : undefined;

        const stale = page.objects.filter((object) => object.uploaded.getTime() < cutoff).map((object) => object.key);

        if (stale.length) {
            await env.BUCKET.delete(stale);
            purged += stale.length;
        }
    } while (cursor);

    return purged;
}
