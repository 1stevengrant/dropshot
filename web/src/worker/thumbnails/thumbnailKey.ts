import type { Env } from '../types';

/**
 * Thumbnails live at `<prefix>/_thumbs/<id>`, written by whichever side created the drop (the dashboard, the Mac app,
 * page captures, or the backfill script). Bucket sync ignores keys starting with `_`, so they never become drops.
 */
export function thumbnailKey(env: Env, id: string): string {
    return [env.KEY_PREFIX.replace(/\/+$/, ''), '_thumbs', id].filter(Boolean).join('/');
}
