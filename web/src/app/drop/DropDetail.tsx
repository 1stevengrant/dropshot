import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { api } from '../lib/api';
import { DropView } from './DropView';

export function DropDetail() {
    const { id = '' } = useParams();
    const drop = useQuery({ queryKey: ['drop', id], queryFn: () => api.drop(id) });

    if (drop.isError) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <p className="text-muted">{drop.error.message}</p>
                <Link to="/" className="text-accent">Back to my drops</Link>
            </div>
        );
    }

    if (!drop.data) {
        return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
    }

    return <DropView key={drop.data.id} drop={drop.data} />;
}
