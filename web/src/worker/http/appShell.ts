import type { AppContext } from '../app';

/** The dashboard's single-page shell. Its scripts and styles stay under /app/assets. */
export async function appShell(c: AppContext): Promise<Response> {
    const shell = await c.env.ASSETS.fetch(new Request(new URL('/app/', c.req.url)));

    return new Response(shell.body, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' } });
}
