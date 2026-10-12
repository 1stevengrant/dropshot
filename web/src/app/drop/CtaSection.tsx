import { X } from 'lucide-react';
import type { Drop, DropUpdate } from '../../shared/types';

interface CtaSectionProps {
    drop: Drop;
    draft: { label: string; url: string } | null;
    onDraftChange: (draft: { label: string; url: string } | null) => void;
    onChange: (changes: DropUpdate) => void;
}

export function CtaSection({ drop, draft, onDraftChange, onChange }: CtaSectionProps) {
    return (
        <section className="border-b border-line px-6 py-5">
            <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">CTAs</h2>
                {!drop.cta && draft === null && (
                    <button type="button" onClick={() => onDraftChange({ label: '', url: '' })} className="text-sm text-accent hover:underline">Add CTA</button>
                )}
            </div>
            {draft !== null ? (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        onChange({ cta: draft });
                        onDraftChange(null);
                    }}
                    className="flex flex-col gap-2"
                >
                    <input value={draft.label} onChange={(event) => onDraftChange({ ...draft, label: event.target.value })} placeholder="Button label, e.g. Book a call" className="input input-sm w-full" />
                    <input type="url" required value={draft.url} onChange={(event) => onDraftChange({ ...draft, url: event.target.value })} placeholder="https://" className="input input-sm w-full" />
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => onDraftChange(null)} className="btn btn-ghost btn-sm">Cancel</button>
                        <button type="submit" className="btn btn-primary btn-sm">Save</button>
                    </div>
                </form>
            ) : drop.cta ? (
                <div className="flex items-center gap-3 text-sm">
                    <span className="badge badge-outline badge-lg">{drop.cta.label}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{drop.cta.url}</span>
                    <button type="button" onClick={() => onDraftChange({ label: drop.cta!.label, url: drop.cta!.url })} className="text-accent hover:underline">Edit</button>
                    <button type="button" onClick={() => onChange({ cta: null })} title="Remove CTA" className="text-muted hover:text-danger"><X size={15} /></button>
                </div>
            ) : (
                <p className="text-center text-sm text-muted">No CTAs added. A CTA shows a button on the public drop page.</p>
            )}
        </section>
    );
}
