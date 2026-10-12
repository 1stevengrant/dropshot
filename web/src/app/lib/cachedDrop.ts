import type { QueryClient } from '@tanstack/react-query';
import type { Drop, DropPage } from '../../shared/types';

/** A drop the library has already loaded, so opening it can render straight away while it refreshes. */
export function cachedDrop(queryClient: QueryClient, id: string): Drop | undefined {
    for (const [, page] of queryClient.getQueriesData<DropPage>({ queryKey: ['drops'] })) {
        const drop = page?.drops.find((candidate) => candidate.id === id);

        if (drop) {
            return drop;
        }
    }

    return undefined;
}
