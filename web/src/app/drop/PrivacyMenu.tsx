import { Globe, KeyRound, Lock } from 'lucide-react';
import type { Drop, Privacy } from '../../shared/types';
import { CircleButton } from '../components/CircleButton';
import { Menu } from '../components/Menu';
import { MenuHeading } from '../components/MenuHeading';
import { MenuItem } from '../components/MenuItem';
import { privacies } from './privacies';

export function PrivacyMenu({ drop, onSelect }: { drop: Drop; onSelect: (privacy: Privacy) => void }) {
    const currentPrivacy = privacies.find((option) => option.privacy === drop.privacy)!;

    return (
        <Menu
            label="Drop privacy"
            trigger={({ toggle }) => (
                <CircleButton title={`Privacy: ${currentPrivacy.label}`} onClick={toggle} active={drop.privacy !== 'public'}>
                    {drop.privacy === 'public' ? <Globe size={18} /> : drop.privacy === 'password' ? <KeyRound size={18} /> : <Lock size={18} />}
                </CircleButton>
            )}
        >
            {(close) => (
                <>
                    <MenuHeading>Drop privacy</MenuHeading>
                    {privacies.map((option) => (
                        <MenuItem key={option.privacy} checked={drop.privacy === option.privacy} onSelect={() => { onSelect(option.privacy); close(); }}>
                            <span className="flex flex-col">
                                <span className="flex items-center gap-2">{option.label} <span className="text-muted"><option.icon size={15} /></span></span>
                                <span className="text-xs text-muted">{option.description}</span>
                            </span>
                        </MenuItem>
                    ))}
                </>
            )}
        </Menu>
    );
}
