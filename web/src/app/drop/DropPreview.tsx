import { useQuery } from '@tanstack/react-query';
import { Download, Link2 } from 'lucide-react';
import type { Drop } from '../../shared/types';
import { previewUrl } from '../lib/api';
import { CodeBlock } from '../components/CodeBlock';
import { formatBytes } from '../lib/format';

export function DropPreview({ drop, version }: { drop: Drop; version: number }) {
    const src = version ? `${previewUrl(drop)}?v=${version}` : previewUrl(drop);
    const text = useQuery({ queryKey: ['text', drop.id], queryFn: async () => (await fetch(src)).text(), enabled: drop.kind === 'text' || drop.kind === 'code' });

    switch (drop.kind) {
        case 'image':
            return <img src={src} alt={drop.title} className="max-h-full max-w-full rounded-lg shadow-lg" />;
        case 'video':
            return <video src={src} controls playsInline className="max-h-full max-w-full rounded-lg bg-black shadow-lg" />;
        case 'audio':
            return <audio src={src} controls className="w-full max-w-xl" />;
        case 'pdf':
            return <iframe src={src} title={drop.title} className="h-full w-full rounded-lg border border-line bg-white" />;
        case 'text':
            return <pre className="max-h-full w-full max-w-3xl overflow-auto rounded-xl border border-line bg-panel p-6 font-mono text-sm whitespace-pre-wrap">{text.data ?? 'Loading…'}</pre>;
        case 'code':
            return text.data === undefined
                ? <span className="loading loading-spinner" />
                : <CodeBlock cacheKey={[drop.id, version]} text={text.data} filename={drop.filename} rawHref={`${drop.pageUrl}+`} />;
        case 'link':
            return (
                <div className="rounded-xl border border-line bg-panel p-8 text-center">
                    <Link2 className="mx-auto mb-3 text-accent" size={40} />
                    <p className="mb-2 text-muted">Short link to</p>
                    <a href={drop.targetUrl ?? '#'} target="_blank" rel="noreferrer" className="break-all text-accent hover:underline">{drop.targetUrl}</a>
                </div>
            );
        default:
            return (
                <div className="rounded-xl border border-line bg-panel p-10 text-center">
                    <p className="mb-1 text-lg font-medium">{drop.filename}</p>
                    <p className="mb-5 text-muted">{formatBytes(drop.size)}</p>
                    <a href={`${src}?download=1`} className="btn btn-primary">
                        <Download size={16} /> Download
                    </a>
                </div>
            );
    }
}
