import { Code } from 'lucide-react';
import type { Drop } from '../../shared/types';
import { CircleButton } from '../components/CircleButton';
import { Menu } from '../components/Menu';
import { MenuDivider } from '../components/MenuDivider';
import { MenuHeading } from '../components/MenuHeading';
import { MenuItem } from '../components/MenuItem';
import { useToast } from '../components/Toast/useToast';
import { embedFormats, iframeCode } from '../lib/embed';
import { copy } from '../lib/format';

export function EmbedMenu({ drop }: { drop: Drop }) {
    const toast = useToast();

    return (
        <Menu
            label="Embed and share"
            trigger={({ toggle }) => (
                <CircleButton title="Embed" onClick={toggle}>
                    <Code size={18} />
                </CircleButton>
            )}
        >
            {(close) => (
                <>
                    <MenuHeading>Embed and share</MenuHeading>
                    <MenuItem onSelect={async () => { await copy(await iframeCode(drop)); toast('Embed code copied'); close(); }}>
                        <span className="flex flex-col">
                            <span className="font-medium">Embed (iframe)</span>
                            <span className="text-xs text-muted">Paste into a website, Notion or a blog</span>
                        </span>
                    </MenuItem>
                    <MenuDivider />
                    {embedFormats(drop).map((format) => (
                        <MenuItem key={format.label} onSelect={async () => { await copy(format.value); toast(`${format.label} copied`); close(); }}>
                            {format.label}
                        </MenuItem>
                    ))}
                </>
            )}
        </Menu>
    );
}
