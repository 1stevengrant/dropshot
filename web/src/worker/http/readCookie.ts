/** Reads one cookie from a request without trusting its format. */
export function readCookie(request: Request, name: string): string | null {
    const match = (request.headers.get('Cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));

    return match ? decodeURIComponent(match[1]) : null;
}
