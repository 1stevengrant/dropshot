import { Globe, KeyRound, Lock, type LucideIcon } from 'lucide-react';
import type { Privacy } from '../../shared/types';

export const privacies: { privacy: Privacy; label: string; description: string; icon: LucideIcon }[] = [
    { privacy: 'public', label: 'Public', description: 'Anyone with the link', icon: Globe },
    { privacy: 'password', label: 'Password', description: 'Anyone with the link and password', icon: KeyRound },
    { privacy: 'private', label: 'Private', description: 'Only you, when signed in', icon: Lock },
];
