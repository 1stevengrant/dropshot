import type { DropRow } from './drops';

const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

const styles = `
:root { --bg: #f6f7f9; --panel: #fff; --text: #16181d; --muted: #6b7280; --border: #e4e7ec; --accent: #3b6ef5; --accent-text: #fff; }
@media (prefers-color-scheme: dark) { :root { --bg: #0f1115; --panel: #171a21; --text: #e9ebf0; --muted: #9aa1ad; --border: #262a33; --accent: #6d93ff; --accent-text: #0f1115; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; min-height: 100vh; display: flex; flex-direction: column; }
header { display: flex; align-items: center; gap: 16px; padding: 12px 20px; background: var(--panel); border-bottom: 1px solid var(--border); }
.brand { font-weight: 700; letter-spacing: -0.02em; color: var(--accent); text-decoration: none; font-size: 18px; }
.title { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
.button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel); color: var(--text); text-decoration: none; font: inherit; font-weight: 500; cursor: pointer; }
.button.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
main { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px 16px; }
.viewer { max-width: min(1400px, 100%); width: 100%; display: flex; justify-content: center; }
.viewer img, .viewer video { max-width: 100%; max-height: calc(100vh - 170px); border-radius: 8px; box-shadow: 0 4px 24px rgb(0 0 0 / 0.12); background: var(--panel); }
.viewer iframe { width: 100%; height: calc(100vh - 170px); border: 1px solid var(--border); border-radius: 8px; background: #fff; }
.viewer pre { width: 100%; max-width: 900px; margin: 0; padding: 24px; background: var(--panel); border: 1px solid var(--border); border-radius: 10px; white-space: pre-wrap; word-break: break-word; font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 32px; text-align: center; max-width: 420px; width: 100%; }
.card h1 { font-size: 20px; margin: 0 0 8px; }
.card p { color: var(--muted); margin: 0 0 20px; }
.card input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font: inherit; margin-bottom: 12px; }
.file-icon { font-size: 56px; line-height: 1; margin-bottom: 12px; }
footer { padding: 12px 20px; color: var(--muted); font-size: 13px; text-align: center; }
.error { color: #d93f3f; margin-bottom: 12px; }
@media (max-width: 600px) { header { padding: 10px 16px; } .button span { display: none; } }
`;

function layout(options: { title: string; head?: string; header?: string; body: string; footer?: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(options.title)}</title>
${options.head ?? ''}
<style>${styles}</style>
</head>
<body>
<header><a class="brand" href="/">Dropshot</a><div class="title">${options.header ?? ''}</div></header>
<main>${options.body}</main>
${options.footer ? `<footer>${options.footer}</footer>` : ''}
</body>
</html>`;
}

export function dropPage(row: DropRow, origin: string, text: string | null): string {
    const directPath = `/${row.id}/${encodeURIComponent(row.filename)}`;
    const directUrl = `${origin}${directPath}`;

    const download = row.allow_download
        ? `<a class="button primary" href="${escape(directPath)}?download=1" download><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"/></svg><span>Download</span></a>`
        : '';

    const footer = [formatBytes(row.size), new Date(row.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }), `${row.views + 1} views`].join(' · ');

    return layout({
        title: row.title,
        head: openGraph(row, directUrl, `${origin}/${row.id}`),
        header: `<span>${escape(row.title)}</span>`,
        body: `<div class="viewer">${viewer(row, directPath, text)}</div>`,
        footer: `${footer}${download ? `&nbsp;&nbsp;${download}` : ''}`,
    });
}

function viewer(row: DropRow, src: string, text: string | null): string {
    const url = escape(src);
    const noDownload = row.allow_download ? '' : ' controlsList="nodownload" oncontextmenu="return false"';

    switch (row.kind) {
        case 'image':
            return `<img src="${url}" alt="${escape(row.title)}"${row.allow_download ? '' : ' oncontextmenu="return false" draggable="false"'}>`;
        case 'video':
            return `<video src="${url}" controls playsinline preload="metadata"${noDownload}></video>`;
        case 'audio':
            return `<audio src="${url}" controls preload="metadata"${noDownload}></audio>`;
        case 'pdf':
            return `<iframe src="${url}" title="${escape(row.title)}"></iframe>`;
        case 'text':
            return `<pre>${escape(text ?? '')}</pre>`;
        default:
            return `<div class="card"><div class="file-icon">📄</div><h1>${escape(row.filename)}</h1><p>${formatBytes(row.size)}</p>${
                row.allow_download ? `<a class="button primary" href="${url}?download=1" download>Download</a>` : '<p>Downloads are disabled for this file.</p>'
            }</div>`;
    }
}

function openGraph(row: DropRow, directUrl: string, pageUrl: string): string {
    const tags = [
        `<meta property="og:title" content="${escape(row.title)}">`,
        `<meta property="og:url" content="${escape(pageUrl)}">`,
        `<meta property="og:site_name" content="Dropshot">`,
    ];

    if (row.kind === 'image') {
        tags.push(`<meta property="og:image" content="${escape(directUrl)}">`, '<meta name="twitter:card" content="summary_large_image">');
    }

    if (row.kind === 'video') {
        tags.push(`<meta property="og:video" content="${escape(directUrl)}">`, `<meta property="og:type" content="video.other">`);
    }

    return tags.join('\n');
}

export function passwordPage(row: DropRow, failed: boolean): string {
    return layout({
        title: 'Password required',
        body: `<form class="card" method="post" action="/${escape(row.id)}/unlock">
<h1>This drop is password protected</h1>
<p>Enter the password to view it.</p>
${failed ? '<div class="error">That password is incorrect.</div>' : ''}
<input type="password" name="password" autofocus required autocomplete="current-password" aria-label="Password">
<button class="button primary" type="submit">View drop</button>
</form>`,
    });
}

export function messagePage(title: string, message: string, action?: { label: string; href: string }): string {
    return layout({
        title,
        body: `<div class="card"><h1>${escape(title)}</h1><p>${escape(message)}</p>${action ? `<a class="button" href="${escape(action.href)}">${escape(action.label)}</a>` : ''}</div>`,
    });
}
