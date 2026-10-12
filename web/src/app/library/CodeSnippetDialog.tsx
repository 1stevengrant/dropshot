import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { codeLanguages } from '../../shared/codeLanguages';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast/useToast';
import { api } from '../lib/api';
import { copy } from '../lib/format';

interface CodeSnippetDialogProps {
    onClose: () => void;
}

const lastLanguageKey = 'dropshot:snippet-language';

function rememberedLanguage(): string {
    try {
        return localStorage.getItem(lastLanguageKey) ?? 'javascript';
    } catch {
        return 'javascript';
    }
}

/** Droplr's "Code Snippet": paste code, pick its language, and share it as a highlighted drop. */
export function CodeSnippetDialog({ onClose }: CodeSnippetDialogProps) {
    const [title, setTitle] = useState('');
    const [language, setLanguage] = useState(rememberedLanguage);
    const [code, setCode] = useState('');
    const queryClient = useQueryClient();
    const toast = useToast();

    const create = useMutation({
        mutationFn: () => {
            const chosen = codeLanguages.find((candidate) => candidate.id === language) ?? codeLanguages[0];
            const name = title.trim() || `${chosen.label} snippet`;
            const filename = `${name.replace(/[/\\:]/g, '-')}.${chosen.extensions[0]}`;

            return api.upload(new Blob([code], { type: 'text/plain' }), filename, name);
        },
        onSuccess: async (drop) => {
            try {
                localStorage.setItem(lastLanguageKey, language);
            } catch {
                // Remembering the language is only a convenience.
            }

            await copy(drop.pageUrl).catch(() => {});
            queryClient.invalidateQueries();
            toast('Snippet created. Link copied.');
            onClose();
        },
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        create.mutate();
    }

    return (
        <Modal labelledBy="code-snippet-title" onClose={onClose}>
            <form onSubmit={submit} className="modal-box flex max-w-3xl flex-col gap-4">
                <h2 id="code-snippet-title" className="text-lg font-semibold">New code snippet</h2>

                <div className="flex flex-col gap-3 sm:flex-row">
                    <label className="floating-label flex-1">
                        <span>Title (optional)</span>
                        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" className="input w-full" />
                    </label>
                    <select value={language} onChange={(event) => setLanguage(event.target.value)} aria-label="Language" className="select sm:w-48">
                        {codeLanguages.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.label}</option>)}
                    </select>
                </div>

                <textarea
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                            event.currentTarget.form?.requestSubmit();
                        }
                    }}
                    spellCheck={false}
                    rows={14}
                    placeholder="Paste or type your code"
                    className="textarea w-full font-mono text-sm leading-relaxed"
                />

                {create.isError && <div role="alert" className="alert alert-error alert-soft text-sm">{create.error.message}</div>}

                <div className="modal-action mt-0">
                    <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button type="submit" disabled={create.isPending || !code.trim()} className="btn btn-primary">
                        {create.isPending && <span className="loading loading-spinner loading-sm" />}
                        Create and copy link
                    </button>
                </div>
            </form>
        </Modal>
    );
}
