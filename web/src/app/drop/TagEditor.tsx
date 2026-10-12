import { Tag, X } from 'lucide-react';
import { useState } from 'react';
import type { Drop, DropUpdate } from '../../shared/types';

export function TagEditor({ drop, onChange }: { drop: Drop; onChange: (changes: DropUpdate) => void }) {
    const [tagInput, setTagInput] = useState('');

    function addTag() {
        const tag = tagInput.trim();

        if (tag) {
            onChange({ tags: [...drop.tags, tag] });
        }

        setTagInput('');
    }

    return (
        <>
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
        </>
    );
}
