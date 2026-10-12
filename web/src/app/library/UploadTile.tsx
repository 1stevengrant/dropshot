import { CloudUpload } from 'lucide-react';

export function UploadTile({ onClick }: { onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent"
        >
            <CloudUpload size={48} strokeWidth={1.25} />
            <span className="text-lg font-medium text-ink">Drop files here</span>
            <span className="text-sm">or use the Upload file button</span>
        </button>
    );
}
