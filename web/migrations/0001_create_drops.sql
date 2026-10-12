CREATE TABLE drops (
    id TEXT PRIMARY KEY,
    object_key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'password', 'private')),
    password_hash TEXT,
    expires_at INTEGER,
    allow_download INTEGER NOT NULL DEFAULT 1,
    views INTEGER NOT NULL DEFAULT 0,
    target_url TEXT
);

CREATE INDEX drops_created_at ON drops (created_at DESC);
CREATE INDEX drops_expires_at ON drops (expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE drop_tags (
    drop_id TEXT NOT NULL REFERENCES drops (id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (drop_id, tag)
);

CREATE INDEX drop_tags_tag ON drop_tags (tag);

CREATE TABLE boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL
);

CREATE TABLE board_drops (
    board_id INTEGER NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    drop_id TEXT NOT NULL REFERENCES drops (id) ON DELETE CASCADE,
    PRIMARY KEY (board_id, drop_id)
);
