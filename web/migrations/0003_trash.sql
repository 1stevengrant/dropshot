ALTER TABLE drops ADD COLUMN deleted_at INTEGER;

CREATE INDEX drops_deleted_at ON drops (deleted_at) WHERE deleted_at IS NOT NULL;
