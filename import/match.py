"""Match Droplr metadata to exported files by name, using size to break ties."""
import json
import os
import re
import sys
from collections import defaultdict

EXPORT = sys.argv[1]


def normalize(name: str) -> str:
    return re.sub(r'[^a-z0-9.]+', '', name.lower())


drops = json.load(open('droplr-metadata.json'))
files = [f for f in os.listdir(EXPORT) if not f.startswith('.')]
sizes = {f: os.path.getsize(os.path.join(EXPORT, f)) for f in files}

by_exact = defaultdict(list)
by_norm = defaultdict(list)
by_size = defaultdict(list)

for f in files:
    by_exact[f].append(f)
    by_norm[normalize(f)].append(f)
    by_size[sizes[f]].append(f)

used = set()
matches = {}
methods = defaultdict(int)


def take(candidates, drop):
    free = [c for c in candidates if c not in used]
    same_size = [c for c in free if sizes[c] == drop['size']]

    if same_size:
        return same_size[0]

    return free[0] if len(free) == 1 else None


file_drops = [d for d in drops if d['type'] in ('IMAGE', 'VIDEO', 'FILE')]

for strategy, index, key in [
    ('exact', by_exact, lambda d: d['title']),
    ('normalized', by_norm, lambda d: normalize(d['title'])),
]:
    for drop in file_drops:
        if drop['code'] in matches:
            continue

        found = take(index.get(key(drop), []), drop)

        if found:
            matches[drop['code']] = found
            used.add(found)
            methods[strategy] += 1

# Exported names sometimes differ from the title entirely; a unique byte size is strong evidence.
for drop in file_drops:
    if drop['code'] in matches:
        continue

    free = [c for c in by_size.get(drop['size'], []) if c not in used]

    if len(free) == 1:
        matches[drop['code']] = free[0]
        used.add(free[0])
        methods['size'] += 1

missing = [d for d in file_drops if d['code'] not in matches]
unmatched_files = [f for f in files if f not in used]

json.dump({'matches': matches, 'missing': [d['code'] for d in missing], 'unmatchedFiles': unmatched_files}, open('match.json', 'w'), indent=1)

print(f"file drops {len(file_drops)}, matched {len(matches)} {dict(methods)}")
print(f"missing from export {len(missing)} ({sum(d['size'] for d in missing) / 1e9:.2f} GB)")
print(f"export files with no drop {len(unmatched_files)}: {unmatched_files[:10]}")
mismatched_size = [c for c, f in matches.items() if sizes[f] != next(d for d in drops if d['code'] == c)['size']]
print(f"matches whose size differs {len(mismatched_size)}")
years = defaultdict(int)
for d in missing:
    years[__import__('datetime').datetime.fromtimestamp(d['createdAt'] / 1000).year] += 1
print('missing by year', dict(sorted(years.items())))
