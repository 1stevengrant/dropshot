import type { Drop, DropKind, DropPage, DropQuery, DropUpdate } from '../shared/types';
import { automaticTags, normalizeTag, titleFor } from './kinds';
import { hashPassword } from './password';
import { thumbnailKey } from './thumbnails/thumbnailKey';
import type { DropRow, Env } from './types';

export type { DropRow, Env } from './types';

/** Drop records: listing, lookup, updates, deletion and file replacement. */
export class Drops {
    constructor(private readonly env: Env, private readonly origin: string) {}

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
    async list(query: DropQuery, perPage = 48): Promise<DropPage> {
        const where = query.trash ? ['d.deleted_at IS NOT NULL'] : ['d.deleted_at IS NULL', '(d.expires_at IS NULL OR d.expires_at > ?)'];
        const bindings: unknown[] = query.trash ? [] : [Date.now()];

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

        const column = query.trash && (query.sort ?? 'created') === 'created'
            ? 'd.deleted_at'
            : { created: 'd.created_at', size: 'd.size', views: 'd.views', title: 'd.title COLLATE NOCASE' }[query.sort ?? 'created'];
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

        if (update.cta !== undefined) {
            const url = update.cta?.url?.trim() ?? '';
            const valid = /^https?:\/\//i.test(url);
            sets.push('cta_label = ?', 'cta_url = ?');
            bindings.push(valid ? update.cta!.label.trim().slice(0, 60) || 'Learn more' : null, valid ? url.slice(0, 2000) : null);
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

    /** Moves drops to the trash: their links stop working at once, but files and metadata stay for 30 days. */
    async trash(ids: string[]): Promise<void> {
        if (!ids.length) {
            return;
        }

        const placeholders = ids.map(() => '?').join(', ');

        await this.env.DB.prepare(`UPDATE drops SET deleted_at = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`).bind(Date.now(), ...ids).run();
    }

    /** Brings drops back from the trash. A self-destructed drop comes back without its expiry, or it would vanish again. */
    async restore(ids: string[]): Promise<void> {
        if (!ids.length) {
            return;
        }

        const placeholders = ids.map(() => '?').join(', ');

        await this.env.DB.prepare(
            `UPDATE drops SET deleted_at = NULL, expires_at = CASE WHEN expires_at <= ? THEN NULL ELSE expires_at END WHERE id IN (${placeholders})`,
        ).bind(Date.now(), ...ids).run();
    }

    async trashCount(): Promise<number> {
        const row = await this.env.DB.prepare('SELECT COUNT(*) AS count FROM drops WHERE deleted_at IS NOT NULL').first<{ count: number }>();

        return row?.count ?? 0;
    }

    /** Permanently removes drops and their files. Only the trash and its 30 day clean-up call this. */
    async purge(ids: string[]): Promise<void> {
        if (!ids.length) {
            return;
        }

        const placeholders = ids.map(() => '?').join(', ');
        const rows = await this.env.DB.prepare(`SELECT object_key FROM drops WHERE id IN (${placeholders})`).bind(...ids).all<{ object_key: string }>();

        await this.env.BUCKET.delete([...rows.results.map((row) => row.object_key), ...ids.map((id) => thumbnailKey(this.env, id))]);
        await this.env.DB.batch([
            this.env.DB.prepare(`DELETE FROM drop_tags WHERE drop_id IN (${placeholders})`).bind(...ids),
            this.env.DB.prepare(`DELETE FROM board_drops WHERE drop_id IN (${placeholders})`).bind(...ids),
            this.env.DB.prepare(`DELETE FROM drop_views WHERE drop_id IN (${placeholders})`).bind(...ids),
            this.env.DB.prepare(`DELETE FROM drops WHERE id IN (${placeholders})`).bind(...ids),
        ]);
    }

    /** Self-destructed drops go to the trash like deleted ones; their links already stopped at the expiry time. */
    async trashExpired(): Promise<number> {
        const result = await this.env.DB.prepare('UPDATE drops SET deleted_at = ? WHERE expires_at IS NOT NULL AND expires_at <= ? AND deleted_at IS NULL')
            .bind(Date.now(), Date.now())
            .run();

        return result.meta.changes ?? 0;
    }

    async purgeTrash(maxAgeMs = 30 * 24 * 3_600_000): Promise<number> {
        const old = await this.env.DB.prepare('SELECT id FROM drops WHERE deleted_at IS NOT NULL AND deleted_at <= ?').bind(Date.now() - maxAgeMs).all<{ id: string }>();

        return this.purgeAll(old.results.map((row) => row.id));
    }

    async emptyTrash(): Promise<number> {
        const all = await this.env.DB.prepare('SELECT id FROM drops WHERE deleted_at IS NOT NULL').all<{ id: string }>();

        return this.purgeAll(all.results.map((row) => row.id));
    }

    private async purgeAll(ids: string[]): Promise<number> {
        for (let start = 0; start < ids.length; start += 50) {
            await this.purge(ids.slice(start, start + 50));
        }

        return ids.length;
    }

    async replaceFile(row: DropRow, filename: string, contentType: string, body: ReadableStream): Promise<void> {
        const prefix = this.env.KEY_PREFIX ? `${this.env.KEY_PREFIX.replace(/\/+$/, '')}/` : '';
        const key = `${prefix}${row.id}/${filename}`;
        const object = await this.env.BUCKET.put(key, body, { httpMetadata: { contentType } });

        if (key !== row.object_key) {
            await this.env.BUCKET.delete(row.object_key);
        }

        // The editor sends a fresh thumbnail after saving; until then the old one would show the unedited image.
        await this.env.BUCKET.delete(thumbnailKey(this.env, row.id));

        await this.env.DB.prepare('UPDATE drops SET object_key = ?, filename = ?, content_type = ?, size = ? WHERE id = ?')
            .bind(key, filename, contentType, object.size, row.id)
            .run();
    }

    pageUrl(id: string): string {
        return `${this.origin}/${id}`;
    }

    /** Droplr style raw link; /<id>/<filename> keeps working too. */
    directUrl(row: Pick<DropRow, 'id'>): string {
        return `${this.origin}/${row.id}+`;
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
            cta: row.cta_label && row.cta_url ? { label: row.cta_label, url: row.cta_url } : null,
            deletedAt: row.deleted_at,
        }));
    }
}
