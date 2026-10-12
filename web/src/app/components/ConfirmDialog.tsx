import { TriangleAlert } from 'lucide-react';
import { useState } from 'react';

interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => Promise<unknown> | void;
    onCancel: () => void;
}

/** A destructive-action confirmation in a daisyUI modal, used instead of the browser's confirm(). */
export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
    const [working, setWorking] = useState(false);

    async function confirm() {
        setWorking(true);

        try {
            await onConfirm();
        } finally {
            setWorking(false);
        }
    }

    return (
        <dialog open className="modal modal-open" role="alertdialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message" onCancel={onCancel}>
            <div className="modal-box">
                <div className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
                        <TriangleAlert size={20} />
                    </span>
                    <div>
                        <h2 id="confirm-dialog-title" className="text-lg font-semibold">{title}</h2>
                        <p id="confirm-dialog-message" className="mt-1 text-sm text-muted">{message}</p>
                    </div>
                </div>
                <div className="modal-action">
                    <button type="button" onClick={onCancel} disabled={working} className="btn btn-ghost" autoFocus>Cancel</button>
                    <button type="button" onClick={confirm} disabled={working} className="btn btn-error">
                        {working && <span className="loading loading-spinner loading-sm" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
            <button type="button" className="modal-backdrop" onClick={onCancel} aria-label="Cancel" disabled={working} />
        </dialog>
    );
}
