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
            <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
                {toasts.map((toast) => (
                    <div key={toast.id} className="rounded-lg bg-ink px-4 py-2 text-sm text-canvas shadow-lg">
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export const useToast = () => useContext(ToastContext);
