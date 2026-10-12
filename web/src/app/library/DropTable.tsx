import { Copy } from 'lucide-react';
import { Link } from 'react-router';
import type { Drop } from '../../shared/types';
import { Thumbnail } from '../components/Thumbnail';
import { useToast } from '../components/Toast/useToast';
import { copy, formatBytes, formatDate } from '../lib/format';
import { StatusBadges } from './StatusBadges';

export function DropTable({ drops, selected, onToggle }: { drops: Drop[]; selected: Set<string>; onToggle: (id: string) => void }) {
    const toast = useToast();

    return (
        <div className="overflow-x-auto rounded-xl border border-line bg-panel">
            <table className="table">
                <thead className="border-b border-line text-left text-xs text-muted uppercase">
                    <tr>
                        <th className="w-10 px-4 py-3" />
                        <th className="px-2 py-3">Name</th>
                        <th className="px-2 py-3">Size</th>
                        <th className="px-2 py-3">Views</th>
                        <th className="px-2 py-3">Created</th>
                        <th className="px-4 py-3" />
                    </tr>
                </thead>
                <tbody>
                    {drops.map((drop) => (
                        <tr key={drop.id} className="hover:bg-base-200">
                            <td className="px-4 py-2">
                                <input type="checkbox" checked={selected.has(drop.id)} onChange={() => onToggle(drop.id)} className="checkbox checkbox-sm checkbox-primary" aria-label={`Select ${drop.title}`} />
                            </td>
                            <td className="px-2 py-2">
                                <Link to={`/${drop.id}`} className="flex items-center gap-3 hover:text-accent">
                                    <span className="size-10 shrink-0 overflow-hidden rounded-md bg-canvas"><Thumbnail drop={drop} /></span>
                                    <span className="truncate font-medium">{drop.title}</span>
                                    <StatusBadges drop={drop} />
                                </Link>
                            </td>
                            <td className="px-2 py-2 whitespace-nowrap text-muted">{formatBytes(drop.size)}</td>
                            <td className="px-2 py-2 text-muted">{drop.views}</td>
                            <td className="px-2 py-2 whitespace-nowrap text-muted">{formatDate(drop.createdAt)}</td>
                            <td className="px-4 py-2 text-right">
                                <button type="button" title="Copy link" onClick={async () => { await copy(drop.pageUrl); toast('Link copied'); }} className="btn btn-ghost btn-xs btn-square text-primary">
                                    <Copy size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
