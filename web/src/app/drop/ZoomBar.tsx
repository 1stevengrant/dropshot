import { Minus, Plus } from 'lucide-react';

/** Controls wired up by `attachImageZoom` through their data attributes. */
export function ZoomBar() {
    return (
        <div className="join absolute bottom-3 left-1/2 -translate-x-1/2 rounded-field bg-base-100/90 shadow-lg backdrop-blur">
            <button type="button" data-zoom="out" aria-label="Zoom out" title="Zoom out (-)" className="join-item btn btn-ghost btn-sm">
                <Minus size={15} />
            </button>
            <span data-zoom-label aria-live="polite" className="join-item flex min-w-24 items-center justify-center px-2 text-xs tabular-nums">Fit</span>
            <button type="button" data-zoom="in" aria-label="Zoom in" title="Zoom in (+)" className="join-item btn btn-ghost btn-sm">
                <Plus size={15} />
            </button>
            <button type="button" data-zoom="fit" title="Fit (0)" className="join-item btn btn-ghost btn-sm">Fit</button>
            <button type="button" data-zoom="actual" title="Actual size (1)" className="join-item btn btn-ghost btn-sm">100%</button>
        </div>
    );
}
