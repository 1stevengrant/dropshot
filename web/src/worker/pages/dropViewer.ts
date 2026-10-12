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
 * An image with zoom controls, driven by /_assets/zoom.js (built from `src/public/zoom.ts`, shared with the dashboard).
 * Without the script the image still fits the box. Web page captures fit the width and scroll instead of the height.
 */
function zoomableImage(row: DropRow, url: string): string {
    const fit = row.target_url ? 'w-full' : 'max-h-full max-w-full';
    const protect = row.allow_download ? '' : ' oncontextmenu="return false"';
    const button = 'join-item btn btn-ghost btn-sm';

    return `<div data-image-zoom class="group relative w-full">
    <div data-zoom-viewport class="flex h-[calc(100vh-10rem)] w-full items-center-safe justify-center-safe overflow-auto pb-14">
        <img data-zoom-image data-zoom-fit="${row.target_url ? 'width' : 'contain'}" draggable="false" class="${fit} shrink-0 cursor-zoom-in select-none rounded-box bg-base-100 shadow-xl group-data-[zoomed=true]:cursor-zoom-out" src="${url}" alt="${escape(row.title)}"${protect}>
    </div>
    <div class="join absolute bottom-3 left-1/2 -translate-x-1/2 rounded-field bg-base-100/90 shadow-lg backdrop-blur">
        <button type="button" data-zoom="out" class="${button}" aria-label="Zoom out" title="Zoom out (-)">&minus;</button>
        <span data-zoom-label aria-live="polite" class="join-item flex min-w-24 items-center justify-center px-2 text-xs tabular-nums">Fit</span>
        <button type="button" data-zoom="in" class="${button}" aria-label="Zoom in" title="Zoom in (+)">+</button>
        <button type="button" data-zoom="fit" class="${button}" title="Fit (0)">Fit</button>
        <button type="button" data-zoom="actual" class="${button}" title="Actual size (1)">100%</button>
    </div>
</div>
<script src="/_assets/zoom.js" defer></script>`;
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
