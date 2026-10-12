import { useEffect, useRef } from 'react';
import type { Drop } from '../../shared/types';
import { attachImageZoom } from '../../shared/imageZoom';
import { ZoomBar } from './ZoomBar';

/**
 * An image drop with zoom: it fits the panel, and web page captures (many screens tall) fit the width and scroll.
 * The zoom behaviour is shared with the public drop page, see `shared/imageZoom.ts`.
 */
export function ImagePreview({ drop, src }: { drop: Drop; src: string }) {
    const root = useRef<HTMLDivElement>(null);

    useEffect(() => (root.current ? attachImageZoom(root.current) : undefined), [src]);

    return (
        <div ref={root} className="group/zoom relative h-full w-full">
            <div data-zoom-viewport className="flex h-full w-full items-center-safe justify-center-safe overflow-auto pb-14">
                <img
                    data-zoom-image
                    data-zoom-fit={drop.targetUrl ? 'width' : 'contain'}
                    src={src}
                    alt={drop.title}
                    draggable={false}
                    className={`shrink-0 cursor-zoom-in rounded-lg shadow-lg select-none group-data-[zoomed=true]/zoom:cursor-zoom-out ${drop.targetUrl ? 'w-full' : 'max-h-full max-w-full'}`}
                />
            </div>
            <ZoomBar />
        </div>
    );
}
