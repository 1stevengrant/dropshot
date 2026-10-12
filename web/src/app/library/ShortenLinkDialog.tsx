import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useToast } from '../components/Toast/useToast';
import { api } from '../lib/api';
import { copy } from '../lib/format';

interface ShortenLinkDialogProps {
    onClose: () => void;
}

/** Turns a long URL into a d.ghijk.nz short link and copies it. */
export function ShortenLinkDialog({ onClose }: ShortenLinkDialogProps) {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');
    const queryClient = useQueryClient();
    const toast = useToast();

    const shorten = useMutation({
        mutationFn: () => api.shorten(url.trim(), title.trim() || undefined),
        onSuccess: async (drop) => {
            await copy(drop.pageUrl).catch(() => {});
            queryClient.invalidateQueries();
            toast('Short link copied');
            onClose();
        },
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        shorten.mutate();
    }

    return (
        <dialog open className="modal modal-open" aria-labelledby="shorten-link-title" onCancel={onClose}>
            <form onSubmit={submit} className="modal-box flex flex-col gap-4">
                <h2 id="shorten-link-title" className="text-lg font-semibold">Shorten a link</h2>

                <label className="floating-label">
                    <span>Long URL</span>
                    <input
                        type="url"
                        required
                        autoFocus
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.com/a/very/long/link"
                        className="input w-full"
                    />
                </label>

                <label className="floating-label">
                    <span>Title (optional)</span>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" className="input w-full" />
                </label>

                {shorten.isError && <div role="alert" className="alert alert-error alert-soft text-sm">{shorten.error.message}</div>}

                <div className="modal-action mt-0">
                    <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button type="submit" disabled={shorten.isPending} className="btn btn-primary">
                        {shorten.isPending && <span className="loading loading-spinner loading-sm" />}
                        Shorten and copy
                    </button>
                </div>
            </form>
            <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" />
        </dialog>
    );
}
