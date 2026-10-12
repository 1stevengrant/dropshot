import { Link2 } from 'lucide-react';
import type { Drop, DropUpdate, Privacy } from '../../shared/types';
import { CircleButton } from '../components/CircleButton';
import { useToast } from '../components/Toast/useToast';
import { copy, formatExpiry } from '../lib/format';
import { CustomExpiryForm } from './CustomExpiryForm';
import { EmbedMenu } from './EmbedMenu';
import { ExpiryMenu } from './ExpiryMenu';
import { MoreMenu } from './MoreMenu';
import { PasswordForm } from './PasswordForm';
import { privacies } from './privacies';
import { PrivacyMenu } from './PrivacyMenu';

interface DropActionsProps {
    drop: Drop;
    title: string;
    onTitleChange: (title: string) => void;
    password: string | null;
    onPasswordChange: (password: string | null) => void;
    customExpiry: string | null;
    onCustomExpiryChange: (customExpiry: string | null) => void;
    onChange: (changes: DropUpdate) => void;
    onDelete: () => void;
}

export function DropActions({
    drop, title, onTitleChange, password, onPasswordChange, customExpiry, onCustomExpiryChange, onChange, onDelete,
}: DropActionsProps) {
    const toast = useToast();

    function saveTitle() {
        if (title.trim() && title !== drop.title) {
            onChange({ title });
        }
    }

    function choosePrivacy(privacy: Privacy) {
        if (privacy === 'password') {
            onPasswordChange('');

            return;
        }

        onChange({ privacy });
        toast(privacy === 'public' ? 'Anyone with the link can view this drop' : 'Only you can view this drop');
    }

    const currentPrivacy = privacies.find((option) => option.privacy === drop.privacy)!;

    return (
        <section className="border-b border-line px-6 py-6 text-center">
            <input
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                onBlur={saveTitle}
                onKeyDown={(event) => event.key === 'Enter' && (event.target as HTMLInputElement).blur()}
                aria-label="Title"
                className="input input-ghost w-full truncate text-center text-lg font-semibold"
            />

            <div className="mt-4 flex justify-center gap-3">
                <CircleButton title="Copy link" onClick={async () => { await copy(drop.pageUrl); toast('Link copied'); }}>
                    <Link2 size={18} />
                </CircleButton>

                <EmbedMenu drop={drop} />

                <PrivacyMenu drop={drop} onSelect={choosePrivacy} />

                <ExpiryMenu drop={drop} onChange={onChange} onCustom={() => onCustomExpiryChange('')} />

                <MoreMenu drop={drop} onDelete={onDelete} />
            </div>

            <p className="mt-3 text-xs text-muted">
                {currentPrivacy.description} · {formatExpiry(drop.expiresAt)}
            </p>

            {password !== null && <PasswordForm value={password} onValueChange={onPasswordChange} onChange={onChange} />}

            {customExpiry !== null && <CustomExpiryForm value={customExpiry} onValueChange={onCustomExpiryChange} onChange={onChange} />}
        </section>
    );
}
