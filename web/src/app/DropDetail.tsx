import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ChevronLeft, Clock, Code, Copy, Download, Ellipsis, ExternalLink, Eye, FolderPlus, Globe, KeyRound, Link2, Lock, Pencil, Tag, Trash2, X,
} from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Activity, Drop, DropUpdate, Privacy } from '../shared/types';
import { api, previewUrl } from './api';
import { copy, formatBytes, formatDate, formatExpiry } from './format';
import { MarkupEditor } from './MarkupEditor';
import { Menu, MenuDivider, MenuHeading, MenuItem } from './Menu';
import { useToast } from './Toasts';

const hour = 3_600_000;

const expiries: { label: string; duration: number | null }[] = [
    { label: 'Keep forever', duration: null },
    { label: 'One hour', duration: hour },
    { label: 'One day', duration: 24 * hour },
    { label: 'One week', duration: 7 * 24 * hour },
    { label: 'One month', duration: 30 * 24 * hour },
    { label: 'Three months', duration: 91 * 24 * hour },
    { label: 'Six months', duration: 182 * 24 * hour },
];

const privacies: { privacy: Privacy; label: string; description: string; icon: ReactNode }[] = [
    { privacy: 'public', label: 'Public', description: 'Anyone with the link', icon: <Globe size={15} /> },
    { privacy: 'password', label: 'Password', description: 'Anyone with the link and password', icon: <KeyRound size={15} /> },
    { privacy: 'private', label: 'Private', description: 'Only you, when signed in', icon: <Lock size={15} /> },
];

export function DropDetail() {
    const { id = '' } = useParams();
    const drop = useQuery({ queryKey: ['drop', id], queryFn: () => api.drop(id) });

    if (drop.isError) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-4">
                <p className="text-muted">{drop.error.message}</p>
                <Link to="/" className="text-accent">Back to my drops</Link>
            </div>
        );
    }

    if (!drop.data) {
        return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>;
    }

    return <DropView key={drop.data.id} drop={drop.data} />;
}

function DropView({ drop }: { drop: Drop }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const toast = useToast();
    const [marking, setMarking] = useState(false);
    const [version, setVersion] = useState(0);

    async function saveMarkup(image: Blob, mode: 'copy' | 'replace') {
        const filename = `${drop.title.replace(/[/\\]/g, '-')}${mode === 'copy' ? ' (markup)' : ''}.png`;

        if (mode === 'replace') {
            const updated = await api.replaceFile(drop.id, image, filename);
            queryClient.setQueryData(['drop', drop.id], updated);
            queryClient.invalidateQueries({ queryKey: ['drops'] });
            setVersion((value) => value + 1);
            setMarking(false);
            toast('Markup saved over the original');

            return;
        }

        const created = await api.upload(image, filename, `${drop.title} (markup)`);
        await copy(created.pageUrl).catch(() => {});
        queryClient.invalidateQueries({ queryKey: ['drops'] });
        setMarking(false);
        toast('Saved as a new drop. Link copied.');
        navigate(`/${created.id}`);
    }

    const update = useMutation({
        mutationFn: (changes: DropUpdate) => api.update(drop.id, changes),
        onSuccess: (updated) => {
            queryClient.setQueryData(['drop', drop.id], updated);
            queryClient.invalidateQueries({ queryKey: ['drops'] });
            queryClient.invalidateQueries({ queryKey: ['tags'] });
        },
        onError: (error) => toast(error.message),
    });

    const remove = useMutation({
        mutationFn: () => api.remove([drop.id]),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast('Drop deleted');
            navigate('/');
        },
    });

    function confirmDelete() {
        if (confirm(`Delete “${drop.title}”? The file is removed for good and the link stops working.`)) {
            remove.mutate();
        }
    }

    return (
        <div className="flex h-screen flex-col">
            <header className="flex items-center gap-4 border-b border-line bg-panel px-4 py-3">
                <Link to="/" className="btn btn-ghost btn-sm btn-square" title="Back to my drops">
                    <ChevronLeft size={20} />
                </Link>
                <Link to="/" className="text-xl font-bold tracking-tight text-accent">Dropshot</Link>
                <h1 className="ml-4 min-w-0 flex-1 truncate border-l border-line pl-6 font-medium">{drop.title}</h1>
                <a href={`${previewUrl(drop)}?download=1`} className="btn btn-sm">
                    <Download size={16} /> <span className="hidden sm:inline">Download</span>
                </a>
                {drop.kind === 'image' && !drop.contentType.includes('gif') && (
                    <button type="button" onClick={() => setMarking(true)} className="btn btn-sm">
                        <Pencil size={16} /> <span className="hidden sm:inline">Markup</span>
                    </button>
                )}
                <button type="button" onClick={confirmDelete} className="btn btn-error btn-sm">
                    <Trash2 size={16} /> <span className="hidden sm:inline">Delete</span>
                </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
                    <Preview drop={drop} version={version} />
                </main>
                <InfoPanel drop={drop} onChange={(changes) => update.mutate(changes)} onDelete={confirmDelete} />
            </div>

            {marking && <MarkupEditor src={`${previewUrl(drop)}?v=${version}`} title={drop.title} onCancel={() => setMarking(false)} onSave={saveMarkup} />}
        </div>
    );
}

function Preview({ drop, version }: { drop: Drop; version: number }) {
    const src = version ? `${previewUrl(drop)}?v=${version}` : previewUrl(drop);
    const text = useQuery({ queryKey: ['text', drop.id], queryFn: async () => (await fetch(src)).text(), enabled: drop.kind === 'text' });

    switch (drop.kind) {
        case 'image':
            return <img src={src} alt={drop.title} className="max-h-full max-w-full rounded-lg shadow-lg" />;
        case 'video':
            return <video src={src} controls playsInline className="max-h-full max-w-full rounded-lg bg-black shadow-lg" />;
        case 'audio':
            return <audio src={src} controls className="w-full max-w-xl" />;
        case 'pdf':
            return <iframe src={src} title={drop.title} className="h-full w-full rounded-lg border border-line bg-white" />;
        case 'text':
            return <pre className="max-h-full w-full max-w-3xl overflow-auto rounded-xl border border-line bg-panel p-6 font-mono text-sm whitespace-pre-wrap">{text.data ?? 'Loading…'}</pre>;
        case 'link':
            return (
                <div className="rounded-xl border border-line bg-panel p-8 text-center">
                    <Link2 className="mx-auto mb-3 text-accent" size={40} />
                    <p className="mb-2 text-muted">Short link to</p>
                    <a href={drop.targetUrl ?? '#'} target="_blank" rel="noreferrer" className="break-all text-accent hover:underline">{drop.targetUrl}</a>
                </div>
            );
        default:
            return (
                <div className="rounded-xl border border-line bg-panel p-10 text-center">
                    <p className="mb-1 text-lg font-medium">{drop.filename}</p>
                    <p className="mb-5 text-muted">{formatBytes(drop.size)}</p>
                    <a href={`${src}?download=1`} className="btn btn-primary">
                        <Download size={16} /> Download
                    </a>
                </div>
            );
    }
}

function InfoPanel({ drop, onChange, onDelete }: { drop: Drop; onChange: (changes: DropUpdate) => void; onDelete: () => void }) {
    const toast = useToast();
    const queryClient = useQueryClient();
    const boards = useQuery({ queryKey: ['boards'], queryFn: api.boards });
    const [title, setTitle] = useState(drop.title);
    const [password, setPassword] = useState<string | null>(null);
    const [customExpiry, setCustomExpiry] = useState<string | null>(null);
    const [tagInput, setTagInput] = useState('');
    const [tab, setTab] = useState<'activity' | 'info'>('info');
    const [ctaDraft, setCtaDraft] = useState<{ label: string; url: string } | null>(null);

    function saveTitle() {
        if (title.trim() && title !== drop.title) {
            onChange({ title });
        }
    }

    function choosePrivacy(privacy: Privacy) {
        if (privacy === 'password') {
            setPassword('');

            return;
        }

        onChange({ privacy });
        toast(privacy === 'public' ? 'Anyone with the link can view this drop' : 'Only you can view this drop');
    }

    function savePassword() {
        if (!password) {
            return;
        }

        onChange({ privacy: 'password', password });
        setPassword(null);
        toast('Password set');
    }

    function addTag() {
        const tag = tagInput.trim();

        if (tag) {
            onChange({ tags: [...drop.tags, tag] });
        }

        setTagInput('');
    }

    async function toggleBoard(boardId: number) {
        if (drop.boards.some((board) => board.id === boardId)) {
            await api.removeFromBoard(boardId, drop.id);
        } else {
            await api.addToBoard(boardId, [drop.id]);
        }

        queryClient.invalidateQueries();
    }

    const currentPrivacy = privacies.find((option) => option.privacy === drop.privacy)!;

    return (
        <aside className="w-full shrink-0 overflow-y-auto border-t border-line bg-panel lg:w-96 lg:border-t-0 lg:border-l">
            <div className="tabs tabs-border grid grid-cols-2 border-b border-base-300" role="tablist">
                {(['activity', 'info'] as const).map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() => setTab(value)}
                        className={`tab h-12 ${tab === value ? 'tab-active' : ''}`}
                    >
                        {value === 'activity' ? 'Activities' : 'File info'}
                    </button>
                ))}
            </div>

            {tab === 'activity' ? <ActivityList drop={drop} /> : (
            <>
            <section className="border-b border-line px-6 py-6 text-center">
                <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
                    aria-label="Title"
                    className="input input-ghost w-full truncate text-center text-lg font-semibold"
                />

                <div className="mt-4 flex justify-center gap-3">
                    <CircleButton title="Copy link" onClick={async () => { await copy(drop.pageUrl); toast('Link copied'); }}>
                        <Link2 size={18} />
                    </CircleButton>

                    <Menu
                        label="Embed and share"
                        trigger={({ toggle }) => (
                            <CircleButton title="Embed" onClick={toggle}>
                                <Code size={18} />
                            </CircleButton>
                        )}
                    >
                        {(close) => (
                            <>
                                <MenuHeading>Embed and share</MenuHeading>
                                <MenuItem onSelect={async () => { await copy(await iframeCode(drop)); toast('Embed code copied'); close(); }}>
                                    <span className="flex flex-col">
                                        <span className="font-medium">Embed (iframe)</span>
                                        <span className="text-xs text-muted">Paste into a website, Notion or a blog</span>
                                    </span>
                                </MenuItem>
                                <MenuDivider />
                                {embedFormats(drop).map((format) => (
                                    <MenuItem key={format.label} onSelect={async () => { await copy(format.value); toast(`${format.label} copied`); close(); }}>
                                        {format.label}
                                    </MenuItem>
                                ))}
                            </>
                        )}
                    </Menu>

                    <Menu
                        label="Drop privacy"
                        trigger={({ toggle }) => (
                            <CircleButton title={`Privacy: ${currentPrivacy.label}`} onClick={toggle} active={drop.privacy !== 'public'}>
                                {drop.privacy === 'public' ? <Globe size={18} /> : drop.privacy === 'password' ? <KeyRound size={18} /> : <Lock size={18} />}
                            </CircleButton>
                        )}
                    >
                        {(close) => (
                            <>
                                <MenuHeading>Drop privacy</MenuHeading>
                                {privacies.map((option) => (
                                    <MenuItem key={option.privacy} checked={drop.privacy === option.privacy} onSelect={() => { choosePrivacy(option.privacy); close(); }}>
                                        <span className="flex flex-col">
                                            <span className="flex items-center gap-2">{option.label} <span className="text-muted">{option.icon}</span></span>
                                            <span className="text-xs text-muted">{option.description}</span>
                                        </span>
                                    </MenuItem>
                                ))}
                            </>
                        )}
                    </Menu>

                    <Menu
                        label="Self-destruct"
                        trigger={({ toggle }) => (
                            <CircleButton title="Manage drop self-destruction" onClick={toggle} active={drop.expiresAt !== null}>
                                <Clock size={18} />
                            </CircleButton>
                        )}
                    >
                        {(close) => (
                            <>
                                <MenuHeading>File expires in</MenuHeading>
                                {expiries.map((option) => (
                                    <MenuItem
                                        key={option.label}
                                        onSelect={() => {
                                            onChange({ expiresAt: option.duration === null ? null : Date.now() + option.duration });
                                            close();
                                        }}
                                    >
                                        {option.label}
                                    </MenuItem>
                                ))}
                                <MenuItem onSelect={() => { setCustomExpiry(''); close(); }}>Custom…</MenuItem>
                            </>
                        )}
                    </Menu>

                    <Menu
                        align="right"
                        label="More"
                        trigger={({ toggle }) => (
                            <CircleButton title="More" onClick={toggle}>
                                <Ellipsis size={18} />
                            </CircleButton>
                        )}
                    >
                        {(close) => (
                            <>
                                <MenuItem onSelect={async () => { await copy(drop.directUrl); toast('Direct link copied'); close(); }}>
                                    <Copy size={15} /> Copy direct link
                                </MenuItem>
                                <MenuItem onSelect={() => { window.open(`${drop.pageUrl}?preview`, '_blank'); close(); }}>
                                    <ExternalLink size={15} /> View as visitor
                                </MenuItem>
                                <MenuItem onSelect={() => { window.location.href = `${previewUrl(drop)}?download=1`; close(); }}>
                                    <Download size={15} /> Download
                                </MenuItem>
                                <MenuDivider />
                                <MenuItem danger onSelect={() => { close(); onDelete(); }}>
                                    <Trash2 size={15} /> Delete
                                </MenuItem>
                            </>
                        )}
                    </Menu>
                </div>

                <p className="mt-3 text-xs text-muted">
                    {currentPrivacy.description} · {formatExpiry(drop.expiresAt)}
                </p>

                {password !== null && (
                    <form onSubmit={(event) => { event.preventDefault(); savePassword(); }} className="mt-4 flex gap-2">
                        <input
                            type="password"
                            autoFocus
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Set a password"
                            autoComplete="new-password"
                            className="input input-sm min-w-0 flex-1"
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Save</button>
                        <button type="button" onClick={() => setPassword(null)} className="btn btn-ghost btn-sm btn-square"><X size={16} /></button>
                    </form>
                )}

                {customExpiry !== null && (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();

                            if (customExpiry) {
                                onChange({ expiresAt: new Date(customExpiry).getTime() });
                            }

                            setCustomExpiry(null);
                        }}
                        className="mt-4 flex gap-2"
                    >
                        <input
                            type="datetime-local"
                            autoFocus
                            value={customExpiry}
                            min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
                            onChange={(event) => setCustomExpiry(event.target.value)}
                            className="input input-sm min-w-0 flex-1"
                        />
                        <button type="submit" className="btn btn-primary btn-sm">Set</button>
                        <button type="button" onClick={() => setCustomExpiry(null)} className="btn btn-ghost btn-sm btn-square"><X size={16} /></button>
                    </form>
                )}
            </section>

            <Section title="File options">
                <label className="flex items-center justify-between text-sm">
                    Download permission
                    <Switch checked={drop.allowDownload} onChange={(allowDownload) => onChange({ allowDownload })} />
                </label>
                <p className="mt-1 text-xs text-muted">When off, the drop page has no download button and direct downloads are refused.</p>
            </Section>

            <section className="border-b border-line px-6 py-5">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-semibold">CTAs</h2>
                    {!drop.cta && ctaDraft === null && (
                        <button type="button" onClick={() => setCtaDraft({ label: '', url: '' })} className="text-sm text-accent hover:underline">Add CTA</button>
                    )}
                </div>
                {ctaDraft !== null ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            onChange({ cta: ctaDraft });
                            setCtaDraft(null);
                        }}
                        className="flex flex-col gap-2"
                    >
                        <input value={ctaDraft.label} onChange={(event) => setCtaDraft({ ...ctaDraft, label: event.target.value })} placeholder="Button label, e.g. Book a call" className="input input-sm w-full" />
                        <input type="url" required value={ctaDraft.url} onChange={(event) => setCtaDraft({ ...ctaDraft, url: event.target.value })} placeholder="https://" className="input input-sm w-full" />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setCtaDraft(null)} className="btn btn-ghost btn-sm">Cancel</button>
                            <button type="submit" className="btn btn-primary btn-sm">Save</button>
                        </div>
                    </form>
                ) : drop.cta ? (
                    <div className="flex items-center gap-3 text-sm">
                        <span className="badge badge-outline badge-lg">{drop.cta.label}</span>
                        <span className="min-w-0 flex-1 truncate text-muted">{drop.cta.url}</span>
                        <button type="button" onClick={() => setCtaDraft({ label: drop.cta!.label, url: drop.cta!.url })} className="text-accent hover:underline">Edit</button>
                        <button type="button" onClick={() => onChange({ cta: null })} title="Remove CTA" className="text-muted hover:text-danger"><X size={15} /></button>
                    </div>
                ) : (
                    <p className="text-center text-sm text-muted">No CTAs added. A CTA shows a button on the public drop page.</p>
                )}
            </section>

            <Section title="File details">
                <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-3 text-sm">
                    <dt className="text-muted">Size</dt>
                    <dd>{formatBytes(drop.size)}</dd>
                    <dt className="text-muted">Type</dt>
                    <dd className="truncate">{drop.contentType}</dd>
                    <dt className="text-muted">Created</dt>
                    <dd>{formatDate(drop.createdAt)}</dd>
                    <dt className="text-muted">Boards</dt>
                    <dd>
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
                    </dd>
                    <dt className="pt-1 text-muted">Tags</dt>
                    <dd className="flex flex-wrap items-center gap-1.5">
                        {drop.tags.map((tag) => (
                            <span key={tag} className="badge badge-ghost gap-1">
                                #{tag}
                                <button type="button" title={`Remove ${tag}`} onClick={() => onChange({ tags: drop.tags.filter((item) => item !== tag) })} className="text-muted hover:text-danger">
                                    <X size={12} />
                                </button>
                            </span>
                        ))}
                        <form onSubmit={(event) => { event.preventDefault(); addTag(); }} className="flex items-center gap-1 text-muted">
                            <Tag size={13} />
                            <input
                                value={tagInput}
                                onChange={(event) => setTagInput(event.target.value)}
                                onBlur={addTag}
                                placeholder="Add tag"
                                className="w-20 bg-transparent text-ink outline-none placeholder:text-muted"
                            />
                        </form>
                    </dd>
                </dl>
            </Section>

            <Section title="Stats">
                <div className="flex items-center gap-3">
                    <Eye className="text-muted" size={18} />
                    <div>
                        <div className="text-xl font-semibold">{drop.views}</div>
                        <div className="text-sm text-muted">Views</div>
                    </div>
                </div>
            </Section>
            </>
            )}
        </aside>
    );
}

/** Responsive iframe code; images and videos keep their real aspect ratio. */
async function iframeCode(drop: Drop): Promise<string> {
    const ratio = await aspectRatio(drop);
    const src = `${drop.pageUrl}/embed`;
    const title = drop.title.replace(/"/g, '&quot;');

    if (drop.kind === 'audio') {
        return `<iframe src="${src}" title="${title}" style="width:100%;height:64px;border:0" loading="lazy"></iframe>`;
    }

    return `<div style="position:relative;width:100%;padding-top:${(ratio * 100).toFixed(2)}%"><iframe src="${src}" title="${title}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
}

function aspectRatio(drop: Drop): Promise<number> {
    const fallback = { pdf: 1.3, text: 0.75, link: 0.25, file: 0.4 }[drop.kind as string] ?? 9 / 16;

    if (drop.kind !== 'image' && drop.kind !== 'video') {
        return Promise.resolve(fallback);
    }

    return new Promise((resolve) => {
        const element = drop.kind === 'image' ? new Image() : document.createElement('video');
        const done = (width: number, height: number) => resolve(width && height ? height / width : fallback);

        if (element instanceof HTMLImageElement) {
            element.onload = () => done(element.naturalWidth, element.naturalHeight);
        } else {
            element.preload = 'metadata';
            element.onloadedmetadata = () => done(element.videoWidth, element.videoHeight);
        }

        element.onerror = () => resolve(fallback);
        element.src = previewUrl(drop);
        setTimeout(() => resolve(fallback), 4000);
    });
}

function embedFormats(drop: Drop): { label: string; value: string }[] {
    const formats = [{ label: 'Share link', value: drop.pageUrl }, { label: 'Direct link', value: drop.directUrl }];

    if (drop.kind === 'image') {
        return [
            ...formats,
            { label: 'Markdown', value: `![${drop.title}](${drop.directUrl})` },
            { label: 'HTML', value: `<a href="${drop.pageUrl}"><img src="${drop.directUrl}" alt="${drop.title.replace(/"/g, '&quot;')}"></a>` },
            { label: 'BBCode', value: `[url=${drop.pageUrl}][img]${drop.directUrl}[/img][/url]` },
        ];
    }

    return [
        ...formats,
        { label: 'Markdown', value: `[${drop.title}](${drop.pageUrl})` },
        { label: 'HTML', value: `<a href="${drop.pageUrl}">${drop.title.replace(/</g, '&lt;')}</a>` },
        { label: 'BBCode', value: `[url=${drop.pageUrl}]${drop.title}[/url]` },
    ];
}

function ActivityList({ drop }: { drop: Drop }) {
    const activity = useQuery({ queryKey: ['activity', drop.id], queryFn: () => api.activity(drop.id) });
    const items: (Activity | { id: 'created'; kind: 'created'; viewedAt: number })[] = [...(activity.data ?? []), { id: 'created', kind: 'created', viewedAt: drop.createdAt }];

    return (
        <section className="px-6 py-5">
            <p className="mb-4 text-sm text-muted">
                {drop.views} view{drop.views === 1 ? '' : 's'} in total{drop.tags.includes('droplr') ? ', including views on Droplr' : ''}. Individual visits are logged from 12 Oct 2026 onwards, and your own visits aren’t counted.
            </p>
            {activity.isPending && <p className="text-sm text-muted">Loading…</p>}
            <ol className="flex flex-col gap-4">
                {items.map((item) => (
                    <li key={item.id} className="flex gap-3 text-sm">
                        <span className="mt-0.5 text-muted">{item.kind === 'download' ? <Download size={15} /> : item.kind === 'created' ? <Clock size={15} /> : <Eye size={15} />}</span>
                        <div className="min-w-0">
                            <div className="font-medium">
                                {item.kind === 'created' ? 'Drop created' : item.kind === 'download' ? 'Downloaded' : 'Viewed'}
                                {'country' in item && item.country && <span className="font-normal text-muted"> from {[item.city, item.country].filter(Boolean).join(', ')}</span>}
                            </div>
                            <div className="text-xs text-muted">
                                {formatDate(item.viewedAt)}
                                {'browser' in item && item.browser && ` · ${item.browser}`}
                                {'referrer' in item && item.referrer && ` · via ${item.referrer}`}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="border-b border-line px-6 py-5">
            <h2 className="mb-4 font-semibold">{title}</h2>
            {children}
        </section>
    );
}

function CircleButton({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: ReactNode }) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            className={`btn btn-circle ${active ? 'btn-primary btn-soft' : 'btn-outline border-base-300'}`}
        >
            {children}
        </button>
    );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
    return <input type="checkbox" className="toggle toggle-success" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} />;
}
