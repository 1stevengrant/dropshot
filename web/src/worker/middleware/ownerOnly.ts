import { isOwner } from '../auth/accessToken';
import { ownerCookieHeader } from '../auth/ownerCookie';
import type { AppContext } from '../app';

/** Cloudflare Access guards the dashboard and API at the edge; the JWT is verified again here. */
export async function ownerOnly(c: AppContext, next: () => Promise<void>) {
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
