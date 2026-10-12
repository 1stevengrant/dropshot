import { useState } from 'react';
import { useToast } from '../components/Toast/useToast';
import { api } from '../lib/api';
import { copy } from '../lib/format';

export interface PendingCapture {
    id: number;
    host: string;
}

let nextId = 1;

/** Web page captures take a while, so they run in the background while the library stays usable. */
export function useCaptures(onCaptured: () => void) {
    const [pending, setPending] = useState<PendingCapture[]>([]);
    const toast = useToast();

    async function capture(url: string, title?: string) {
        const entry = { id: nextId++, host: hostOf(url) };

        setPending((current) => [...current, entry]);

        try {
            const drop = await api.screenshot(url, title);
            const copied = await copy(drop.pageUrl).then(() => true, () => false);

            toast(copied ? `Captured ${entry.host}. Link copied.` : `Captured ${entry.host}`);
            onCaptured();
        } catch (error) {
            toast(error instanceof Error ? error.message : `Couldn't capture ${entry.host}`);
        } finally {
            setPending((current) => current.filter((item) => item.id !== entry.id));
        }
    }

    return { pending, capture };
}

function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}
