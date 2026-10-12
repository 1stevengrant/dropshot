import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { DropDetail } from './DropDetail';
import { Library } from './Library';
import { ToastProvider } from './Toasts';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <BrowserRouter basename="/app">
                <Routes>
                    <Route path="/" element={<Library />} />
                    <Route path="/d/:id" element={<DropDetail />} />
                </Routes>
            </BrowserRouter>
            </ToastProvider>
        </QueryClientProvider>
    </StrictMode>,
);
