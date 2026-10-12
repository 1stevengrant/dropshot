import { Navigate, useLocation } from 'react-router';

/** /app and /app/?tag=… from before the library moved to the root. */
export function LegacyLibraryRedirect() {
    const { search } = useLocation();

    return <Navigate to={`/${search}`} replace />;
}
