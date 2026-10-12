import type { Drop, DropUpdate } from '../../shared/types';
import { Section } from '../components/Section';
import { formatBytes, formatDate } from '../lib/format';
import { BoardsPicker } from './BoardsPicker';
import { TagEditor } from './TagEditor';

export function FileDetails({ drop, onChange }: { drop: Drop; onChange: (changes: DropUpdate) => void }) {
    return (
        <Section title="File details">
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-3 text-sm">
                <dt className="text-muted">Size</dt>
                <dd>{formatBytes(drop.size)}</dd>
                <dt className="text-muted">Type</dt>
                <dd className="truncate">{drop.contentType}</dd>
                <dt className="text-muted">Created</dt>
                <dd>{formatDate(drop.createdAt)}</dd>
                <dt className="text-muted">Boards</dt>
                <dd>
                    <BoardsPicker drop={drop} />
                </dd>
                <dt className="pt-1 text-muted">Tags</dt>
                <dd className="flex flex-wrap items-center gap-1.5">
                    <TagEditor drop={drop} onChange={onChange} />
                </dd>
            </dl>
        </Section>
    );
}
