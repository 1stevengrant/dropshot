import { Search } from 'lucide-react';
import { type RefObject, useState } from 'react';
import { ShortenLinkDialog } from './ShortenLinkDialog';
import { UploadMenu } from './UploadMenu';

interface LibraryHeaderProps {
    search: string;
    onSearch: (value: string) => void;
    fileInput: RefObject<HTMLInputElement | null>;
    onUpload: (files: FileList | File[]) => void;
}

export function LibraryHeader({ search, onSearch, fileInput, onUpload }: LibraryHeaderProps) {
    const [shortening, setShortening] = useState(false);

    return (
        <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-panel px-6 py-3">
            <label className="flex flex-1 items-center gap-3 text-muted">
                <Search size={18} />
                <input
                    type="search"
                    value={search}
                    onChange={(event) => onSearch(event.target.value)}
                    placeholder="Search drops and tags"
                    className="w-full bg-transparent py-2 text-ink outline-none placeholder:text-muted"
                />
            </label>
            <UploadMenu onUploadFiles={() => fileInput.current?.click()} onShortenLink={() => setShortening(true)} />
            <input ref={fileInput} type="file" multiple hidden onChange={(event) => { onUpload(event.target.files ?? []); event.target.value = ''; }} />
            {shortening && <ShortenLinkDialog onClose={() => setShortening(false)} />}
        </header>
    );
}
