import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ToastProvider } from './components/Toast/ToastProvider';
import { DropDetail } from './drop/DropDetail';
import { queryClient } from './lib/queryClient';
import { Library } from './library/Library';
import { LegacyDropRedirect } from './routes/LegacyDropRedirect';
import { LegacyLibraryRedirect } from './routes/LegacyLibraryRedirect';
import './styles.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Library />} />
                        <Route path="/app/d/:id" element={<LegacyDropRedirect />} />
                        <Route path="/app/*" element={<LegacyLibraryRedirect />} />
                        <Route path="/:id" element={<DropDetail />} />
                    </Routes>
                </BrowserRouter>
            </ToastProvider>
        </QueryClientProvider>
    </StrictMode>,
);
