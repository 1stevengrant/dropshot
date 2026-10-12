import type { Activity, Board, Drop, DropPage, DropQuery, DropUpdate } from '../../shared/types';

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
    trashCount: () => request<{ count: number }>('/trash'),
    restore: (ids: string[]) => request<void>('/trash/restore', { method: 'POST', body: JSON.stringify({ ids }) }),
    purge: (ids: string[]) => request<void>('/trash/purge', { method: 'POST', body: JSON.stringify({ ids }) }),
    emptyTrash: () => request<{ purged: number }>('/trash/empty', { method: 'POST' }),
    tags: () => request<{ tag: string; count: number }[]>('/tags'),
    boards: () => request<Board[]>('/boards'),
    createBoard: (name: string) => request<Board>('/boards', { method: 'POST', body: JSON.stringify({ name }) }),
    deleteBoard: (id: number) => request<void>(`/boards/${id}`, { method: 'DELETE' }),
    addToBoard: (boardId: number, ids: string[]) => request<void>(`/boards/${boardId}/drops`, { method: 'POST', body: JSON.stringify({ ids }) }),
    removeFromBoard: (boardId: number, dropId: string) => request<void>(`/boards/${boardId}/drops/${dropId}`, { method: 'DELETE' }),
    upload: (file: Blob, filename = (file as File).name, title?: string) =>
        request<Drop>('/upload', {
            method: 'POST',
            body: file,
            headers: {
                'X-Filename': encodeURIComponent(filename),
                'Content-Type': file.type || 'application/octet-stream',
                ...(title ? { 'X-Title': encodeURIComponent(title) } : {}),
            },
        }),
    startUpload: (filename: string, contentType: string) =>
        request<{ id: string; filename: string; uploadId: string }>('/uploads', { method: 'POST', body: JSON.stringify({ filename, contentType }) }),
    completeUpload: (id: string, upload: { uploadId: string; filename: string; title?: string; parts: { partNumber: number; etag: string }[] }) =>
        request<Drop>(`/uploads/${id}/complete`, { method: 'POST', body: JSON.stringify(upload) }),
    abortUpload: (id: string, uploadId: string, filename: string) =>
        request<void>(`/uploads/${id}?${new URLSearchParams({ uploadId, filename })}`, { method: 'DELETE' }),
    shorten: (url: string, title?: string) => request<Drop>('/links', { method: 'POST', body: JSON.stringify({ url, title }) }),
    screenshot: (url: string, title?: string) => request<Drop>('/screenshots', { method: 'POST', body: JSON.stringify({ url, title }) }),
    replaceFile: (id: string, file: Blob, filename: string) =>
        request<Drop>(`/drops/${id}/file`, {
            method: 'PUT',
            body: file,
            headers: { 'X-Filename': encodeURIComponent(filename), 'Content-Type': file.type || 'application/octet-stream' },
        }),
    activity: (id: string) => request<Activity[]>(`/drops/${id}/activity`),
};

/** Owner preview URL: works for private and password-protected drops too. */
export const previewUrl = (drop: Pick<Drop, 'id'>) => `/api/drops/${drop.id}/file`;
