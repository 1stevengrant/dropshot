import type { ReactNode } from 'react';

export function SidebarItem({ active, onClick, icon, count, children }: { active: boolean; onClick: () => void; icon: ReactNode; count?: number; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`btn btn-ghost btn-sm h-auto w-full min-w-0 justify-start gap-3 px-2 py-1.5 font-normal ${active ? 'btn-active bg-accent-soft font-medium text-primary' : ''}`}
        >
            <span className="shrink-0 text-muted">{icon}</span>
            <span className="flex-1 truncate">{children}</span>
            {count !== undefined && <span className="text-xs text-muted">{count}</span>}
        </button>
    );
}
