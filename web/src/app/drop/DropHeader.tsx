import { ChevronLeft, Download, Pencil, Trash2 } from 'lucide-react';
import type { Drop } from '../../shared/types';
import { previewUrl } from '../lib/api';
import { libraryLocation } from '../lib/libraryLocation';

export function DropHeader({ drop, onMarkup, onDelete }: { drop: Drop; onMarkup: () => void; onDelete: () => void }) {
    return (
        <header className="flex items-center gap-4 border-b border-line bg-panel px-4 py-3">
            <a href={libraryLocation()} className="btn btn-ghost btn-sm btn-square" title="Back to my drops">
                <ChevronLeft size={20} />
            </a>
            <a href={libraryLocation()} className="text-xl font-bold tracking-tight text-accent">Dropshot</a>
            <h1 className="ml-4 min-w-0 flex-1 truncate border-l border-line pl-6 font-medium">{drop.title}</h1>
            <a href={`${previewUrl(drop)}?download=1`} className="btn btn-sm">
                <Download size={16} /> <span className="hidden sm:inline">Download</span>
            </a>
            {drop.kind === 'image' && !drop.contentType.includes('gif') && (
                <button type="button" onClick={onMarkup} className="btn btn-sm">
                    <Pencil size={16} /> <span className="hidden sm:inline">Markup</span>
                </button>
            )}
            <button type="button" onClick={onDelete} className="btn btn-error btn-sm">
                <Trash2 size={16} /> <span className="hidden sm:inline">Delete</span>
            </button>
        </header>
    );
}
