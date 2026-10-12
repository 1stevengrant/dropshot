import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { Drop, DropUpdate } from '../../shared/types';
import { useToast } from '../components/Toast/useToast';
import { api, previewUrl } from '../lib/api';
import { copy } from '../lib/format';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { MarkupEditor } from '../markup/MarkupEditor';
import { DropHeader } from './DropHeader';
import { DropPreview } from './DropPreview';
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
        setConfirmingDelete(true);
    }

    return (
        <div className="flex h-screen flex-col">
            <DropHeader drop={drop} onMarkup={() => setMarking(true)} onDelete={confirmDelete} />

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
                    <DropPreview drop={drop} version={version} />
                </main>
                <InfoPanel drop={drop} onChange={(changes) => update.mutate(changes)} onDelete={confirmDelete} />
            </div>

            {confirmingDelete && (
                <ConfirmDialog
                    title={`Delete “${drop.title}”?`}
                    message="The file is removed for good and the link stops working."
                    onConfirm={() => remove.mutateAsync()}
                    onCancel={() => setConfirmingDelete(false)}
                />
            )}

            {marking && <MarkupEditor src={`${previewUrl(drop)}?v=${version}`} title={drop.title} onCancel={() => setMarking(false)} onSave={saveMarkup} />}
        </div>
    );
}
