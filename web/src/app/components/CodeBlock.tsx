import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface CodeBlockProps {
    cacheKey: unknown[];
    text: string;
    filename: string;
    rawHref: string;
}

/** Highlighted code with line numbers, matching the public drop page. The highlighter loads only when code is shown. */
export function CodeBlock({ cacheKey, text, filename, rawHref }: CodeBlockProps) {
    const [copied, setCopied] = useState(false);
    const highlighted = useQuery({
        queryKey: ['highlight', ...cacheKey],
        queryFn: async () => (await import('../../shared/highlightCode')).highlightCode(text, filename),
        staleTime: Infinity,
    });
    const lines = highlighted.data?.lines ?? text.replace(/\n$/, '').split('\n').length;

    async function copyCode() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <div className="code-block max-h-full w-full max-w-5xl shadow-sm">
            <div className="code-bar">
                <span>{highlighted.data?.label ?? 'Code'}</span>
                <span className="flex items-center gap-3">
                    <button type="button" onClick={copyCode} className="link link-hover inline-flex items-center gap-1">
                        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                    </button>
                    <a href={rawHref} target="_blank" rel="noreferrer" className="link link-hover">Raw</a>
                </span>
            </div>
            <div className="code-scroll">
                <pre className="code-gutter" aria-hidden="true">{Array.from({ length: lines }, (_, index) => index + 1).join('\n')}</pre>
                <pre className="code-body">
                    {highlighted.data
                        ? <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted.data.html }} />
                        : <code className="hljs">{text}</code>}
                </pre>
            </div>
        </div>
    );
}
