import { highlightCode } from '../../shared/highlightCode';
import { escape } from './html';

/** Highlighted code with line numbers, plus a bar naming the language with a link to the raw file. */
export function codeBlock(text: string, filename: string, rawHref: string, className = ''): string {
    const { html, lines, label } = highlightCode(text, filename);
    const numbers = Array.from({ length: lines }, (_, index) => index + 1).join('\n');

    return `<div class="code-block ${className}">
    <div class="code-bar"><span>${escape(label)}</span><a class="link link-hover" href="${escape(rawHref)}">Raw</a></div>
    <div class="code-scroll"><pre class="code-gutter" aria-hidden="true">${numbers}</pre><pre class="code-body"><code class="hljs">${html}</code></pre></div>
</div>`;
}
