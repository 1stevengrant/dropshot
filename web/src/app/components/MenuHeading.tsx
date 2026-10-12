import type { ReactNode } from 'react';

export function MenuHeading({ children }: { children: ReactNode }) {
    return <li className="menu-title text-xs tracking-wide uppercase">{children}</li>;
}
