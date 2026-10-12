import { Search } from 'lucide-react';
import { type RefObject, useState } from 'react';
import { CodeSnippetDialog } from './CodeSnippetDialog';
import { ScreenshotDialog } from './ScreenshotDialog';
import { ShortenLinkDialog } from './ShortenLinkDialog';
import { UploadMenu } from './UploadMenu';

interface LibraryHeaderProps {
    search: string;
    onSearch: (value: string) => void;
    fileInput: RefObject<HTMLInputElement | null>;
    onUpload: (files: FileList | File[]) => void;
    onCapture: (url: string, title?: string) => void;
}

export function LibraryHeader({ search, onSearch, fileInput, onUpload, onCapture }: LibraryHeaderProps) {
    const [shortening, setShortening] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [writingSnippet, setWritingSnippet] = useState(false);

    return (
        <header className="flex items-center gap-4 border-b border-line bg-panel px-6 py-3">
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
            <UploadMenu onUploadFiles={() => fileInput.current?.click()} onShortenLink={() => setShortening(true)} onCapturePage={() => setCapturing(true)} onNewSnippet={() => setWritingSnippet(true)} />
            <input ref={fileInput} type="file" multiple hidden onChange={(event) => { onUpload(event.target.files ?? []); event.target.value = ''; }} />
            {shortening && <ShortenLinkDialog onClose={() => setShortening(false)} />}
            {capturing && <ScreenshotDialog onCapture={onCapture} onClose={() => setCapturing(false)} />}
            {writingSnippet && <CodeSnippetDialog onClose={() => setWritingSnippet(false)} />}
        </header>
    );
}
