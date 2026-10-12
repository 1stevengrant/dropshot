import { escape } from './html';

/** The HTML document around every public page; styling comes from the daisyUI build at /_assets/public.css. */
export function htmlDocument(options: { title: string; head?: string; bodyClass: string; body: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(options.title)}</title>
${options.head ?? ''}
<link rel="stylesheet" href="/_assets/public.css">
</head>
<body class="${options.bodyClass}">
${options.body}
</body>
</html>`;
}
