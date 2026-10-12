import type { DropKind, Privacy } from '../shared/types';

export interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    BROWSER: Fetcher;
    ASSETS: Fetcher;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    KEY_PREFIX: string;
    DEV_OWNER?: string;
    OWNER_COOKIE_SECRET?: string;
}

export interface DropRow {
    id: string;
    object_key: string;
    filename: string;
    title: string;
    kind: DropKind;
    content_type: string;
    size: number;
    created_at: number;
    privacy: Privacy;
    password_hash: string | null;
    expires_at: number | null;
    allow_download: number;
    views: number;
    target_url: string | null;
    cta_label: string | null;
    cta_url: string | null;
    deleted_at: number | null;
}

export interface Visit {
    kind: 'view' | 'download';
    country: string | null;
    city: string | null;
    referrer: string | null;
    browser: string | null;
}
