CREATE TABLE drop_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drop_id TEXT NOT NULL REFERENCES drops (id) ON DELETE CASCADE,
    viewed_at INTEGER NOT NULL,
    country TEXT,
    city TEXT,
    referrer TEXT,
    browser TEXT,
    kind TEXT NOT NULL DEFAULT 'view' CHECK (kind IN ('view', 'download'))
);

CREATE INDEX drop_views_drop ON drop_views (drop_id, viewed_at DESC);

ALTER TABLE drops ADD COLUMN cta_label TEXT;
ALTER TABLE drops ADD COLUMN cta_url TEXT;
