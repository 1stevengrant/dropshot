import { X } from 'lucide-react';
import type { DropUpdate } from '../../shared/types';
import { useToast } from '../components/Toast/useToast';

interface PasswordFormProps {
    value: string;
    onValueChange: (value: string | null) => void;
    onChange: (changes: DropUpdate) => void;
}

export function PasswordForm({ value, onValueChange, onChange }: PasswordFormProps) {
    const toast = useToast();

    function savePassword() {
        if (!value) {
            return;
        }

        onChange({ privacy: 'password', password: value });
        onValueChange(null);
        toast('Password set');
    }

    return (
        <form onSubmit={(event) => { event.preventDefault(); savePassword(); }} className="mt-4 flex gap-2">
            <input
                type="password"
                autoFocus
                value={value}
                onChange={(event) => onValueChange(event.target.value)}
                placeholder="Set a password"
                autoComplete="new-password"
                className="input input-sm min-w-0 flex-1"
            />
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
            <button type="button" onClick={() => onValueChange(null)} className="btn btn-ghost btn-sm btn-square"><X size={16} /></button>
        </form>
    );
}
