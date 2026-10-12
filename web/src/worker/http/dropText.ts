import type { DropRow } from '../drops';
import type { Env } from '../types';

/** Notes and code are shown inline, so their text is read from R2; anything over 1 MB is offered as a download. */
export async function dropText(env: Env, row: DropRow): Promise<string | null> {
    if ((row.kind !== 'text' && row.kind !== 'code') || row.size > 1_000_000) {
        return null;
    }

    return (await (await env.BUCKET.get(row.object_key))?.text()) ?? '';
}
