import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { takeFlash } from '../../lib/flash';
import { ToastContext } from './toastContext';

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

    const show = useCallback((message: string) => {
        const id = Date.now() + Math.random();
        setToasts((current) => [...current, { id, message }]);
        setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 2500);
    }, []);

    // Show a message left by the previous page, such as "Drop deleted".
    useEffect(() => {
        const message = takeFlash();

        if (message) {
            show(message);
        }
    }, [show]);

    return (
        <ToastContext.Provider value={show}>
            {children}
            <div className="toast toast-center toast-bottom z-50" aria-live="polite">
                {toasts.map((toast) => (
                    <div key={toast.id} role="status" className="alert alert-neutral py-2 text-sm shadow-lg">
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
