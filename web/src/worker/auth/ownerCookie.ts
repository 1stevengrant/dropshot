import { readCookie } from '../http/readCookie';
import type { AccessConfig } from './accessConfig';
import { isOwner } from './accessToken';

const ownerCookie = 'dropshot_owner';
const ownerCookieLifetime = 60 * 60 * 24 * 30;

/** Access only sends its cookie to /app and /api; this cookie carries the signed-in state to share links. */
export async function ownerCookieHeader(config: AccessConfig): Promise<string | null> {
    if (!config.OWNER_COOKIE_SECRET) {
        return null;
    }

    const expires = Math.floor(Date.now() / 1000) + ownerCookieLifetime;
    const value = `${expires}.${await sign(String(expires), config.OWNER_COOKIE_SECRET)}`;

    return `${ownerCookie}=${value}; Path=/; Max-Age=${ownerCookieLifetime}; HttpOnly; Secure; SameSite=Lax`;
}

/** The owner on any path: a valid Access token, or the owner cookie issued by the dashboard. */
export async function isOwnerAnywhere(request: Request, config: AccessConfig): Promise<boolean> {
    if (await isOwner(request, config)) {
        return true;
    }

    const value = readCookie(request, ownerCookie);

    if (!value || !config.OWNER_COOKIE_SECRET) {
        return false;
    }

    const [expires, signature] = value.split('.');

    if (!expires || !signature || Number(expires) * 1000 < Date.now()) {
        return false;
    }

    return signature === (await sign(expires, config.OWNER_COOKIE_SECRET));
}

async function sign(value: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));

    return btoa(String.fromCharCode(...signature)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
