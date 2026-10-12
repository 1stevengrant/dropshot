import { useContext } from 'react';
import { ToastContext } from './toastContext';

export const useToast = () => useContext(ToastContext);
