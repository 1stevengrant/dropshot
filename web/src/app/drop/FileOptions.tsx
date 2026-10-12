import type { Drop, DropUpdate } from '../../shared/types';
import { Section } from '../components/Section';
import { Switch } from '../components/Switch';

export function FileOptions({ drop, onChange }: { drop: Drop; onChange: (changes: DropUpdate) => void }) {
    return (
        <Section title="File options">
            <label className="flex items-center justify-between text-sm">
                Download permission
                <Switch checked={drop.allowDownload} onChange={(allowDownload) => onChange({ allowDownload })} />
            </label>
            <p className="mt-1 text-xs text-muted">When off, the drop page has no download button and direct downloads are refused.</p>
        </Section>
    );
}
