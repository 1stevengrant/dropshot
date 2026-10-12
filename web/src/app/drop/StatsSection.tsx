import { Eye } from 'lucide-react';
import type { Drop } from '../../shared/types';
import { Section } from '../components/Section';

export function StatsSection({ drop }: { drop: Drop }) {
    return (
        <Section title="Stats">
            <div className="flex items-center gap-3">
                <Eye className="text-muted" size={18} />
                <div>
                    <div className="text-xl font-semibold">{drop.views}</div>
                    <div className="text-sm text-muted">Views</div>
                </div>
            </div>
        </Section>
    );
}
