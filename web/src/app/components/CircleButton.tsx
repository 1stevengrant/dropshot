import type { ReactNode } from 'react';

export function CircleButton({ title, onClick, active, children }: { title: string; onClick: () => void; active?: boolean; children: ReactNode }) {
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
