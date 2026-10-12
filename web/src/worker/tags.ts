import type { Env } from './types';

/** Tag counts across drops that haven't expired. */
export class Tags {
    constructor(private readonly env: Env) {}

    async counts(): Promise<{ tag: string; count: number }[]> {
        const rows = await this.env.DB.prepare(
            'SELECT t.tag, COUNT(*) AS count FROM drop_tags t JOIN drops d ON d.id = t.drop_id WHERE d.expires_at IS NULL OR d.expires_at > ? GROUP BY t.tag ORDER BY t.tag',
        ).bind(Date.now()).all<{ tag: string; count: number }>();

        return rows.results;
    }
}
