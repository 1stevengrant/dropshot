import { FolderPlus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Board } from '../../shared/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Menu } from '../components/Menu';
import { MenuItem } from '../components/MenuItem';

interface SelectionActionsProps {
    count: number;
    boards: Board[];
    onAddToBoard: (boardId: number) => void;
    onDelete: () => Promise<unknown> | void;
}

export function SelectionActions({ count, boards, onAddToBoard, onDelete }: SelectionActionsProps) {
    const [confirming, setConfirming] = useState(false);
    const noun = `${count} drop${count === 1 ? '' : 's'}`;

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted">{count} selected</span>
            {!!boards.length && (
                <Menu
                    align="right"
                    label="Add to board"
                    trigger={({ toggle }) => (
                        <button type="button" onClick={toggle} className="btn btn-sm">
                            <FolderPlus size={15} /> Add to board
                        </button>
                    )}
                >
                    {(close) => boards.map((board) => (
                        <MenuItem key={board.id} onSelect={() => { onAddToBoard(board.id); close(); }}>
                            {board.name}
                        </MenuItem>
                    ))}
                </Menu>
            )}
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className="btn btn-error btn-sm"
            >
                <Trash2 size={15} /> Delete
            </button>
            {confirming && (
                <ConfirmDialog
                    title={`Delete ${noun}?`}
                    message="The files are removed for good and their links stop working."
                    confirmLabel={`Delete ${noun}`}
                    onConfirm={async () => {
                        await onDelete();
                        setConfirming(false);
                    }}
                    onCancel={() => setConfirming(false)}
                />
            )}
        </div>
    );
}
