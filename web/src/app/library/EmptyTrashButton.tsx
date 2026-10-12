import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function EmptyTrashButton({ count, onEmpty }: { count: number; onEmpty: () => Promise<unknown> }) {
    const [confirming, setConfirming] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setConfirming(true)} className="btn btn-ghost btn-sm text-error">
                <Trash2 size={15} /> Empty trash
            </button>
            {confirming && (
                <ConfirmDialog
                    title="Empty the trash?"
                    message={`All ${count.toLocaleString()} drops in the trash are deleted forever. This can’t be undone.`}
                    confirmLabel="Empty trash"
                    onConfirm={async () => {
                        await onEmpty();
                        setConfirming(false);
                    }}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </>
    );
}
