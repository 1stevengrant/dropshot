export interface AccessConfig {
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    /** Local development only, set in .dev.vars. Never configure this on the deployed Worker. */
    DEV_OWNER?: string;
    /** Signs the owner cookie that lets share links recognise you outside the Access-protected paths. */
    OWNER_COOKIE_SECRET?: string;
}

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

    const value = cookie(request, ownerCookie);

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

interface Jwk extends JsonWebKey {
    kid: string;
}

let cachedKeys: { domain: string; keys: Jwk[]; fetchedAt: number } | null = null;

/**
 * Verifies the Cloudflare Access JWT (header or CF_Authorization cookie). Access already guards /app and /api at the
 * edge; checking again here means a misconfigured Access policy fails closed instead of exposing the dashboard.
 */
export async function isOwner(request: Request, config: AccessConfig): Promise<boolean> {
    if (config.DEV_OWNER === '1') {
        // Local tests can still act as a visitor.
        return request.headers.get('X-Dev-Visitor') !== '1';
    }

    if (!config.ACCESS_TEAM_DOMAIN || !config.ACCESS_AUD) {
        return false;
    }

    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? cookie(request, 'CF_Authorization');

    if (!token) {
        return false;
    }

    try {
        return await verify(token, config);
    } catch {
        return false;
    }
}

async function verify(token: string, config: AccessConfig): Promise<boolean> {
    const [headerPart, payloadPart, signaturePart] = token.split('.');

    if (!headerPart || !payloadPart || !signaturePart) {
        return false;
    }

    const header = JSON.parse(decode(headerPart)) as { kid?: string; alg?: string };
    const payload = JSON.parse(decode(payloadPart)) as { aud?: string | string[]; exp?: number; iss?: string };

    if (header.alg !== 'RS256') {
        return false;
    }

    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

    if (!audiences.includes(config.ACCESS_AUD)) {
        return false;
    }

    if (!payload.exp || payload.exp * 1000 < Date.now()) {
        return false;
    }

    if (payload.iss !== `https://${config.ACCESS_TEAM_DOMAIN}`) {
        return false;
    }

    const jwk = (await keys(config.ACCESS_TEAM_DOMAIN)).find((key) => key.kid === header.kid);

    if (!jwk) {
        return false;
    }

    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);

    return crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        key,
        base64UrlBytes(signaturePart),
        new TextEncoder().encode(`${headerPart}.${payloadPart}`),
    );
}

async function keys(domain: string): Promise<Jwk[]> {
    if (cachedKeys && cachedKeys.domain === domain && Date.now() - cachedKeys.fetchedAt < 3_600_000) {
        return cachedKeys.keys;
    }

    const response = await fetch(`https://${domain}/cdn-cgi/access/certs`);
    const body = (await response.json()) as { keys: Jwk[] };
    cachedKeys = { domain, keys: body.keys, fetchedAt: Date.now() };

    return body.keys;
}

function cookie(request: Request, name: string): string | null {
    const match = (request.headers.get('Cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));

    return match ? decodeURIComponent(match[1]) : null;
}

function decode(part: string): string {
    return new TextDecoder().decode(base64UrlBytes(part));
}

function base64UrlBytes(part: string): Uint8Array<ArrayBuffer> {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');

    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
