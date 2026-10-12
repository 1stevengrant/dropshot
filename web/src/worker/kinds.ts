import { codeLanguageFor } from '../shared/codeLanguages';
import type { DropKind } from '../shared/types';

const extensionTypes: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', heic: 'image/heic',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac',
    pdf: 'application/pdf',
    txt: 'text/plain', md: 'text/markdown', html: 'text/html', json: 'application/json', csv: 'text/csv',
    zip: 'application/zip',
};

export function contentTypeFor(filename: string, stored?: string): string {
    if (stored && stored !== 'application/octet-stream') {
        return stored;
    }

    return extensionTypes[extension(filename)] ?? 'application/octet-stream';
}

export function kindFor(filename: string, contentType: string): DropKind {
    if (contentType.startsWith('image/')) {
        return 'image';
    }

    if (contentType.startsWith('video/')) {
        return 'video';
    }

    if (contentType.startsWith('audio/')) {
        return 'audio';
    }

    if (contentType === 'application/pdf') {
        return 'pdf';
    }

    if (codeLanguageFor(filename)) {
        return 'code';
    }

    if (contentType.startsWith('text/') || contentType === 'application/json') {
        return 'text';
    }

    return 'file';
}

/** Droplr tags every drop by type; screenshots and recordings from the Mac app get their own tag too. */
export function automaticTags(filename: string, kind: DropKind): string[] {
    const tags: string[] = [kind === 'text' ? 'note' : kind];

    if (/^screen ?shot\b/i.test(filename)) {
        tags.push('screenshot');
    }

    if (/^(screen )?(recording|capture)\b/i.test(filename)) {
        tags.push('recording');
    }

    return tags;
}

export function titleFor(filename: string, kind: DropKind, targetUrl: string | null): string {
    if (kind === 'link' && targetUrl) {
        return targetUrl.replace(/^https?:\/\//, '');
    }

    const dot = filename.lastIndexOf('.');

    return dot > 0 ? filename.slice(0, dot) : filename;
}

export function normalizeTag(tag: string): string {
    return tag.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 40);
}

function extension(filename: string): string {
    const dot = filename.lastIndexOf('.');

    return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
}
