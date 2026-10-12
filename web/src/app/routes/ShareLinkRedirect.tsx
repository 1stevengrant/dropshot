import { Navigate, useParams } from 'react-router';

export function ShareLinkRedirect() {
    const { id } = useParams();

    return <Navigate to={`/${id}`} replace />;
}
