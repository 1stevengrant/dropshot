import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);

    const show = useCallback((message: string) => {
        const id = Date.now() + Math.random();
        setToasts((current) => [...current, { id, message }]);
        setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 2500);
    }, []);

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

export const useToast = () => useContext(ToastContext);
