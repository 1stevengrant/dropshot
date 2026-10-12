import type { StitchedImage } from './TileStitcher';
import { dropshotUrl } from './config';

export class SignInRequired extends Error {
    constructor() {
        super('Sign in to Dropshot, then capture again.');
    }
}

/** Uploads through the dashboard API, riding on the browser's Cloudflare Access session. */
export async function uploadCapture(image: StitchedImage, page: { url: string; title: string }): Promise<{ id: string; pageUrl: string }> {
    const host = new URL(page.url).host;
    const response = await fetch(`${dropshotUrl}/api/upload`, {
        method: 'POST',
        credentials: 'include',
        // Access answers a signed-out request with a redirect to its login page.
        redirect: 'manual',
        headers: {
            'Content-Type': image.blob.type,
            'X-Filename': encodeURIComponent(`Screenshot of ${host}.${image.extension}`),
            'X-Title': encodeURIComponent(page.title),
            'X-Target-Url': encodeURIComponent(page.url),
        },
        body: image.blob,
    });

    if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403) {
        throw new SignInRequired();
    }

    if (!response.ok) {
        throw new Error(`Upload failed (${response.status}).`);
    }

    return (await response.json()) as { id: string; pageUrl: string };
}
