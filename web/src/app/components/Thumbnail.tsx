import { FileCode, FileText, File as FileIcon, Image, Link2, Music, FileType } from 'lucide-react';
import { useState } from 'react';
import type { Drop } from '../../shared/types';
import { previewUrl, thumbnailUrl } from '../lib/api';

export function Thumbnail({ drop, className = '' }: { drop: Drop; className?: string }) {
    const [missing, setMissing] = useState(false);

    // Never the original here: a page of 48 full size images ran to hundreds of megabytes.
    if (drop.kind === 'image' && !missing) {
        return <img src={thumbnailUrl(drop)} alt="" loading="lazy" onError={() => setMissing(true)} className={`h-full w-full object-cover object-top ${className}`} />;
    }

    if (drop.kind === 'video') {
        // A fragment start time makes the browser paint a frame instead of a black box.
        return <video src={`${previewUrl(drop)}#t=0.5`} preload="metadata" muted playsInline className={`h-full w-full object-cover object-top ${className}`} />;
    }

    const Icon = { image: Image, code: FileCode, text: FileText, link: Link2, audio: Music, pdf: FileType, file: FileIcon }[drop.kind] ?? FileIcon;

    return (
        <div className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-accent-soft text-accent ${className}`}>
            <Icon size={40} strokeWidth={1.5} />
            <span className="max-w-[80%] truncate text-xs font-medium">{drop.kind === 'link' ? drop.targetUrl : drop.filename}</span>
        </div>
    );
}
