"""Exercise the code migration against valid legacy tag combinations in memory."""
from pathlib import Path
import sqlite3
import unittest

MIGRATIONS = Path(__file__).resolve().parents[1] / 'web' / 'migrations'


class CodeKindMigrationTests(unittest.TestCase):
    def test_legacy_tag_combinations(self):
        for tags in [('note',), ('file',), ('note', 'file'), ('note', 'file', 'code')]:
            with self.subTest(tags=tags), sqlite3.connect(':memory:') as db:
                for migration in sorted(MIGRATIONS.glob('000[1-3]*.sql')):
                    db.executescript(migration.read_text())
                for identifier, filename in [('source', 'example.json'), ('plain', 'example.txt')]:
                    db.execute('INSERT INTO drops (id, object_key, filename, title, kind, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                               (identifier, identifier, filename, filename, 'text', 'text/plain', 0))
                    db.executemany('INSERT INTO drop_tags VALUES (?, ?)', [(identifier, tag) for tag in (*tags, 'custom')])
                db.executescript((MIGRATIONS / '0004_code_kind.sql').read_text())
                self.assertEqual(db.execute("SELECT kind FROM drops WHERE id='source'").fetchone()[0], 'code')
                self.assertEqual(set(db.execute("SELECT tag FROM drop_tags WHERE drop_id='source'")), {('code',), ('custom',)})
                self.assertEqual(set(db.execute("SELECT tag FROM drop_tags WHERE drop_id='plain'")), {(tag,) for tag in (*tags, 'custom')})
                db.executescript((MIGRATIONS / '0004_code_kind.sql').read_text())
                self.assertEqual(db.execute("SELECT count(*) FROM drop_tags WHERE drop_id='source' AND tag='code'").fetchone()[0], 1)


if __name__ == '__main__':
    unittest.main()
