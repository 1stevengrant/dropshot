import { RotateCcw, Trash2 } from 'lucide-react';
import type { Drop } from '../../shared/types';
import { trashCountdown } from '../lib/trash';

/** Shown on a drop that is in the trash: its link is off until it's restored. */
export function TrashBanner({ drop, onRestore, onPurge }: { drop: Drop; onRestore: () => void; onPurge: () => void }) {
    return (
        <div role="alert" className="alert alert-warning alert-soft rounded-none border-x-0 border-t-0 text-base-content">
            <Trash2 size={18} className="text-warning" />
            <span className="flex-1">
                This drop is in the trash and its link doesn’t work. {trashCountdown(drop.deletedAt ?? Date.now())}.
            </span>
            <button type="button" onClick={onRestore} className="btn btn-sm">
                <RotateCcw size={15} /> Restore
            </button>
            <button type="button" onClick={onPurge} className="btn btn-error btn-sm">
                Delete forever
            </button>
        </div>
    );
}
