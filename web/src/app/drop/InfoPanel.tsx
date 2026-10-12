import { useState } from 'react';
import type { Drop, DropUpdate } from '../../shared/types';
import { ActivityList } from './ActivityList';
import { CtaSection } from './CtaSection';
import { DropActions } from './DropActions';
import { FileDetails } from './FileDetails';
import { FileOptions } from './FileOptions';
import { StatsSection } from './StatsSection';

/** Drafts live here rather than in the sections so they survive switching between the two tabs. */
export function InfoPanel({ drop, onChange, onDelete }: { drop: Drop; onChange: (changes: DropUpdate) => void; onDelete: () => void }) {
    const [title, setTitle] = useState(drop.title);
    const [password, setPassword] = useState<string | null>(null);
    const [customExpiry, setCustomExpiry] = useState<string | null>(null);
    const [tab, setTab] = useState<'activity' | 'info'>('info');
    const [ctaDraft, setCtaDraft] = useState<{ label: string; url: string } | null>(null);

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
                    <DropActions
                        drop={drop}
                        title={title}
                        onTitleChange={setTitle}
                        password={password}
                        onPasswordChange={setPassword}
                        customExpiry={customExpiry}
                        onCustomExpiryChange={setCustomExpiry}
                        onChange={onChange}
                        onDelete={onDelete}
                    />
                    <FileOptions drop={drop} onChange={onChange} />
                    <CtaSection drop={drop} draft={ctaDraft} onDraftChange={setCtaDraft} onChange={onChange} />
                    <FileDetails drop={drop} onChange={onChange} />
                    <StatsSection drop={drop} />
                </>
            )}
        </aside>
    );
}
