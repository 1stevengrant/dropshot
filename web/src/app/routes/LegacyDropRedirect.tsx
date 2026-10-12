import { Navigate, useParams } from 'react-router';

/** /app/d/<id> from before drops moved to their share link. */
export function LegacyDropRedirect() {
    const { id } = useParams();

    return <Navigate to={`/${id}`} replace />;
}
