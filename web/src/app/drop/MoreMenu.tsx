import { Copy, Download, Ellipsis, ExternalLink, Trash2 } from 'lucide-react';
import type { Drop } from '../../shared/types';
import { CircleButton } from '../components/CircleButton';
import { Menu } from '../components/Menu';
import { MenuDivider } from '../components/MenuDivider';
import { MenuItem } from '../components/MenuItem';
import { useToast } from '../components/Toast/useToast';
import { previewUrl } from '../lib/api';
import { copy } from '../lib/format';

export function MoreMenu({ drop, onDelete }: { drop: Drop; onDelete: () => void }) {
    const toast = useToast();

    return (
        <Menu
            align="right"
            label="More"
            trigger={({ toggle }) => (
                <CircleButton title="More" onClick={toggle}>
                    <Ellipsis size={18} />
                </CircleButton>
            )}
        >
            {(close) => (
                <>
                    <MenuItem onSelect={async () => { await copy(drop.directUrl); toast('Direct link copied'); close(); }}>
                        <Copy size={15} /> Copy direct link
                    </MenuItem>
                    <MenuItem onSelect={() => { window.location.assign(`${drop.pageUrl}?preview`); close(); }}>
                        <ExternalLink size={15} /> View as visitor
                    </MenuItem>
                    <MenuItem onSelect={() => { window.location.href = `${previewUrl(drop)}?download=1`; close(); }}>
                        <Download size={15} /> Download
                    </MenuItem>
                    <MenuDivider />
                    <MenuItem danger onSelect={() => { close(); onDelete(); }}>
                        <Trash2 size={15} /> Delete
                    </MenuItem>
                </>
            )}
        </Menu>
    );
}
