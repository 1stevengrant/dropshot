import type { Board } from '../../shared/types';
import { LayoutToggle } from './LayoutToggle';
import { SelectionActions } from './SelectionActions';
import { SortMenu } from './SortMenu';
import type { SortOption } from './sorts';

interface LibraryToolbarProps {
    heading: string;
    total?: number;
    selected: Set<string>;
    boards: Board[];
    onAddToBoard: (boardId: number) => void;
    onDelete: () => Promise<unknown>;
    allSelected: boolean;
    onToggleAll: () => void;
    view: 'grid' | 'list';
    onViewChange: (view: 'grid' | 'list') => void;
    currentSort: SortOption;
    onSortChange: (sort: SortOption) => void;
}

export function LibraryToolbar({
    heading, total, selected, boards, onAddToBoard, onDelete, allSelected, onToggleAll, view, onViewChange, currentSort, onSortChange,
}: LibraryToolbarProps) {
    return (
        <div className="flex flex-wrap items-center gap-4">
            <h1 className="flex-1 text-2xl font-semibold">
                {heading}
                {total !== undefined && <span className="ml-2 text-base font-normal text-muted">{total.toLocaleString()}</span>}
            </h1>

            {selected.size > 0 ? <SelectionActions count={selected.size} boards={boards} onAddToBoard={onAddToBoard} onDelete={onDelete} /> : null}

            <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleAll}
                    className="checkbox checkbox-sm checkbox-primary"
                />
                Select all
            </label>

            <LayoutToggle view={view} onChange={onViewChange} />

            <SortMenu current={currentSort} onChange={onSortChange} />
        </div>
    );
}
