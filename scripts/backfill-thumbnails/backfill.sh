#!/usr/bin/env bash
# Makes library thumbnails for image drops uploaded before thumbnails existed, and stores them at _thumbs/<id>.
# Resumable: finished ids are logged to .done, so rerunning skips them. Run from anywhere:
#   scripts/backfill-thumbnails/backfill.sh            (8 at a time)
#   JOBS=4 scripts/backfill-thumbnails/backfill.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
web="$here/../../web"
work="$here/.work"
done_log="$here/.done"
failed_log="$here/.failed"
jobs="${JOBS:-8}"

mkdir -p "$work"
touch "$done_log" "$failed_log"

echo "Building the thumbnail tool…"
swiftc -O -o "$work/thumbnail" "$here/../../Dropshot/Upload/Thumbnailer.swift" "$here/main.swift"

echo "Listing image drops…"
(cd "$web" && npx wrangler d1 execute dropshot --remote --json \
    --command "SELECT id, object_key FROM drops WHERE kind = 'image' AND deleted_at IS NULL ORDER BY created_at DESC") \
    | python3 -I -c 'import json, sys
for row in json.load(sys.stdin)[0]["results"]:
    print(row["id"] + "\t" + row["object_key"])' \
    > "$work/drops.tsv"

if [ ! -s "$work/drops.tsv" ]; then
    echo "No image drops came back from D1; stopping." >&2
    exit 1
fi

python3 -I - "$work/drops.tsv" "$done_log" "$work/todo.tsv" <<'PY'
import sys
drops, done, todo = sys.argv[1:]
finished = set(open(done).read().split())
with open(todo, 'w') as out:
    for line in open(drops):
        if line.split('\t', 1)[0] not in finished:
            out.write(line)
PY

total=$(wc -l < "$work/drops.tsv" | tr -d ' ')
remaining=$(wc -l < "$work/todo.tsv" | tr -d ' ')
echo "$remaining of $total image drops need a thumbnail."

backfill_one() {
    local id="$1" key="$2" original="$work/$1.original" thumb="$work/$1.thumb"

    echo "Processing $id ($key)…"

    if ! (cd "$web" && npx wrangler r2 object get "dropshot/$key" --remote --file "$original" >/dev/null 2>&1); then
        echo "$id	download failed" >> "$failed_log"
        return
    fi

    local type
    if ! type=$("$work/thumbnail" "$original" "$thumb" 2>/dev/null); then
        echo "$id	not decodable" >> "$failed_log"
        rm -f "$original"
        return
    fi

    if (cd "$web" && npx wrangler r2 object put "dropshot/_thumbs/$id" --remote --file "$thumb" --content-type "$type" >/dev/null 2>&1); then
        echo "$id" >> "$done_log"
    else
        echo "$id	upload failed" >> "$failed_log"
    fi

    rm -f "$original" "$thumb"
}

export -f backfill_one
export work web done_log failed_log

tr '\t' '\0' < "$work/todo.tsv" | tr '\n' '\0' | xargs -0 -n 2 -P "$jobs" bash -c 'backfill_one "$0" "$1"'

echo "Done: $(wc -l < "$done_log" | tr -d ' ') thumbnails stored, $(cut -f1 "$failed_log" | sort -u | wc -l | tr -d ' ') failed (see $failed_log)."
