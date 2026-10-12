import type { DropRow } from '../drops';
import { codeBlock } from './codeBlock';
import { downloadIcon, escape, formatBytes } from './html';

/** The media shown on a drop page, chosen by the drop's kind. */
export function dropViewer(row: DropRow, src: string, text: string | null): string {
    const url = escape(src);
    const noDownload = row.allow_download ? '' : ' controlsList="nodownload" oncontextmenu="return false"';
    const media = 'max-h-[calc(100vh-10rem)] max-w-full rounded-box shadow-xl';

    switch (row.kind) {
        case 'image':
            return zoomableImage(row, url);
        case 'video':
            return `<video class="${media} aspect-video w-full max-w-6xl bg-black object-contain" src="${url}" controls playsinline preload="metadata"${noDownload}></video>`;
        case 'audio':
            return `<div class="card w-full max-w-xl bg-base-100 shadow-xl"><div class="card-body"><audio class="w-full" src="${url}" controls preload="metadata"${noDownload}></audio></div></div>`;
        case 'pdf':
            return `<iframe class="h-[calc(100vh-10rem)] w-full rounded-box border border-base-300 bg-white" src="${url}" title="${escape(row.title)}"></iframe>`;
        case 'text':
            return `<div class="card w-full max-w-3xl border border-base-300 bg-base-100 shadow-sm"><pre class="card-body overflow-auto font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">${escape(text ?? '')}</pre></div>`;
        case 'code':
            if (text !== null) {
                return codeBlock(text, row.filename, `/${row.id}+`, 'w-full max-w-5xl shadow-sm');
            }

            return fileCard(row, url);
        default:
            return fileCard(row, url);
    }
}

/**
 * Images fit the window and a click toggles actual size, through a hidden checkbox so public pages stay script free.
 * Web page captures are many screens tall, so they fit the width instead and zoom to the 1440px they were rendered at.
 */
function zoomableImage(row: DropRow, url: string): string {
    const fit = row.target_url ? 'h-auto w-full' : 'max-h-[calc(100vh-10rem)] max-w-full';
    const actualSize = row.target_url
        ? 'group-has-checked:w-[1440px] group-has-checked:max-w-none'
        : 'group-has-checked:max-h-none group-has-checked:max-w-none';
    const protect = row.allow_download ? '' : ' oncontextmenu="return false" draggable="false"';

    return `<label class="group block max-w-full cursor-zoom-in overflow-auto has-checked:cursor-zoom-out" title="Click to zoom">
    <input type="checkbox" class="sr-only" aria-label="Zoom to actual size">
    <img class="${fit} ${actualSize} mx-auto rounded-box bg-base-100 shadow-xl" src="${url}" alt="${escape(row.title)}"${protect}>
</label>`;
}

function fileCard(row: DropRow, url: string): string {
    return `<div class="card w-full max-w-md border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body items-center text-center">
        <div class="text-5xl" aria-hidden="true">📄</div>
        <h1 class="card-title break-all">${escape(row.filename)}</h1>
        <p class="opacity-70">${formatBytes(row.size)}</p>
        <div class="card-actions">${
            row.allow_download
                ? `<a class="btn btn-primary" href="${url}?download=1" download>${downloadIcon}Download</a>`
                : '<div role="alert" class="alert alert-soft">Downloads are disabled for this file.</div>'
        }</div>
    </div>
</div>`;
}
