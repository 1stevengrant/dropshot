import type { Board } from '../shared/types';
import type { Env } from './types';

/** Named collections of drops. */
export class Boards {
    constructor(private readonly env: Env) {}

    async list(): Promise<Board[]> {
        const rows = await this.env.DB.prepare(
            'SELECT b.id, b.name, COUNT(d.id) AS count FROM boards b LEFT JOIN board_drops bd ON bd.board_id = b.id LEFT JOIN drops d ON d.id = bd.drop_id AND d.deleted_at IS NULL GROUP BY b.id ORDER BY b.name COLLATE NOCASE',
        ).all<Board>();

        return rows.results;
    }

    async create(name: string): Promise<Board> {
        const trimmed = name.trim().slice(0, 80);
        const row = await this.env.DB.prepare('INSERT INTO boards (name, created_at) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET name = excluded.name RETURNING id, name')
            .bind(trimmed, Date.now())
            .first<Board>();

        return row!;
    }

    async delete(id: number): Promise<void> {
        await this.env.DB.batch([
            this.env.DB.prepare('DELETE FROM board_drops WHERE board_id = ?').bind(id),
            this.env.DB.prepare('DELETE FROM boards WHERE id = ?').bind(id),
        ]);
    }

    async addDrops(boardId: number, dropIds: string[]): Promise<void> {
        await this.env.DB.batch(dropIds.map((dropId) => this.env.DB.prepare('INSERT OR IGNORE INTO board_drops (board_id, drop_id) VALUES (?, ?)').bind(boardId, dropId)));
    }

    async removeDrop(boardId: number, dropId: string): Promise<void> {
        await this.env.DB.prepare('DELETE FROM board_drops WHERE board_id = ? AND drop_id = ?').bind(boardId, dropId).run();
    }
}
