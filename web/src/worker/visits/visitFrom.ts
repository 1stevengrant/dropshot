import { browserName } from './browserName';

/** What we log about a visit: no IP addresses, just coarse location, referrer host and browser. */
export function visitFrom(request: Request, kind: 'view' | 'download') {
    const cf = (request as Request & { cf?: { country?: string; city?: string } }).cf;
    const referrer = request.headers.get('Referer');
    let referrerHost: string | null = null;

    try {
        referrerHost = referrer ? new URL(referrer).hostname : null;
    } catch {
        referrerHost = null;
    }

    return { kind, country: cf?.country ?? null, city: cf?.city ?? null, referrer: referrerHost, browser: browserName(request.headers.get('User-Agent') ?? '') };
}
