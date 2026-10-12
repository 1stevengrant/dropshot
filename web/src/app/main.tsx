import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router';
import { DropDetail } from './DropDetail';
import { Library } from './Library';
import { ToastProvider } from './Toasts';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true } } });

function ShareLinkRedirect() {
    const { id } = useParams();

    return <Navigate to={`/${id}`} replace />;
}

/** Old /app/d/<id> addresses move to the share link, which is the one address for a drop. */
function ShareLinkPage() {
    const { id } = useParams();
    window.location.replace(`/${id}`);

    return null;
}

function LibraryRedirect() {
    window.location.replace('/app/');

    return null;
}

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
