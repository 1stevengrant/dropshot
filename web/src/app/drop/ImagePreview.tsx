import { useEffect, useRef, useState } from 'react';
import type { Drop } from '../../shared/types';
import { attachImageZoom } from '../../shared/imageZoom';
import { thumbnailUrl } from '../lib/api';
import { ZoomBar } from './ZoomBar';

/**
 * An image drop with zoom: it fits the panel, and web page captures (many screens tall) fit the width and scroll.
 * The zoom behaviour is shared with the public drop page, see `shared/imageZoom.ts`.
 */
export function ImagePreview({ drop, src }: { drop: Drop; src: string }) {
    const root = useRef<HTMLDivElement>(null);
    const original = useRef<HTMLImageElement>(null);
    // Originals run to 30 MB; the library's thumbnail stands in until the original has loaded.
    const [loaded, setLoaded] = useState(false);
    const [thumbnailFailed, setThumbnailFailed] = useState(false);

    useEffect(() => (root.current ? attachImageZoom(root.current) : undefined), [src]);

    useEffect(() => {
        if (original.current?.complete && original.current.naturalWidth) {
            setLoaded(true);
        }
    }, [src]);

    const fitClasses = drop.targetUrl ? 'w-full' : 'max-h-full max-w-full';

    return (
        <div ref={root} className="group/zoom relative h-full w-full">
            <div data-zoom-viewport className="flex h-full w-full items-center-safe justify-center-safe overflow-auto pb-14">
                {!loaded && !thumbnailFailed && (
                    <img src={thumbnailUrl(drop)} alt="" aria-hidden onError={() => setThumbnailFailed(true)} className={`shrink-0 rounded-lg shadow-lg ${fitClasses}`} />
                )}
                <img
                    ref={original}
                    onLoad={() => setLoaded(true)}
                    data-zoom-image
                    data-zoom-fit={drop.targetUrl ? 'width' : 'contain'}
                    src={src}
                    alt={drop.title}
                    draggable={false}
                    className={`shrink-0 cursor-zoom-in rounded-lg shadow-lg select-none group-data-[zoomed=true]/zoom:cursor-zoom-out ${fitClasses} ${loaded ? '' : 'hidden'}`}
                />
            </div>
            <ZoomBar />
        </div>
    );
}
