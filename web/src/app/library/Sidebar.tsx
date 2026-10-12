import { useQuery } from '@tanstack/react-query';
import { Files, LayoutGrid, Plus, Tag, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { DropQuery } from '../../shared/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Wordmark } from '../components/Wordmark';
import { api } from '../lib/api';
import { kinds } from './kinds';
import { SidebarItem } from './SidebarItem';
import { useCreateBoard } from './useCreateBoard';

interface SidebarProps {
    query: DropQuery;
    filter: (next: Record<string, string | null>) => void;
    boards: { id: number; name: string; count?: number }[];
    tags: { tag: string; count: number }[];
    onBoardsChanged: () => void;
}

export function Sidebar({ query, filter, boards, tags, onBoardsChanged }: SidebarProps) {
    const trash = useQuery({ queryKey: ['trash'], queryFn: api.trashCount });
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [deletingBoard, setDeletingBoard] = useState<{ id: number; name: string } | null>(null);
    const isAll = !query.kind && !query.tag && !query.board && !query.trash;

    const create = useCreateBoard((board) => filter({ board: String(board.id) }));
    // Enter submits the form and the input then loses focus, which would create the board a second time.
    const submitted = useRef(false);

    function startCreating() {
        submitted.current = false;
        setCreating(true);
    }

    function createBoard() {
        if (submitted.current) {
            return;
        }

        submitted.current = true;
        const boardName = name.trim();
        setName('');
        setCreating(false);

        if (boardName) {
            create.mutate(boardName);
        }
    }

    async function deleteBoard(id: number) {
        await api.deleteBoard(id);
        setDeletingBoard(null);
        onBoardsChanged();

        if (query.board === id) {
            filter({});
        }
    }

    return (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-panel px-4 py-5 md:flex">
            <Link to="/" onClick={() => filter({})} className="px-2 text-2xl font-bold tracking-tight text-accent"><Wordmark size={28} /></Link>

            <nav className="flex flex-col gap-0.5">
                <SidebarItem active={isAll} onClick={() => filter({})} icon={<LayoutGrid size={16} />}>My drops</SidebarItem>
                {kinds.map((kind) => (
                    <SidebarItem key={kind.kind} active={query.kind === kind.kind} onClick={() => filter({ kind: kind.kind })} icon={<kind.icon size={16} />}>
                        {kind.label}
                    </SidebarItem>
                ))}
                <SidebarItem active={!!query.trash} onClick={() => filter({ trash: '1' })} icon={<Trash2 size={16} />} count={trash.data?.count || undefined}>
                    Trash
                </SidebarItem>
            </nav>

            <section>
                <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold tracking-wide text-muted uppercase">
                    Boards
                    <button type="button" onClick={startCreating} title="Create a board" className="btn btn-ghost btn-xs btn-square">
                        <Plus size={15} />
                    </button>
                </div>
                {creating && (
                    <form onSubmit={(event) => { event.preventDefault(); createBoard(); }} className="px-1 pb-1">
                        <input
                            autoFocus
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            onBlur={createBoard}
                            placeholder="Board name"
                            className="input input-sm w-full"
                        />
                    </form>
                )}
                {boards.map((board) => (
                    <div key={board.id} className="group flex items-center">
                        <SidebarItem active={query.board === board.id} onClick={() => filter({ board: String(board.id) })} icon={<Files size={16} />} count={board.count}>
                            {board.name}
                        </SidebarItem>
                        <button type="button" onClick={() => setDeletingBoard({ id: board.id, name: board.name })} title="Delete board" className="btn btn-ghost btn-xs btn-square ml-1 text-muted opacity-0 group-hover:opacity-100 hover:text-error">
                            <X size={14} />
                        </button>
                    </div>
                ))}
                {!boards.length && !creating && <p className="px-2 text-sm text-muted">Group drops into boards.</p>}
            </section>

            <section>
                <div className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted uppercase">Tags</div>
                {tags.map((tag) => (
                    <SidebarItem key={tag.tag} active={query.tag === tag.tag} onClick={() => filter({ tag: tag.tag })} icon={<Tag size={15} />} count={tag.count}>
                        {tag.tag}
                    </SidebarItem>
                ))}
            </section>
            {deletingBoard && (
                <ConfirmDialog
                    title={`Delete the board “${deletingBoard.name}”?`}
                    message="The drops in it are kept; only the board goes."
                    confirmLabel="Delete board"
                    onConfirm={() => deleteBoard(deletingBoard.id)}
                    onCancel={() => setDeletingBoard(null)}
                />
            )}
        </aside>
    );
}
