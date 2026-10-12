export type DropKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'link' | 'file';

export type Privacy = 'public' | 'password' | 'private';

export interface Drop {
    id: string;
    title: string;
    filename: string;
    kind: DropKind;
    contentType: string;
    size: number;
    createdAt: number;
    privacy: Privacy;
    expiresAt: number | null;
    allowDownload: boolean;
    views: number;
    targetUrl: string | null;
    tags: string[];
    boards: Board[];
    pageUrl: string;
    directUrl: string;
    cta: Cta | null;
}

export interface Cta {
    label: string;
    url: string;
}

export interface Activity {
    id: number;
    kind: 'view' | 'download';
    viewedAt: number;
    country: string | null;
    city: string | null;
    referrer: string | null;
    browser: string | null;
}

export interface Board {
    id: number;
    name: string;
    count?: number;
}

export interface DropUpdate {
    title?: string;
    privacy?: Privacy;
    password?: string;
    expiresAt?: number | null;
    allowDownload?: boolean;
    tags?: string[];
    cta?: Cta | null;
}

export interface DropQuery {
    q?: string;
    kind?: DropKind;
    tag?: string;
    board?: number;
    sort?: 'created' | 'size' | 'views' | 'title';
    dir?: 'asc' | 'desc';
    page?: number;
}

export interface DropPage {
    drops: Drop[];
    total: number;
    page: number;
    perPage: number;
}
