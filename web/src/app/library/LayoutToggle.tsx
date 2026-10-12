import { LayoutGrid, List } from 'lucide-react';

export function LayoutToggle({ view, onChange }: { view: 'grid' | 'list'; onChange: (view: 'grid' | 'list') => void }) {
    return (
        <div className="join" role="group" aria-label="Layout">
            {(['grid', 'list'] as const).map((mode) => (
                <button
                    key={mode}
                    type="button"
                    aria-pressed={view === mode}
                    onClick={() => onChange(mode)}
                    className={`join-item btn btn-sm ${view === mode ? 'btn-active btn-primary' : ''}`}
                    title={mode === 'grid' ? 'Grid' : 'List'}
                >
                    {mode === 'grid' ? <LayoutGrid size={16} /> : <List size={16} />}
                </button>
            ))}
        </div>
    );
}
