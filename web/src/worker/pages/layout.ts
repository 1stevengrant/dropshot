import { htmlDocument } from './document';

/** Navbar, centred content and an optional footer, shared by the public pages. */
export function layout(options: { title: string; head?: string; header?: string; actions?: string; body: string; footer?: string }): string {
    return htmlDocument({
        title: options.title,
        head: options.head,
        bodyClass: 'flex min-h-screen flex-col bg-base-200 text-base-content antialiased',
        body: `<header class="navbar gap-4 border-b border-base-300 bg-base-100 px-5">
    <a class="btn btn-ghost px-2 text-lg font-bold tracking-tight text-primary" href="/">Dropshot</a>
    <div class="min-w-0 flex-1 truncate font-medium">${options.header ?? ''}</div>
    ${options.actions ?? ''}
</header>
<main class="flex flex-1 items-center justify-center p-4 sm:p-6">${options.body}</main>
${options.footer ? `<footer class="flex flex-wrap items-center justify-center gap-3 px-5 py-3 text-sm opacity-70">${options.footer}</footer>` : ''}`,
    });
}
