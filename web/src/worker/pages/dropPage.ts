import type { DropRow } from '../drops';
import { dropViewer } from './dropViewer';
import { downloadIcon, escape, formatBytes } from './html';
import { layout } from './layout';
import { openGraph } from './openGraph';

/** The public page for one drop. */
export function dropPage(row: DropRow, origin: string, text: string | null): string {
    const directPath = `/${row.id}/${encodeURIComponent(row.filename)}`;

    const download = row.allow_download
        ? `<a class="btn btn-primary btn-sm" href="${escape(directPath)}?download=1" download>${downloadIcon}<span class="max-sm:hidden">Download</span></a>`
        : '';

    const cta = row.cta_label && row.cta_url
        ? `<a class="btn btn-outline btn-sm" href="${escape(row.cta_url)}" target="_blank" rel="noopener">${escape(row.cta_label)}</a>`
        : '';

    const meta = [
        formatBytes(row.size),
        new Date(row.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }),
        `${row.views + 1} views`,
    ].join(' · ');

    return layout({
        title: row.title,
        head: openGraph(row, `${origin}${directPath}`, `${origin}/${row.id}`),
        header: escape(row.title),
        actions: `${cta}${download}`,
        body: `<div class="flex w-full max-w-[1400px] justify-center">${dropViewer(row, directPath, text)}</div>`,
        footer: `<span>${meta}</span>`,
    });
}
