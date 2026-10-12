import { dropshotUrl } from './config';

export class SignInRequired extends Error {
    constructor() {
        super('Sign in to Dropshot, then capture again.');
    }
}

/** Uploads through the dashboard API, riding on the browser's Cloudflare Access session. Returns the share link. */
export async function uploadCapture(image: Blob, page: { url: string; title: string }): Promise<string> {
    const host = new URL(page.url).host;
    const response = await fetch(`${dropshotUrl}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        // Access answers a signed-out request with a redirect to its login page.
        redirect: 'manual',
        headers: {
            'Content-Type': 'image/webp',
            'X-Filename': encodeURIComponent(`Screenshot of ${host}.webp`),
            'X-Title': encodeURIComponent(page.title),
            'X-Target-Url': encodeURIComponent(page.url),
        },
        body: image,
    });

    if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
        throw new SignInRequired();
    }

    if (!response.ok) {
        throw new Error(`Upload failed (${response.status}).`);
    }

    const drop = (await response.json()) as { pageUrl: string };

    return drop.pageUrl;
}
