import type { ReactNode } from 'react';

export function MenuItem({ onSelect, children, danger, checked }: { onSelect: () => void; children: ReactNode; danger?: boolean; checked?: boolean }) {
    return (
        <li>
            <button type="button" role="menuitem" onClick={onSelect} className={danger ? 'text-error' : ''}>
                {checked !== undefined && <span className="w-4 text-primary">{checked ? '✓' : ''}</span>}
                {children}
            </button>
        </li>
    );
}
