import type { Drop } from '../../shared/types';
import { DropCard } from './DropCard';
import { SkeletonCard } from './SkeletonCard';
import { UploadTile } from './UploadTile';

interface DropGridProps {
    drops: Drop[];
    pending: boolean;
    dimmed: boolean;
    selected: Set<string>;
    onToggle: (id: string) => void;
    onChooseFiles: () => void;
}

export function DropGrid({ drops, pending, dimmed, selected, onToggle, onChooseFiles }: DropGridProps) {
    return (
        <div className={`grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 transition-opacity ${dimmed ? 'opacity-60' : ''}`}>
            <UploadTile onClick={onChooseFiles} />
            {pending && Array.from({ length: 11 }, (_, index) => <SkeletonCard key={index} />)}
            {drops.map((drop) => (
                <DropCard key={drop.id} drop={drop} selected={selected.has(drop.id)} onToggle={() => onToggle(drop.id)} />
            ))}
        </div>
    );
}
