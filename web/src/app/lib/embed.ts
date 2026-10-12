import type { Drop } from '../../shared/types';
import { cachedFileUrl } from './api';

/** Responsive iframe code; images and videos keep their real aspect ratio. */
export async function iframeCode(drop: Drop): Promise<string> {
    const ratio = await aspectRatio(drop);
    const src = `${drop.pageUrl}/embed`;
    const title = drop.title.replace(/"/g, '&quot;');

    if (drop.kind === 'audio') {
        return `<iframe src="${src}" title="${title}" style="width:100%;height:64px;border:0" loading="lazy"></iframe>`;
    }

    return `<div style="position:relative;width:100%;padding-top:${(ratio * 100).toFixed(2)}%"><iframe src="${src}" title="${title}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
}

function aspectRatio(drop: Drop): Promise<number> {
    const fallback = { pdf: 1.3, text: 0.75, link: 0.25, file: 0.4 }[drop.kind as string] ?? 9 / 16;

    if (drop.kind !== 'image' && drop.kind !== 'video') {
        return Promise.resolve(fallback);
    }

    return new Promise((resolve) => {
        const element = drop.kind === 'image' ? new Image() : document.createElement('video');
        const done = (width: number, height: number) => resolve(width && height ? height / width : fallback);

        if (element instanceof HTMLImageElement) {
            element.onload = () => done(element.naturalWidth, element.naturalHeight);
        } else {
            element.preload = 'metadata';
            element.onloadedmetadata = () => done(element.videoWidth, element.videoHeight);
        }

        element.onerror = () => resolve(fallback);
        element.src = cachedFileUrl(drop);
        setTimeout(() => resolve(fallback), 4000);
    });
}

export function embedFormats(drop: Drop): { label: string; value: string }[] {
    const formats = [{ label: 'Share link', value: drop.pageUrl }, { label: 'Direct link', value: drop.directUrl }];

    if (drop.kind === 'image') {
        return [
            ...formats,
            { label: 'Markdown', value: `![${drop.title}](${drop.directUrl})` },
            { label: 'HTML', value: `<a href="${drop.pageUrl}"><img src="${drop.directUrl}" alt="${drop.title.replace(/"/g, '&quot;')}"></a>` },
            { label: 'BBCode', value: `[url=${drop.pageUrl}][img]${drop.directUrl}[/img][/url]` },
        ];
    }

    return [
        ...formats,
        { label: 'Markdown', value: `[${drop.title}](${drop.pageUrl})` },
        { label: 'HTML', value: `<a href="${drop.pageUrl}">${drop.title.replace(/</g, '&lt;')}</a>` },
        { label: 'BBCode', value: `[url=${drop.pageUrl}]${drop.title}[/url]` },
    ];
}
