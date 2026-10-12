import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus } from 'lucide-react';
import type { Drop } from '../../shared/types';
import { Menu } from '../components/Menu';
import { MenuHeading } from '../components/MenuHeading';
import { MenuItem } from '../components/MenuItem';
import { api } from '../lib/api';

export function BoardsPicker({ drop }: { drop: Drop }) {
    const queryClient = useQueryClient();
    const boards = useQuery({ queryKey: ['boards'], queryFn: api.boards });

    async function toggleBoard(boardId: number) {
        if (drop.boards.some((board) => board.id === boardId)) {
            await api.removeFromBoard(boardId, drop.id);
        } else {
            await api.addToBoard(boardId, [drop.id]);
        }

        queryClient.invalidateQueries();
    }

    return (
        <Menu
            align="left"
            label="Boards"
            trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className="flex flex-wrap items-center gap-1.5 text-left">
                    {drop.boards.length
                        ? drop.boards.map((board) => <span key={board.id} className="badge badge-ghost">{board.name}</span>)
                        : <span className="flex items-center gap-1 text-muted"><FolderPlus size={14} /> Add drop to board</span>}
                </button>
            )}
        >
            {() => (
                <>
                    <MenuHeading>Boards</MenuHeading>
                    {(boards.data ?? []).map((board) => (
                        <MenuItem key={board.id} checked={drop.boards.some((item) => item.id === board.id)} onSelect={() => toggleBoard(board.id)}>
                            {board.name}
                        </MenuItem>
                    ))}
                    {!boards.data?.length && <li className="px-3 py-2 text-sm text-muted">Create a board from the sidebar first.</li>}
                </>
            )}
        </Menu>
    );
}
