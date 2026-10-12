import { Copy, ExternalLink } from 'lucide-react';
import { Link } from 'react-router';
import type { Drop } from '../../shared/types';
import { Thumbnail } from '../components/Thumbnail';
import { useToast } from '../components/Toast/useToast';
import { copy, formatDate } from '../lib/format';
import { trashCountdown } from '../lib/trash';
import { StatusBadges } from './StatusBadges';

export function DropCard({ drop, selected, onToggle }: { drop: Drop; selected: boolean; onToggle: () => void }) {
    const toast = useToast();

    return (
        <article
            className={`card group relative overflow-hidden border shadow-sm transition hover:shadow-md ${
                selected ? 'border-primary bg-accent-soft outline-2 -outline-offset-1 outline-primary' : 'border-base-300 bg-base-100'
            }`}
        >
            <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                aria-label={`Select ${drop.title}`}
                className={`checkbox checkbox-sm checkbox-primary absolute top-2.5 left-2.5 z-10 shadow-md ${
                    selected ? '' : 'border-base-300 bg-base-100 opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                }`}
            />

            <Link to={`/${drop.id}`} className="relative block aspect-[4/3] overflow-hidden bg-canvas">
                <Thumbnail drop={drop} />
                {drop.kind === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white">▶</span>
                    </span>
                )}
            </Link>

            <div className="flex flex-1 flex-col gap-1 p-4">
                <Link to={`/${drop.id}`} className="truncate font-medium hover:text-accent" title={drop.title}>
                    {drop.title}
                </Link>
                <a href={drop.pageUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-accent hover:underline">
                    {drop.pageUrl.replace(/^https?:\/\//, '')}
                </a>
                <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted">
                    <span className={`flex-1 ${drop.deletedAt ? 'text-warning-content' : ''}`}>{drop.deletedAt ? trashCountdown(drop.deletedAt) : formatDate(drop.createdAt)}</span>
                    <StatusBadges drop={drop} />
                    <button
                        type="button"
                        title="Copy link"
                        onClick={async () => { await copy(drop.pageUrl); toast('Link copied'); }}
                        className="btn btn-ghost btn-xs btn-square text-primary"
                    >
                        <Copy size={16} />
                    </button>
                    <a href={drop.pageUrl} target="_blank" rel="noreferrer" title="Open drop page" className="btn btn-ghost btn-xs btn-square text-primary">
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>
        </article>
    );
}
