import { getCookie } from 'hono/cookie';
import { isOwnerAnywhere } from '../auth/ownerCookie';
import type { AppContext } from '../app';
import type { DropRow } from '../drops';
import { messagePage } from '../pages/messagePage';
import { passwordPage } from '../pages/passwordPage';
import { unlockToken } from '../password';

/** Applies expiry, privacy and password rules. Returns the drop, or the response to send instead. */
export async function viewableDrop(c: AppContext, id = c.req.param('id') ?? ''): Promise<DropRow | Response> {
    const drops = c.get('drops');
    let row = await drops.find(id);

    if (!row) {
        // A drop uploaded moments ago by the Mac app may not be registered yet.
        await c.get('sync').syncIfStale(5_000);
        row = await drops.find(id);
    }

    if (!row) {
        return c.html(messagePage('Drop not found', 'This link doesn’t point to anything. It may have been deleted.'), 404);
    }

    if (row.deleted_at !== null) {
        // The owner can still open a trashed drop to restore it.
        if (await isOwnerAnywhere(c.req.raw, c.env)) {
            return row;
        }

        return c.html(messagePage('This drop has been deleted', 'Its owner removed it, so the link no longer works.'), 410);
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
