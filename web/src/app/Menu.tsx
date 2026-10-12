import { type ReactNode, useEffect, useRef, useState } from 'react';

interface MenuProps {
    trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
    children: (close: () => void) => ReactNode;
    align?: 'left' | 'right' | 'center';
    label?: string;
}

/** A click-to-open popover that closes on outside click or Escape. */
export function Menu({ trigger, children, align = 'center', label }: MenuProps) {
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) {
            return;
        }

        function onPointerDown(event: PointerEvent) {
            if (!container.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        }

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const position = { left: 'left-0', right: 'right-0', center: 'left-1/2 -translate-x-1/2' }[align];

    return (
        <div className="relative" ref={container}>
            {trigger({ open, toggle: () => setOpen((value) => !value) })}
            {open && (
                <div role="menu" aria-label={label} className={`absolute z-30 mt-2 min-w-52 rounded-xl border border-line bg-panel py-2 shadow-xl ${position}`}>
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    );
}

export function MenuHeading({ children }: { children: ReactNode }) {
    return <div className="mx-4 mb-1 border-b border-line pb-2 text-xs font-semibold tracking-wide text-muted uppercase">{children}</div>;
}

export function MenuItem({ onSelect, children, danger, checked }: { onSelect: () => void; children: ReactNode; danger?: boolean; checked?: boolean }) {
    return (
        <button
            type="button"
            role="menuitem"
            onClick={onSelect}
            className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-canvas ${danger ? 'text-danger' : ''}`}
        >
            {checked !== undefined && <span className="w-4 text-accent">{checked ? '✓' : ''}</span>}
            {children}
        </button>
    );
}
