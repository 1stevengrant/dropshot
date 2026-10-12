import type { Board, Drop, DropPage, DropQuery, DropUpdate } from '../shared/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api${path}`, {
        ...init,
        headers: init?.body && !(init.body instanceof Blob) ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${response.status})`);
    }

    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
    drops(query: DropQuery): Promise<DropPage> {
        const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]));

        return request(`/drops?${params}`);
    },
    drop: (id: string) => request<Drop>(`/drops/${id}`),
    update: (id: string, update: DropUpdate) => request<Drop>(`/drops/${id}`, { method: 'PATCH', body: JSON.stringify(update) }),
    remove: (ids: string[]) => request<void>('/drops/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
    tags: () => request<{ tag: string; count: number }[]>('/tags'),
    boards: () => request<Board[]>('/boards'),
    createBoard: (name: string) => request<Board>('/boards', { method: 'POST', body: JSON.stringify({ name }) }),
    deleteBoard: (id: number) => request<void>(`/boards/${id}`, { method: 'DELETE' }),
    addToBoard: (boardId: number, ids: string[]) => request<void>(`/boards/${boardId}/drops`, { method: 'POST', body: JSON.stringify({ ids }) }),
    removeFromBoard: (boardId: number, dropId: string) => request<void>(`/boards/${boardId}/drops/${dropId}`, { method: 'DELETE' }),
    upload: (file: File) =>
        request<Drop>('/upload', {
            method: 'POST',
            body: file,
            headers: { 'X-Filename': encodeURIComponent(file.name), 'Content-Type': file.type || 'application/octet-stream' },
        }),
};

/** Owner preview URL: works for private and password-protected drops too. */
export const previewUrl = (drop: Pick<Drop, 'id'>) => `/api/drops/${drop.id}/file`;
