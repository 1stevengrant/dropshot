import { KeyRound, Lock, Timer } from 'lucide-react';
import type { Drop } from '../../shared/types';

export function StatusBadges({ drop }: { drop: Drop }) {
    return (
        <span className="flex items-center gap-1.5 text-muted">
            {drop.privacy === 'private' && <Lock size={14} aria-label="Private" />}
            {drop.privacy === 'password' && <KeyRound size={14} aria-label="Password protected" />}
            {drop.expiresAt !== null && <Timer size={14} aria-label="Self-destructs" />}
        </span>
    );
}
