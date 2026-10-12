"""Execute the board count SQL against isolated SQLite lifecycle fixtures."""
from pathlib import Path
import re
import sqlite3
import unittest

ROOT = Path(__file__).resolve().parents[1]


class BoardCountTests(unittest.TestCase):
    def test_expired_and_deleted_members_are_excluded_without_hiding_empty_boards(self):
        with sqlite3.connect(':memory:') as db:
            for migration in sorted((ROOT / 'web/migrations').glob('*.sql')):
                db.executescript(migration.read_text())
            db.executemany('INSERT INTO boards VALUES (?, ?, 0)', [(1, 'Mixed'), (2, 'Expired'), (3, 'Empty')])
            for identifier, expiry, deleted in [('live', None, None), ('future', 1001, None), ('past', 999, None), ('boundary', 1000, None), ('deleted', None, 1)]:
                db.execute('INSERT INTO drops (id,object_key,filename,title,kind,content_type,created_at,expires_at,deleted_at) VALUES (?,?,?,?,?,?,0,?,?)', (identifier, identifier, identifier, identifier, 'file', 'application/octet-stream', expiry, deleted))
                db.execute('INSERT INTO board_drops VALUES (1, ?)', (identifier,))
            db.execute("INSERT INTO board_drops VALUES (2, 'past')")
            source = (ROOT / 'web/src/worker/boards.ts').read_text()
            query = re.search(r"'(SELECT b\.id[^']+)'", source).group(1)
            rows = db.execute(query, (1000,)).fetchall()
            self.assertEqual(rows, [(3, 'Empty', 0), (2, 'Expired', 0), (1, 'Mixed', 2)])


if __name__ == '__main__':
    unittest.main()
