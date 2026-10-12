import { FileCode, FileText, Film, Files, Image, Link2, type LucideIcon } from 'lucide-react';
import type { DropKind } from '../../shared/types';

export const kinds: { kind: DropKind; label: string; icon: LucideIcon }[] = [
    { kind: 'image', label: 'Images', icon: Image },
    { kind: 'video', label: 'Videos', icon: Film },
    { kind: 'text', label: 'Notes', icon: FileText },
    { kind: 'code', label: 'Code', icon: FileCode },
    { kind: 'link', label: 'Links', icon: Link2 },
    { kind: 'file', label: 'Files', icon: Files },
];
