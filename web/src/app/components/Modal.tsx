import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
    labelledBy: string;
    describedBy?: string;
    role?: 'dialog' | 'alertdialog';
    onClose: () => void;
    closeDisabled?: boolean;
    children: ReactNode;
}

/**
 * A daisyUI modal rendered into document.body. Ancestors with filters or backdrop blur (like the pinned library
 * toolbar) become the containing block for fixed elements, which would trap a modal inside them.
 */
export function Modal({ labelledBy, describedBy, role = 'dialog', onClose, closeDisabled, children }: ModalProps) {
    return createPortal(
        <dialog open className="modal modal-open" role={role} aria-labelledby={labelledBy} aria-describedby={describedBy} onCancel={onClose}>
            {children}
            <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" disabled={closeDisabled} />
        </dialog>,
        document.body,
    );
}
