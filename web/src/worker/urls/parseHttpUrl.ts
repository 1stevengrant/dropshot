/** Parses a user supplied URL, accepting only http and https. Returns null for anything else. */
export function parseHttpUrl(raw: unknown): URL | null {
    try {
        const url = new URL(String(raw ?? '').trim());

        return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
    } catch {
        return null;
    }
}
