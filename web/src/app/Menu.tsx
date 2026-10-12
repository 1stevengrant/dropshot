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
                <ul role="menu" aria-label={label} className={`menu absolute z-30 mt-2 min-w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl ${position}`}>
                    {children(() => setOpen(false))}
                </ul>
            )}
        </div>
    );
}

export function MenuDivider() {
    return <li aria-hidden="true" className="pointer-events-none my-1 h-px bg-base-300" />;
}

export function MenuHeading({ children }: { children: ReactNode }) {
    return <li className="menu-title text-xs tracking-wide uppercase">{children}</li>;
}

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
