const iterations = 100_000;

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derive(password, salt, iterations);

    return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    const [scheme, rounds, salt, expected] = stored.split('$');

    if (scheme !== 'pbkdf2' || !rounds || !salt || !expected) {
        return false;
    }

    const actual = await derive(password, fromBase64(salt), Number(rounds));

    return timingSafeEqual(actual, fromBase64(expected));
}

/** An unlock cookie for one drop, keyed by its password hash so changing the password revokes it. */
export async function unlockToken(dropId: string, passwordHash: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passwordHash), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dropId));

    return toBase64(new Uint8Array(signature)).replace(/[+/=]/g, '');
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, rounds: number): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: rounds }, key, 256);

    return new Uint8Array(bits);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let difference = 0;

    for (let index = 0; index < a.length; index++) {
        difference |= a[index] ^ b[index];
    }

    return difference === 0;
}

function toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}
