import type { Board, Drop, DropKind, DropPage, DropQuery, DropUpdate, Privacy } from '../shared/types';
import { automaticTags, contentTypeFor, kindFor, normalizeTag, titleFor } from './kinds';
import { hashPassword } from './password';

export interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    ASSETS: Fetcher;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD: string;
    KEY_PREFIX: string;
    DEV_OWNER?: string;
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
}

let inflightSync: Promise<number> | null = null;
let lastSyncAt = 0;

export class Drops {
    constructor(private readonly env: Env, private readonly origin: string) {}

    /**
     * The Mac app uploads straight to R2, so new objects are registered here. Keys look like `<id>/<filename>`
     * (or `<id>.<ext>` for short-ID links), under an optional prefix. Keys starting with `_` are ignored.
     */
    /**
     * Registers new uploads, at most every 30 seconds per isolate and never more than one at a time. Listing the whole
     * bucket on every request made R2 refuse concurrent lists (10058); a failed sync now only delays new drops.
     */
    async syncIfStale(maxAgeMs = 30_000): Promise<void> {
        if (inflightSync) {
            await inflightSync.catch(() => 0);

            return;
        }

        if (Date.now() - lastSyncAt < maxAgeMs) {
            return;
        }

        inflightSync = this.sync();

        try {
            await inflightSync;
            lastSyncAt = Date.now();
        } catch (error) {
            console.error('Sync failed', error);
        } finally {
            inflightSync = null;
        }
    }

    async sync(): Promise<number> {
        const known = new Set(
            (await this.env.DB.prepare('SELECT object_key FROM drops').all<{ object_key: string }>()).results.map((row) => row.object_key),
        );

        const prefix = this.env.KEY_PREFIX ? `${this.env.KEY_PREFIX.replace(/\/+$/, '')}/` : '';
        let cursor: string | undefined;
        let added = 0;

        do {
            const page = await this.env.BUCKET.list({ prefix, cursor, include: ['httpMetadata'] });
            cursor = page.truncated ? page.cursor : undefined;

            for (const object of page.objects) {
                if (known.has(object.key)) {
                    continue;
                }

                if (await this.register(object, prefix)) {
                    added++;
                }
            }
        } while (cursor);

        return added;
    }

    private async register(object: R2Object, prefix: string): Promise<boolean> {
        const relative = object.key.slice(prefix.length);

        if (!relative || relative.startsWith('_')) {
            return false;
        }

        const slash = relative.indexOf('/');
        const filename = slash === -1 ? relative : relative.slice(slash + 1);
        const id = slash === -1 ? relative.replace(/\.[^.]+$/, '') : relative.slice(0, slash);

        if (!/^[A-Za-z0-9_-]{3,40}$/.test(id) || !filename) {
            return false;
        }

        const contentType = contentTypeFor(filename, object.httpMetadata?.contentType);
        const kind = kindFor(filename, contentType);
        const targetUrl = kind === 'link' ? await this.redirectTarget(object.key) : null;

        await this.insert({
            id,
            objectKey: object.key,
            filename,
            kind,
            contentType,
            size: object.size,
            createdAt: object.uploaded.getTime(),
            targetUrl,
        });

        return true;
    }

    async insert(drop: { id: string; objectKey: string; filename: string; kind: DropKind; contentType: string; size: number; createdAt: number; targetUrl: string | null }): Promise<void> {
        const statements = [
            this.env.DB.prepare(
                `INSERT OR IGNORE INTO drops (id, object_key, filename, title, kind, content_type, size, created_at, target_url)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ).bind(drop.id, drop.objectKey, drop.filename, titleFor(drop.filename, drop.kind, drop.targetUrl), drop.kind, drop.contentType, drop.size, drop.createdAt, drop.targetUrl),
            ...automaticTags(drop.filename, drop.kind).map((tag) =>
                this.env.DB.prepare('INSERT OR IGNORE INTO drop_tags (drop_id, tag) VALUES (?, ?)').bind(drop.id, tag),
            ),
        ];

        await this.env.DB.batch(statements);
    }

    /** The Mac app stores shortened links as a tiny HTML redirect; recover the destination from it. */
    private async redirectTarget(key: string): Promise<string | null> {
        const object = await this.env.BUCKET.get(key);
        const html = object ? await object.text() : '';
        const match = html.match(/url=([^"]+)"/i);

        return match ? match[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<') : null;
    }

    async list(query: DropQuery, perPage = 48): Promise<DropPage> {
        const where = ['(d.expires_at IS NULL OR d.expires_at > ?)'];
        const bindings: unknown[] = [Date.now()];

        if (query.q) {
            where.push('(d.title LIKE ? OR d.filename LIKE ? OR d.target_url LIKE ? OR EXISTS (SELECT 1 FROM drop_tags t WHERE t.drop_id = d.id AND t.tag LIKE ?))');
            const like = `%${query.q}%`;
            bindings.push(like, like, like, like);
        }

        if (query.kind) {
            where.push('d.kind = ?');
            bindings.push(query.kind);
        }

        if (query.tag) {
            where.push('EXISTS (SELECT 1 FROM drop_tags t WHERE t.drop_id = d.id AND t.tag = ?)');
            bindings.push(query.tag);
        }

        if (query.board) {
            where.push('EXISTS (SELECT 1 FROM board_drops b WHERE b.drop_id = d.id AND b.board_id = ?)');
            bindings.push(query.board);
        }

        const column = { created: 'd.created_at', size: 'd.size', views: 'd.views', title: 'd.title COLLATE NOCASE' }[query.sort ?? 'created'];
        const direction = query.dir === 'asc' ? 'ASC' : 'DESC';

        const page = Math.max(1, Math.floor(query.page ?? 1));
        const whereSql = where.join(' AND ');

        const [rows, count] = await this.env.DB.batch<DropRow & { total?: number }>([
            this.env.DB.prepare(`SELECT d.* FROM drops d WHERE ${whereSql} ORDER BY ${column} ${direction}, d.id LIMIT ? OFFSET ?`).bind(...bindings, perPage, (page - 1) * perPage),
            this.env.DB.prepare(`SELECT COUNT(*) AS total FROM drops d WHERE ${whereSql}`).bind(...bindings),
        ]);

        return { drops: await this.hydrate(rows.results), total: count.results[0]?.total ?? 0, page, perPage };
    }

    async find(id: string): Promise<DropRow | null> {
        return this.env.DB.prepare('SELECT * FROM drops WHERE id = ?').bind(id).first<DropRow>();
    }

    async get(id: string): Promise<Drop | null> {
        const row = await this.find(id);

        return row ? (await this.hydrate([row]))[0] : null;
    }

    async update(id: string, update: DropUpdate): Promise<void> {
        const sets: string[] = [];
        const bindings: unknown[] = [];

        if (update.title !== undefined) {
            sets.push('title = ?');
            bindings.push(update.title.trim().slice(0, 200) || 'Untitled');
        }

        if (update.privacy !== undefined) {
            sets.push('privacy = ?');
            bindings.push(update.privacy);
        }

        if (update.password) {
            sets.push('password_hash = ?');
            bindings.push(await hashPassword(update.password));
        }

        if (update.privacy !== undefined && update.privacy !== 'password') {
            sets.push('password_hash = NULL');
        }

        if (update.expiresAt !== undefined) {
            sets.push('expires_at = ?');
            bindings.push(update.expiresAt);
        }

        if (update.allowDownload !== undefined) {
            sets.push('allow_download = ?');
            bindings.push(update.allowDownload ? 1 : 0);
        }

        const statements: D1PreparedStatement[] = [];

        if (sets.length) {
            statements.push(this.env.DB.prepare(`UPDATE drops SET ${sets.join(', ')} WHERE id = ?`).bind(...bindings, id));
        }

        if (update.tags !== undefined) {
            const tags = [...new Set(update.tags.map(normalizeTag).filter(Boolean))];
            statements.push(this.env.DB.prepare('DELETE FROM drop_tags WHERE drop_id = ?').bind(id));
            statements.push(...tags.map((tag) => this.env.DB.prepare('INSERT INTO drop_tags (drop_id, tag) VALUES (?, ?)').bind(id, tag)));
        }

        if (statements.length) {
            await this.env.DB.batch(statements);
        }
    }

    async delete(ids: string[]): Promise<void> {
        if (!ids.length) {
            return;
        }

        const placeholders = ids.map(() => '?').join(', ');
        const rows = await this.env.DB.prepare(`SELECT object_key FROM drops WHERE id IN (${placeholders})`).bind(...ids).all<{ object_key: string }>();

        await this.env.BUCKET.delete(rows.results.map((row) => row.object_key));
        await this.env.DB.batch([
            this.env.DB.prepare(`DELETE FROM drop_tags WHERE drop_id IN (${placeholders})`).bind(...ids),
            this.env.DB.prepare(`DELETE FROM board_drops WHERE drop_id IN (${placeholders})`).bind(...ids),
            this.env.DB.prepare(`DELETE FROM drops WHERE id IN (${placeholders})`).bind(...ids),
        ]);
    }

    async purgeExpired(): Promise<number> {
        const expired = await this.env.DB.prepare('SELECT id FROM drops WHERE expires_at IS NOT NULL AND expires_at <= ?').bind(Date.now()).all<{ id: string }>();
        const ids = expired.results.map((row) => row.id);

        for (let start = 0; start < ids.length; start += 50) {
            await this.delete(ids.slice(start, start + 50));
        }

        return ids.length;
    }

    async recordView(id: string): Promise<void> {
        await this.env.DB.prepare('UPDATE drops SET views = views + 1 WHERE id = ?').bind(id).run();
    }

    async tags(): Promise<{ tag: string; count: number }[]> {
        const rows = await this.env.DB.prepare(
            'SELECT t.tag, COUNT(*) AS count FROM drop_tags t JOIN drops d ON d.id = t.drop_id WHERE d.expires_at IS NULL OR d.expires_at > ? GROUP BY t.tag ORDER BY t.tag',
        ).bind(Date.now()).all<{ tag: string; count: number }>();

        return rows.results;
    }

    async boards(): Promise<Board[]> {
        const rows = await this.env.DB.prepare(
            'SELECT b.id, b.name, COUNT(bd.drop_id) AS count FROM boards b LEFT JOIN board_drops bd ON bd.board_id = b.id GROUP BY b.id ORDER BY b.name COLLATE NOCASE',
        ).all<Board>();

        return rows.results;
    }

    async createBoard(name: string): Promise<Board> {
        const trimmed = name.trim().slice(0, 80);
        const row = await this.env.DB.prepare('INSERT INTO boards (name, created_at) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id, name')
            .bind(trimmed, Date.now())
            .first<Board>();

        return row!;
    }

    async deleteBoard(id: number): Promise<void> {
        await this.env.DB.batch([
            this.env.DB.prepare('DELETE FROM board_drops WHERE board_id = ?').bind(id),
            this.env.DB.prepare('DELETE FROM boards WHERE id = ?').bind(id),
        ]);
    }

    async addToBoard(boardId: number, dropIds: string[]): Promise<void> {
        await this.env.DB.batch(dropIds.map((dropId) => this.env.DB.prepare('INSERT OR IGNORE INTO board_drops (board_id, drop_id) VALUES (?, ?)').bind(boardId, dropId)));
    }

    async removeFromBoard(boardId: number, dropId: string): Promise<void> {
        await this.env.DB.prepare('DELETE FROM board_drops WHERE board_id = ? AND drop_id = ?').bind(boardId, dropId).run();
    }

    pageUrl(id: string): string {
        return `${this.origin}/${id}`;
    }

    directUrl(row: Pick<DropRow, 'id' | 'filename' | 'object_key'>): string {
        return `${this.origin}/${row.id}/${encodeURIComponent(row.filename)}`;
    }

    private async hydrate(rows: DropRow[]): Promise<Drop[]> {
        if (!rows.length) {
            return [];
        }

        const ids = rows.map((row) => row.id);
        const placeholders = ids.map(() => '?').join(', ');

        const [tagRows, boardRows] = await this.env.DB.batch<{ drop_id: string; tag?: string; id?: number; name?: string }>([
            this.env.DB.prepare(`SELECT drop_id, tag FROM drop_tags WHERE drop_id IN (${placeholders}) ORDER BY tag`).bind(...ids),
            this.env.DB.prepare(`SELECT bd.drop_id, b.id, b.name FROM board_drops bd JOIN boards b ON b.id = bd.board_id WHERE bd.drop_id IN (${placeholders})`).bind(...ids),
        ]);

        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            filename: row.filename,
            kind: row.kind,
            contentType: row.content_type,
            size: row.size,
            createdAt: row.created_at,
            privacy: row.privacy,
            expiresAt: row.expires_at,
            allowDownload: row.allow_download === 1,
            views: row.views,
            targetUrl: row.target_url,
            tags: tagRows.results.filter((tag) => tag.drop_id === row.id).map((tag) => tag.tag!),
            boards: boardRows.results.filter((board) => board.drop_id === row.id).map((board) => ({ id: board.id!, name: board.name! })),
            pageUrl: this.pageUrl(row.id),
            directUrl: this.directUrl(row),
        }));
    }
}
