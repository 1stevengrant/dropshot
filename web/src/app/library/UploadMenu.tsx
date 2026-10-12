import { ChevronDown, FileCode, Link2, Upload } from 'lucide-react';
import { Menu } from '../components/Menu';
import { MenuItem } from '../components/MenuItem';

interface UploadMenuProps {
    onUploadFiles: () => void;
    onShortenLink: () => void;
    onNewSnippet: () => void;
}

/** Droplr style split button: Upload file, with other ways to make a drop behind the arrow. */
export function UploadMenu({ onUploadFiles, onShortenLink, onNewSnippet }: UploadMenuProps) {
    return (
        <div className="join">
            <button type="button" onClick={onUploadFiles} className="join-item btn btn-primary btn-sm">
                <Upload size={16} /> Upload file
            </button>
            <Menu
                align="right"
                label="More ways to drop"
                trigger={({ open, toggle }) => (
                    <button type="button" onClick={toggle} aria-expanded={open} aria-label="More ways to drop" className="join-item btn btn-primary btn-sm border-l-primary-content/30 px-2">
                        <ChevronDown size={16} />
                    </button>
                )}
            >
                {(close) => (
                    <>
                        <MenuItem onSelect={() => { close(); onUploadFiles(); }}>
                            <Upload size={15} /> Upload files…
                        </MenuItem>
                        <MenuItem onSelect={() => { close(); onShortenLink(); }}>
                            <Link2 size={15} /> Shorten link…
                        </MenuItem>
                        <MenuItem onSelect={() => { close(); onNewSnippet(); }}>
                            <FileCode size={15} /> New code snippet…
                        </MenuItem>
                    </>
                )}
            </Menu>
        </div>
    );
}
