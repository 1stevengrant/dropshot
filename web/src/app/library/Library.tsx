import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type DragEvent, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { DropKind, DropQuery } from '../../shared/types';
import { useToast } from '../components/Toast/useToast';
import { api } from '../lib/api';
import { rememberLibraryLocation } from '../lib/libraryLocation';
import { DropGrid } from './DropGrid';
import { DropOverlay } from './DropOverlay';
import { DropTable } from './DropTable';
import { kinds } from './kinds';
import { LibraryHeader } from './LibraryHeader';
import { LibraryToolbar } from './LibraryToolbar';
import { LoadingBar } from './LoadingBar';
import { Pagination } from './Pagination';
import { Sidebar } from './Sidebar';
import { type SortOption, sorts } from './sorts';
import { useUpload } from './useUpload';

export function Library() {
    const [params, setParams] = useSearchParams();
    const [search, setSearch] = useState(params.get('q') ?? '');
    const deferredSearch = useDeferredValue(search);
    const [view, setView] = useState<'grid' | 'list'>(() => (localStorage.getItem('view') as 'grid' | 'list') ?? 'grid');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [dragging, setDragging] = useState(false);
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
    const { uploading, upload } = useUpload(refresh);

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

    function changeSearch(value: string) {
        setSearch(value);

        if (params.has('page')) {
            const next = new URLSearchParams(params);
            next.delete('page');
            setParams(next);
        }
    }

    function changeView(mode: 'grid' | 'list') {
        setView(mode);
        localStorage.setItem('view', mode);
    }

    function changeSort(sort: SortOption) {
        const next = new URLSearchParams(params);
        next.set('sort', sort.sort);
        next.set('dir', sort.dir);
        next.delete('page');
        setParams(next);
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
    const page = query.page ?? 1;

    // Kept in session storage so leaving a drop (back, delete) returns to this exact view.
    useEffect(() => {
        rememberLibraryLocation(params.toString(), deferredSearch);
    }, [params, deferredSearch]);

    // Deleting the last drops on the final page would leave you on an empty page; step back to the last real one.
    useEffect(() => {
        if (drops.data && !drops.isPlaceholderData && page > pageCount) {
            const next = new URLSearchParams(params);
            pageCount > 1 ? next.set('page', String(pageCount)) : next.delete('page');
            setParams(next, { replace: true });
        }
    }, [drops.data, drops.isPlaceholderData, page, pageCount, params, setParams]);

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
                {/* Header and toolbar stay pinned so selection actions are always in reach while scrolling. */}
                <div className="sticky top-0 z-20">
                    <LibraryHeader search={search} onSearch={changeSearch} fileInput={fileInput} onUpload={upload} />

                    <div className={`border-b px-6 py-3 backdrop-blur transition-colors ${selected.size > 0 ? 'border-primary/30 bg-accent-soft/95' : 'border-line bg-base-200/95'}`}>
                        <LibraryToolbar
                            heading={heading}
                            total={drops.data?.total}
                            selected={selected}
                            boards={boards.data ?? []}
                            onAddToBoard={(boardId) => addToBoard.mutate({ boardId, ids: [...selected] })}
                            onDelete={() => remove.mutateAsync([...selected])}
                            allSelected={allSelected}
                            onToggleAll={() => setSelected(allSelected ? new Set() : new Set(items.map((drop) => drop.id)))}
                            view={view}
                            onViewChange={changeView}
                            currentSort={currentSort}
                            onSortChange={changeSort}
                        />
                    </div>
                </div>

                <main className="flex-1 px-6 py-6">
                    {uploading > 0 && (
                        <div role="status" className="alert alert-info alert-soft mb-4 py-2 text-sm"><span className="loading loading-spinner loading-sm" /> Uploading {uploading} file{uploading === 1 ? '' : 's'}…</div>
                    )}

                    {drops.isFetching && <LoadingBar />}

                    {drops.isError && <div role="alert" className="alert alert-error alert-soft">{drops.error.message}</div>}

                    {view === 'grid' ? (
                        <DropGrid
                            drops={items}
                            pending={drops.isPending}
                            dimmed={drops.isPlaceholderData}
                            selected={selected}
                            onToggle={toggle}
                            onChooseFiles={() => fileInput.current?.click()}
                        />
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

            {dragging && <DropOverlay />}
        </div>
    );
}
