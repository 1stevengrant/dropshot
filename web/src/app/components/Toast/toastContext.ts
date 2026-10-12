import { createContext } from 'react';

export const ToastContext = createContext<(message: string) => void>(() => {});
