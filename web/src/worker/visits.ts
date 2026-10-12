import type { Activity } from '../shared/types';
import type { Env, Visit } from './types';

/** The per-visit log behind a drop's view count and Activities tab. */
export class Visits {
    constructor(private readonly env: Env) {}

    async record(id: string, visit: Visit): Promise<void> {
        const statements = [
            this.env.DB.prepare('INSERT INTO drop_views (drop_id, viewed_at, country, city, referrer, browser, kind) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .bind(id, Date.now(), visit.country, visit.city, visit.referrer, visit.browser, visit.kind),
        ];

        if (visit.kind === 'view') {
            statements.push(this.env.DB.prepare('UPDATE drops SET views = views + 1 WHERE id = ?').bind(id));
        }

        await this.env.DB.batch(statements);
    }

    async forDrop(id: string): Promise<Activity[]> {
        const rows = await this.env.DB.prepare(
            'SELECT id, kind, viewed_at, country, city, referrer, browser FROM drop_views WHERE drop_id = ? ORDER BY viewed_at DESC LIMIT 200',
        ).bind(id).all<{ id: number; kind: 'view' | 'download'; viewed_at: number; country: string | null; city: string | null; referrer: string | null; browser: string | null }>();

        return rows.results.map((row) => ({ id: row.id, kind: row.kind, viewedAt: row.viewed_at, country: row.country, city: row.city, referrer: row.referrer, browser: row.browser }));
    }

}
