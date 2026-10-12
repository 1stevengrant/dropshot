import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ToastProvider } from './components/Toast/ToastProvider';
import { DropDetail } from './drop/DropDetail';
import { queryClient } from './lib/queryClient';
import { Library } from './library/Library';
import { LibraryRedirect } from './routes/LibraryRedirect';
import { ShareLinkPage } from './routes/ShareLinkPage';
import { ShareLinkRedirect } from './routes/ShareLinkRedirect';
import './styles.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                {window.location.pathname.startsWith('/app') ? (
                    <BrowserRouter basename="/app">
                        <Routes>
                            <Route path="/" element={<Library />} />
                            <Route path="/d/:id" element={<ShareLinkPage />} />
                        </Routes>
                    </BrowserRouter>
                ) : (
                    // Served at a share link (d.ghijk.nz/<id>) for the signed-in owner, so the address stays the share link.
                    <BrowserRouter>
                        <Routes>
                            <Route path="/:id" element={<DropDetail />} />
                            <Route path="/d/:id" element={<ShareLinkRedirect />} />
                            <Route path="*" element={<LibraryRedirect />} />
                        </Routes>
                    </BrowserRouter>
                )}
            </ToastProvider>
        </QueryClientProvider>
    </StrictMode>,
);
