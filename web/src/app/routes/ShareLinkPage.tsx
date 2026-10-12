import { useParams } from 'react-router';

/** Old /app/d/<id> addresses move to the share link, which is the one address for a drop. */
export function ShareLinkPage() {
    const { id } = useParams();
    window.location.replace(`/${id}`);

    return null;
}
