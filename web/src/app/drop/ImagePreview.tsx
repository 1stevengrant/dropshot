import { type KeyboardEvent, useState } from 'react';
import type { Drop } from '../../shared/types';

/**
 * Images fit the panel; clicking toggles actual size. Web page captures are many screens tall, so they fit the width
 * instead of the height, and zoom to 1440px, the width they were rendered at.
 */
export function ImagePreview({ drop, src }: { drop: Drop; src: string }) {
    const [zoomed, setZoomed] = useState(false);
    const isPageCapture = drop.targetUrl !== null;

    const fit = isPageCapture ? 'h-auto w-full max-w-6xl self-start cursor-zoom-in' : 'max-h-full max-w-full cursor-zoom-in';
    const actualSize = isPageCapture ? 'h-auto w-[1440px] max-w-none shrink-0 self-start cursor-zoom-out' : 'max-w-none shrink-0 cursor-zoom-out';

    function toggleOnKey(event: KeyboardEvent) {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        setZoomed((current) => !current);
    }

    return (
        <img
            src={src}
            alt={drop.title}
            role="button"
            tabIndex={0}
            aria-pressed={zoomed}
            aria-label={zoomed ? 'Fit to window' : 'Zoom to actual size'}
            title={zoomed ? 'Click to fit' : 'Click to zoom'}
            onClick={() => setZoomed((current) => !current)}
            onKeyDown={toggleOnKey}
            className={`rounded-lg shadow-lg ${zoomed ? actualSize : fit}`}
        />
    );
}
