import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Drop, DropUpdate } from '../../shared/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToast } from '../components/Toast/useToast';
import { api, cachedFileUrl } from '../lib/api';
import { copy } from '../lib/format';
import { libraryLocation } from '../lib/libraryLocation';
import { uploadThumbnail } from '../lib/uploadThumbnail';
import { MarkupEditor } from '../markup/MarkupEditor';
import { DropHeader } from './DropHeader';
import { DropPreview } from './DropPreview';
import { TrashBanner } from './TrashBanner';
import { InfoPanel } from './InfoPanel';

export function DropView({ drop }: { drop: Drop }) {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const toast = useToast();
    const [marking, setMarking] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [version, setVersion] = useState(0);

    async function saveMarkup(image: Blob, mode: 'copy' | 'replace') {
        const filename = `${drop.title.replace(/[/\\]/g, '-')}${mode === 'copy' ? ' (markup)' : ''}.png`;

        if (mode === 'replace') {
            const updated = await api.replaceFile(drop.id, image, filename);
            await uploadThumbnail(updated, image);
            queryClient.setQueryData(['drop', drop.id], updated);
            queryClient.invalidateQueries({ queryKey: ['drops'] });
            setVersion((value) => value + 1);
            setMarking(false);
            toast('Markup saved over the original');

            return;
        }

        const created = await api.upload(image, filename, `${drop.title} (markup)`);
        await uploadThumbnail(created, image);
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

    const trashed = drop.deletedAt !== null;

    const remove = useMutation({
        mutationFn: () => (trashed ? api.purge([drop.id]) : api.remove([drop.id])),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast(trashed ? 'Drop deleted forever' : 'Moved to the trash');
            navigate(libraryLocation());
        },
    });

    const restore = useMutation({
        mutationFn: () => api.restore([drop.id]),
        onSuccess: () => {
            queryClient.invalidateQueries();
            toast('Drop restored. Its link works again.');
        },
    });

    function confirmDelete() {
        setConfirmingDelete(true);
    }

    return (
        <div className="flex h-screen flex-col">
            <DropHeader drop={drop} onMarkup={() => setMarking(true)} onDelete={confirmDelete} />
            {trashed && <TrashBanner drop={drop} onRestore={() => restore.mutate()} onPurge={confirmDelete} />}

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <main className="flex min-h-0 flex-1 items-center-safe justify-center-safe overflow-auto p-6">
                    <DropPreview drop={drop} version={version} />
                </main>
                <InfoPanel drop={drop} onChange={(changes) => update.mutate(changes)} onDelete={confirmDelete} />
            </div>

            {confirmingDelete && (
                <ConfirmDialog
                    title={trashed ? `Delete “${drop.title}” forever?` : `Move “${drop.title}” to the trash?`}
                    message={trashed ? 'The file is removed for good. This can’t be undone.' : 'Its link stops working now. You can restore it from Trash for 30 days.'}
                    confirmLabel={trashed ? 'Delete forever' : 'Move to trash'}
                    tone={trashed ? 'danger' : 'warning'}
                    onConfirm={() => remove.mutateAsync()}
                    onCancel={() => setConfirmingDelete(false)}
                />
            )}

            {marking && <MarkupEditor src={`${cachedFileUrl(drop)}&edit=${version}`} title={drop.title} onCancel={() => setMarking(false)} onSave={saveMarkup} />}
        </div>
    );
}
