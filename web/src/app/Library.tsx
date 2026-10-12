import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowUpDown, CloudUpload, Copy, ExternalLink, FileText, Film, Image, LayoutGrid, Link2, List, Lock, Plus,
    Search, Tag, Timer, Trash2, Upload, X, Files, FolderPlus, KeyRound,
} from 'lucide-react';
import { type DragEvent, type ReactNode, useDeferredValue, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Drop, DropKind, DropQuery } from '../shared/types';
import { api } from './api';
import { copy, formatBytes, formatDate } from './format';
import { Menu, MenuHeading, MenuItem } from './Menu';
import { Thumbnail } from './Thumbnail';
import { useToast } from './Toasts';

const kinds: { kind: DropKind; label: string; icon: ReactNode }[] = [
    { kind: 'image', label: 'Images', icon: <Image size={16} /> },
    { kind: 'video', label: 'Videos', icon: <Film size={16} /> },
    { kind: 'text', label: 'Notes', icon: <FileText size={16} /> },
    { kind: 'link', label: 'Links', icon: <Link2 size={16} /> },
    { kind: 'file', label: 'Files', icon: <Files size={16} /> },
];

const sorts: { sort: NonNullable<DropQuery['sort']>; dir: NonNullable<DropQuery['dir']>; label: string }[] = [
    { sort: 'created', dir: 'desc', label: 'Newest first' },
    { sort: 'created', dir: 'asc', label: 'Oldest first' },
    { sort: 'title', dir: 'asc', label: 'Name (A to Z)' },
    { sort: 'size', dir: 'desc', label: 'Largest first' },
    { sort: 'views', dir: 'desc', label: 'Most viewed' },
];

export function Library() {
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState(params.get('q') ?? '');
    const deferredSearch = useDeferredValue(search);
    const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('view') as 'grid' | 'list') ?? 'grid');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(0);
    const fileInput = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();
    const toast = useToast();

    const query: DropQuery = {
        q: deferredSearch || undefined,
        kind: (params.get('kind') as DropKind) || undefined,
        tag: params.get('tag') || undefined,
        board: params.get('board') ? Number(params.get('board')) : undefined,
        sort: (params.get('sort') as DropQuery['sort']) || 'created',
        dir: (params.get('dir') as DropQuery['dir']) || 'desc',
        page: Number(params.get('page')) || 1,
    };

    const drops = useQuery({ queryKey: ['drops', query], queryFn: () => api.drops(query), placeholderData: (previous) => previous });
    const boards = useQuery({ queryKey: ['boards'], queryFn: api.boards });
    const tags = useQuery({ queryKey: ['tags'], queryFn: api.tags });

    const refresh = () => queryClient.invalidateQueries();

    const remove = useMutation({
        mutationFn: api.remove,
        onSuccess: (_, ids) => {
            setSelected(new Set());
            toast(`Deleted ${ids.length} drop${ids.length === 1 ? '' : 's'}`);
            refresh();
        },
    });

    const addToBoard = useMutation({
        mutationFn: ({ boardId, ids }: { boardId: number; ids: string[] }) => api.addToBoard(boardId, ids),
        onSuccess: () => {
            toast('Added to board');
            setSelected(new Set());
            refresh();
        },
    });

    function filter(next: Record<string, string | null>) {
        const updated = new URLSearchParams();

        for (const key of ['sort', 'dir']) {
            const value = params.get(key);

            if (value) {
                updated.set(key, value);
            }
        }

        for (const [key, value] of Object.entries(next)) {
            if (value) {
                updated.set(key, value);
            }
        }

        setParams(updated);
        setSelected(new Set());
    }

    async function upload(files: FileList | File[]) {
        const list = Array.from(files);

        if (!list.length) {
            return;
        }

        setUploading((count) => count + list.length);

        const results = await Promise.allSettled(list.map((file) => api.upload(file).finally(() => setUploading((count) => count - 1))));
        const uploaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));

        if (uploaded.length === 1) {
            await copy(uploaded[0].pageUrl);
            toast('Uploaded. Link copied.');
        } else if (uploaded.length) {
            toast(`Uploaded ${uploaded.length} files`);
        }

        if (uploaded.length < list.length) {
            toast(`${list.length - uploaded.length} upload${list.length - uploaded.length === 1 ? '' : 's'} failed`);
        }

        refresh();
    }

    function onDrop(event: DragEvent) {
        event.preventDefault();
        setDragging(false);
        upload(event.dataTransfer.files);
    }

    function toggle(id: string) {
        setSelected((current) => {
            const next = new Set(current);
            next.has(id) ? next.delete(id) : next.add(id);

            return next;
        });
    }

    const items = drops.data?.drops ?? [];
    const pageCount = drops.data ? Math.max(1, Math.ceil(drops.data.total / drops.data.perPage)) : 1;

    function goToPage(page: number) {
        const next = new URLSearchParams(params);
        page > 1 ? next.set('page', String(page)) : next.delete('page');
        setParams(next);
        setSelected(new Set());
        window.scrollTo({ top: 0 });
    }
    const allSelected = items.length > 0 && items.every((drop) => selected.has(drop.id));
    const activeBoard = boards.data?.find((board) => board.id === query.board);
    const heading = activeBoard?.name ?? (query.tag ? `#${query.tag}` : kinds.find((kind) => kind.kind === query.kind)?.label ?? 'My drops');
    const currentSort = sorts.find((sort) => sort.sort === query.sort && sort.dir === query.dir) ?? sorts[0];

    return (
        <div
            className="flex min-h-screen"
            onDragOver={(event) => {
                if (event.dataTransfer.types.includes('Files')) {
                    event.preventDefault();
                    setDragging(true);
                }
            }}
            onDragLeave={(event) => {
                if (event.currentTarget === event.target) {
                    setDragging(false);
                }
            }}
            onDrop={onDrop}
        >
            <Sidebar query={query} filter={filter} boards={boards.data ?? []} tags={tags.data ?? []} onBoardsChanged={refresh} />

            <div className="flex min-w-0 flex-1 flex-col">
                <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-panel px-6 py-3">
                    <label className="flex flex-1 items-center gap-3 text-muted">
                        <Search size={18} />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);

                                if (params.has('page')) {
                                    const next = new URLSearchParams(params);
                                    next.delete('page');
                                    setParams(next);
                                }
                            }}
                            placeholder="Search drops and tags"
                            className="w-full bg-transparent py-2 text-ink outline-none placeholder:text-muted"
                        />
                    </label>
                    <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        className="btn btn-primary btn-sm"
                    >
                        <Upload size={16} /> Upload file
                    </button>
                    <input ref={fileInput} type="file" multiple hidden onChange={(event) => { upload(event.target.files ?? []); event.target.value = ''; }} />
                </header>

                <main className="flex-1 px-6 py-6">
                    <div className="mb-5 flex flex-wrap items-center gap-4">
                        <h1 className="flex-1 text-2xl font-semibold">
                            {heading}
                            {drops.data && <span className="ml-2 text-base font-normal text-muted">{drops.data.total.toLocaleString()}</span>}
                        </h1>

                        {selected.size > 0 ? (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted">{selected.size} selected</span>
                                {!!boards.data?.length && (
                                    <Menu
                                        align="right"
                                        label="Add to board"
                                        trigger={({ toggle }) => (
                                            <button type="button" onClick={toggle} className="btn btn-sm">
                                                <FolderPlus size={15} /> Add to board
                                            </button>
                                        )}
                                    >
                                        {(close) => boards.data!.map((board) => (
                                            <MenuItem key={board.id} onSelect={() => { addToBoard.mutate({ boardId: board.id, ids: [...selected] }); close(); }}>
                                                {board.name}
                                            </MenuItem>
                                        ))}
                                    </Menu>
                                )}
                                <button
                                    type="button"
                                    onClick={() => confirm(`Delete ${selected.size} drop${selected.size === 1 ? '' : 's'}? This removes the files for good.`) && remove.mutate([...selected])}
                                    className="btn btn-error btn-sm"
                                >
                                    <Trash2 size={15} /> Delete
                                </button>
                            </div>
                        ) : null}

                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((drop) => drop.id)))}
                                className="checkbox checkbox-sm checkbox-primary"
                            />
                            Select all
                        </label>

                        <div className="join" role="group" aria-label="Layout">
                            {(['grid', 'list'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    aria-pressed={view === mode}
                                    onClick={() => { setView(mode); localStorage.setItem('view', mode); }}
                                    className={`join-item btn btn-sm ${view === mode ? 'btn-active btn-primary' : ''}`}
                                    title={mode === 'grid' ? 'Grid' : 'List'}
                                >
                                    {mode === 'grid' ? <LayoutGrid size={16} /> : <List size={16} />}
                                </button>
                            ))}
                        </div>

                        <Menu
                            align="right"
                            label="Sort"
                            trigger={({ toggle }) => (
                                <button type="button" onClick={toggle} className="btn btn-ghost btn-sm">
                                    <ArrowUpDown size={15} /> {currentSort.label}
                                </button>
                            )}
                        >
                            {(close) => sorts.map((sort) => (
                                <MenuItem
                                    key={sort.label}
                                    checked={sort === currentSort}
                                    onSelect={() => {
                                        const next = new URLSearchParams(params);
                                        next.set('sort', sort.sort);
                                        next.set('dir', sort.dir);
                                        next.delete('page');
                                        setParams(next);
                                        close();
                                    }}
                                >
                                    {sort.label}
                                </MenuItem>
                            ))}
                        </Menu>
                    </div>

                    {uploading > 0 && (
                        <div role="status" className="alert alert-info alert-soft mb-4 py-2 text-sm"><span className="loading loading-spinner loading-sm" /> Uploading {uploading} file{uploading === 1 ? '' : 's'}…</div>
                    )}

                    {drops.isFetching && (
                        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent/20" role="progressbar" aria-label="Loading drops">
                            <div className="h-full w-1/3 animate-[loading_1s_ease-in-out_infinite] bg-accent" />
                        </div>
                    )}

                    {drops.isError && <div role="alert" className="alert alert-error alert-soft">{drops.error.message}</div>}

                    {view === 'grid' ? (
                        <div className={`grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 transition-opacity ${drops.isPlaceholderData ? 'opacity-60' : ''}`}>
                            <button
                                type="button"
                                onClick={() => fileInput.current?.click()}
                                className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line text-muted hover:border-accent hover:text-accent"
                            >
                                <CloudUpload size={48} strokeWidth={1.25} />
                                <span className="text-lg font-medium text-ink">Drop files here</span>
                                <span className="text-sm">or use the Upload file button</span>
                            </button>
                            {drops.isPending && Array.from({ length: 11 }, (_, index) => <SkeletonCard key={index} />)}
                            {items.map((drop) => (
                                <DropCard key={drop.id} drop={drop} selected={selected.has(drop.id)} onToggle={() => toggle(drop.id)} />
                            ))}
                        </div>
                    ) : drops.isPending ? (
                        <p className="py-10 text-center text-muted">Loading drops…</p>
                    ) : (
                        <DropTable drops={items} selected={selected} onToggle={toggle} />
                    )}

                    {pageCount > 1 && <Pagination page={query.page ?? 1} pageCount={pageCount} onChange={goToPage} />}

                    {drops.isSuccess && items.length === 0 && (
                        <p className="mt-10 text-center text-muted">{query.q ? `Nothing matches “${query.q}”.` : 'No drops here yet.'}</p>
                    )}
                </main>
            </div>

            {dragging && (
                <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/15 backdrop-blur-[2px]">
                    <div className="rounded-2xl border-2 border-dashed border-accent bg-panel px-10 py-8 text-center text-lg font-semibold text-accent shadow-xl">
                        Drop to upload
                    </div>
                </div>
            )}
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100" aria-hidden="true">
            <div className="skeleton aspect-[4/3] rounded-none" />
            <div className="flex flex-col gap-2 p-4">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton mt-3 h-3 w-1/3" />
            </div>
        </div>
    );
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
    const pages = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pageCount])].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);

    return (
        <nav className="mt-8 flex justify-center" aria-label="Pages">
            <div className="join">
                <button type="button" className="join-item btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
                {pages.map((value, index) => (
                    <span key={value} className="contents">
                        {index > 0 && value - pages[index - 1] > 1 && <button type="button" className="join-item btn btn-sm btn-disabled" tabIndex={-1}>…</button>}
                        <button
                            type="button"
                            aria-current={value === page ? 'page' : undefined}
                            className={`join-item btn btn-sm ${value === page ? 'btn-primary' : ''}`}
                            onClick={() => onChange(value)}
                        >
                            {value}
                        </button>
                    </span>
                ))}
                <button type="button" className="join-item btn btn-sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Next</button>
            </div>
        </nav>
    );
}

function StatusBadges({ drop }: { drop: Drop }) {
    return (
        <span className="flex items-center gap-1.5 text-muted">
            {drop.privacy === 'private' && <Lock size={14} aria-label="Private" />}
            {drop.privacy === 'password' && <KeyRound size={14} aria-label="Password protected" />}
            {drop.expiresAt !== null && <Timer size={14} aria-label="Self-destructs" />}
        </span>
    );
}

function DropCard({ drop, selected, onToggle }: { drop: Drop; selected: boolean; onToggle: () => void }) {
    const toast = useToast();

    return (
        <article className={`card group relative overflow-hidden border bg-base-100 shadow-sm transition hover:shadow-md ${selected ? 'border-primary ring-2 ring-primary/40' : 'border-base-300'}`}>
            <input
                type="checkbox"
                checked={selected}
                onChange={onToggle}
                aria-label={`Select ${drop.title}`}
                className={`checkbox checkbox-sm checkbox-primary absolute top-2 left-2 z-10 bg-base-100 ${selected ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
            />

            <a href={`/${drop.id}`} className="relative block aspect-[4/3] overflow-hidden bg-canvas">
                <Thumbnail drop={drop} />
                {drop.kind === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-black/55 text-white">▶</span>
                    </span>
                )}
            </a>

            <div className="flex flex-1 flex-col gap-1 p-4">
                <a href={`/${drop.id}`} className="truncate font-medium hover:text-accent" title={drop.title}>
                    {drop.title}
                </a>
                <a href={drop.pageUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-accent hover:underline">
                    {drop.pageUrl.replace(/^https?:\/\//, '')}
                </a>
                <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-muted">
                    <span className="flex-1">{formatDate(drop.createdAt)}</span>
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

function DropTable({ drops, selected, onToggle }: { drops: Drop[]; selected: Set<string>; onToggle: (id: string) => void }) {
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
                                <a href={`/${drop.id}`} className="flex items-center gap-3 hover:text-accent">
                                    <span className="size-10 shrink-0 overflow-hidden rounded-md bg-canvas"><Thumbnail drop={drop} /></span>
                                    <span className="truncate font-medium">{drop.title}</span>
                                    <StatusBadges drop={drop} />
                                </a>
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

interface SidebarProps {
    query: DropQuery;
    filter: (next: Record<string, string | null>) => void;
    boards: { id: number; name: string; count?: number }[];
    tags: { tag: string; count: number }[];
    onBoardsChanged: () => void;
}

function Sidebar({ query, filter, boards, tags, onBoardsChanged }: SidebarProps) {
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
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

    async function deleteBoard(id: number, boardName: string) {
        if (!confirm(`Delete the board “${boardName}”? The drops in it are kept.`)) {
            return;
        }

        await api.deleteBoard(id);
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
                    <SidebarItem key={kind.kind} active={query.kind === kind.kind} onClick={() => filter({ kind: kind.kind })} icon={kind.icon}>
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
                        <button type="button" onClick={() => deleteBoard(board.id, board.name)} title="Delete board" className="btn btn-ghost btn-xs btn-square ml-1 text-muted opacity-0 group-hover:opacity-100 hover:text-error">
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
        </aside>
    );
}

function SidebarItem({ active, onClick, icon, count, children }: { active: boolean; onClick: () => void; icon: ReactNode; count?: number; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`btn btn-ghost btn-sm h-auto w-full min-w-0 justify-start gap-3 px-2 py-1.5 font-normal ${active ? 'btn-active bg-accent-soft font-medium text-primary' : ''}`}
        >
            <span className="shrink-0 text-muted">{icon}</span>
            <span className="flex-1 truncate">{children}</span>
            {count !== undefined && <span className="text-xs text-muted">{count}</span>}
        </button>
    );
}
