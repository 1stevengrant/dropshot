import { X } from 'lucide-react';
import type { DropUpdate } from '../../shared/types';

interface CustomExpiryFormProps {
    value: string;
    onValueChange: (value: string | null) => void;
    onChange: (changes: DropUpdate) => void;
}

export function CustomExpiryForm({ value, onValueChange, onChange }: CustomExpiryFormProps) {
    return (
        <form
            onSubmit={(event) => {
                event.preventDefault();

                if (value) {
                    onChange({ expiresAt: new Date(value).getTime() });
                }

                onValueChange(null);
            }}
            className="mt-4 flex gap-2"
        >
            <input
                type="datetime-local"
                autoFocus
                value={value}
                min={new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)}
                onChange={(event) => onValueChange(event.target.value)}
                className="input input-sm min-w-0 flex-1"
            />
            <button type="submit" className="btn btn-primary btn-sm">Set</button>
            <button type="button" onClick={() => onValueChange(null)} className="btn btn-ghost btn-sm btn-square"><X size={16} /></button>
        </form>
    );
}
