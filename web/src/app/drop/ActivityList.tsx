import { useQuery } from '@tanstack/react-query';
import { Clock, Download, Eye } from 'lucide-react';
import type { Activity, Drop } from '../../shared/types';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

export function ActivityList({ drop }: { drop: Drop }) {
    const activity = useQuery({ queryKey: ['activity', drop.id], queryFn: () => api.activity(drop.id) });
    const items: (Activity | { id: 'created'; kind: 'created'; viewedAt: number })[] = [...(activity.data ?? []), { id: 'created', kind: 'created', viewedAt: drop.createdAt }];

    return (
        <section className="px-6 py-5">
            <p className="mb-4 text-sm text-muted">
                {drop.views} view{drop.views === 1 ? '' : 's'} in total{drop.tags.includes('droplr') ? ', including views on Droplr' : ''}. Individual visits are logged from 12 Oct 2026 onwards, and your own visits aren’t counted.
            </p>
            {activity.isPending && <p className="text-sm text-muted">Loading…</p>}
            <ol className="flex flex-col gap-4">
                {items.map((item) => (
                    <li key={item.id} className="flex gap-3 text-sm">
                        <span className="mt-0.5 text-muted">{item.kind === 'download' ? <Download size={15} /> : item.kind === 'created' ? <Clock size={15} /> : <Eye size={15} />}</span>
                        <div className="min-w-0">
                            <div className="font-medium">
                                {item.kind === 'created' ? 'Drop created' : item.kind === 'download' ? 'Downloaded' : 'Viewed'}
                                {'country' in item && item.country && <span className="font-normal text-muted"> from {[item.city, item.country].filter(Boolean).join(', ')}</span>}
                            </div>
                            <div className="text-xs text-muted">
                                {formatDate(item.viewedAt)}
                                {'browser' in item && item.browser && ` · ${item.browser}`}
                                {'referrer' in item && item.referrer && ` · via ${item.referrer}`}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
