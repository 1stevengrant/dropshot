import { formatBytes } from '../lib/format';
import type { UploadProgress } from './useUpload';

export function UploadStatus({ progress }: { progress: UploadProgress }) {
    const percent = progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;

    return (
        <div role="status" className="alert alert-info alert-soft mb-4 flex flex-col items-stretch gap-2 py-2 text-sm">
            <div className="flex items-center gap-2">
                <span className="loading loading-spinner loading-sm" />
                <span className="flex-1">Uploading {progress.files} file{progress.files === 1 ? '' : 's'}…</span>
                <span className="tabular-nums text-muted">{formatBytes(progress.loaded)} of {formatBytes(progress.total)} · {percent}%</span>
            </div>
            <progress className="progress progress-info w-full" value={percent} max={100} />
        </div>
    );
}
