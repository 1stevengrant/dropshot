import type { DropRow } from '../drops';
import { escape } from './html';

/** Link preview tags for Slack, iMessage and social sites. */
export function openGraph(row: DropRow, directUrl: string, pageUrl: string): string {
    const tags = [
        `<meta property="og:title" content="${escape(row.title)}">`,
        `<meta property="og:url" content="${escape(pageUrl)}">`,
        '<meta property="og:site_name" content="Dropshot">',
    ];

    if (row.kind === 'image') {
        tags.push(`<meta property="og:image" content="${escape(directUrl)}">`, '<meta name="twitter:card" content="summary_large_image">');
    }

    if (row.kind === 'video') {
        tags.push(`<meta property="og:video" content="${escape(directUrl)}">`, '<meta property="og:type" content="video.other">');
    }

    return tags.join('\n');
}
