const key = 'dropshot:library-location';

/** Remembers the library view (tag, type, board, sort, page, search) so leaving a drop returns to it. */
export function rememberLibraryLocation(search: string, query: string): void {
    const params = new URLSearchParams(search);

    if (query) {
        params.set('q', query);
    }

    const suffix = params.toString();

    try {
        sessionStorage.setItem(key, suffix ? `/app/?${suffix}` : '/app/');
    } catch {
        // Private browsing can block storage; the library root is a fine fallback.
    }
}

export function libraryLocation(): string {
    try {
        return sessionStorage.getItem(key) ?? '/app/';
    } catch {
        return '/app/';
    }
}
