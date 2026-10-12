import { Files, LayoutGrid, Plus, Tag, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import type { DropQuery } from '../../shared/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../lib/api';
import { kinds } from './kinds';
import { SidebarItem } from './SidebarItem';

interface SidebarProps {
    query: DropQuery;
    filter: (next: Record<string, string | null>) => void;
    boards: { id: number; name: string; count?: number }[];
    tags: { tag: string; count: number }[];
    onBoardsChanged: () => void;
}

export function Sidebar({ query, filter, boards, tags, onBoardsChanged }: SidebarProps) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [deletingBoard, setDeletingBoard] = useState<{ id: number; name: string } | null>(null);
    const isAll = !query.kind && !query.tag && !query.board;

    async function createBoard() {
        if (!name.trim()) {
            setCreating(false);

            return;
        }

        const board = await api.createBoard(name);
        setName('');
        setCreating(false);
        onBoardsChanged();
        filter({ board: String(board.id) });
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
            <Link to="/" onClick={() => filter({})} className="px-2 text-2xl font-bold tracking-tight text-accent">Dropshot</Link>

            <nav className="flex flex-col gap-0.5">
                <SidebarItem active={isAll} onClick={() => filter({})} icon={<LayoutGrid size={16} />}>My drops</SidebarItem>
                {kinds.map((kind) => (
                    <SidebarItem key={kind.kind} active={query.kind === kind.kind} onClick={() => filter({ kind: kind.kind })} icon={<kind.icon size={16} />}>
                        {kind.label}
                    </SidebarItem>
                ))}
            </nav>

            <section>
                <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold tracking-wide text-muted uppercase">
                    Boards
                    <button type="button" onClick={() => setCreating(true)} title="Create a board" className="btn btn-ghost btn-xs btn-square">
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
