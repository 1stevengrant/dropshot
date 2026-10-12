import { Clock } from 'lucide-react';
import type { Drop, DropUpdate } from '../../shared/types';
import { CircleButton } from '../components/CircleButton';
import { Menu } from '../components/Menu';
import { MenuHeading } from '../components/MenuHeading';
import { MenuItem } from '../components/MenuItem';
import { expiries } from './expiries';

export function ExpiryMenu({ drop, onChange, onCustom }: { drop: Drop; onChange: (changes: DropUpdate) => void; onCustom: () => void }) {
    return (
        <Menu
            label="Self-destruct"
            trigger={({ toggle }) => (
                <CircleButton title="Manage drop self-destruction" onClick={toggle} active={drop.expiresAt !== null}>
                    <Clock size={18} />
                </CircleButton>
            )}
        >
            {(close) => (
                <>
                    <MenuHeading>File expires in</MenuHeading>
                    {expiries.map((option) => (
                        <MenuItem
                            key={option.label}
                            onSelect={() => {
                                onChange({ expiresAt: option.duration === null ? null : Date.now() + option.duration });
                                close();
                            }}
                        >
                            {option.label}
                        </MenuItem>
                    ))}
                    <MenuItem onSelect={() => { onCustom(); close(); }}>Custom…</MenuItem>
                </>
            )}
        </Menu>
    );
}
