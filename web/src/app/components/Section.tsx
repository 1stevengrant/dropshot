import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="border-b border-line px-6 py-5">
            <h2 className="mb-4 font-semibold">{title}</h2>
            {children}
        </section>
    );
}
