import type { DropKind } from '../../shared/types';
import type { DropRow } from '../drops';
import { htmlDocument } from './document';
import { codeBlock } from './codeBlock';
import { escape } from './html';

/** A chrome-free page for iframes: just the media, filling the frame. */
export function embedPage(row: DropRow, origin: string, text: string | null): string {
    const directPath = escape(`/${row.id}/${encodeURIComponent(row.filename)}`);
    const pageUrl = escape(`${origin}/${row.id}`);
    const fill = 'block h-full w-full object-contain';
    const noDownload = row.allow_download ? '' : ' controlsList="nodownload" oncontextmenu="return false"';

    const bodies: Record<DropKind, string> = {
        image: `<a href="${pageUrl}" target="_blank" rel="noopener"><img class="${fill}" src="${directPath}" alt="${escape(row.title)}"></a>`,
        video: `<video class="${fill} bg-black" src="${directPath}" controls playsinline preload="metadata"${noDownload}></video>`,
        audio: `<div class="flex h-full items-center px-3"><audio class="w-full" src="${directPath}" controls preload="metadata"${noDownload}></audio></div>`,
        pdf: `<iframe class="h-full w-full border-0" src="${directPath}" title="${escape(row.title)}"></iframe>`,
        text: `<pre class="h-full overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">${escape(text ?? '')}</pre>`,
        code: text === null ? '' : codeBlock(text, row.filename, `${origin}/${row.id}+`, 'h-full rounded-none border-0'),
        link: `<div class="flex h-full items-center justify-center p-4"><a class="link link-primary break-all" href="${escape(row.target_url ?? `${origin}/${row.id}`)}" target="_blank" rel="noopener">${escape(row.target_url ?? row.title)}</a></div>`,
        file: `<a class="flex h-full flex-col items-center justify-center gap-2" href="${pageUrl}" target="_blank" rel="noopener"><span class="text-4xl" aria-hidden="true">📄</span><span class="link link-hover">${escape(row.filename)}</span></a>`,
    };

    const body = row.kind === 'code' && text === null ? bodies.file : bodies[row.kind];

    return htmlDocument({ title: row.title, bodyClass: 'h-screen overflow-hidden bg-transparent text-base-content', body });
}
