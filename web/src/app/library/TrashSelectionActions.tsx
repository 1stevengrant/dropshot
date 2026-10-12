import { RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface TrashSelectionActionsProps {
    count: number;
    onRestore: () => Promise<unknown>;
    onPurge: () => Promise<unknown>;
}

export function TrashSelectionActions({ count, onRestore, onPurge }: TrashSelectionActionsProps) {
    const [confirming, setConfirming] = useState(false);
    const noun = `${count} drop${count === 1 ? '' : 's'}`;

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{count} selected</span>
            <button type="button" onClick={onRestore} className="btn btn-sm">
                <RotateCcw size={15} /> Restore
            </button>
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-error btn-sm">
                <Trash2 size={15} /> Delete forever
            </button>
            {confirming && (
                <ConfirmDialog
                    title={`Delete ${noun} forever?`}
                    message="The files are removed for good. This can’t be undone."
                    confirmLabel={`Delete ${noun} forever`}
                    onConfirm={async () => {
                        await onPurge();
                        setConfirming(false);
                    }}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
}
