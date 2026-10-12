import type { PendingCapture } from './useCaptures';

export function CaptureStatus({ captures }: { captures: PendingCapture[] }) {
    return (
        <div role="status" className="alert alert-info alert-soft mb-4 flex items-center gap-2 py-2 text-sm">
            <span className="loading loading-spinner loading-sm" />
            <span className="flex-1 truncate">Capturing {captures.map((capture) => capture.host).join(', ')}…</span>
        </div>
    );
}
