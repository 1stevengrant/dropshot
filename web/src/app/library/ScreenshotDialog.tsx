import { type FormEvent, useState } from 'react';
import { Modal } from '../components/Modal';

interface ScreenshotDialogProps {
    onCapture: (url: string, title?: string) => void;
    onClose: () => void;
}

/** Asks for a page to capture. The capture itself runs in the background, so the dialog closes straight away. */
export function ScreenshotDialog({ onCapture, onClose }: ScreenshotDialogProps) {
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');

    function submit(event: FormEvent) {
        event.preventDefault();
        onCapture(url.trim(), title.trim() || undefined);
        onClose();
    }

    return (
        <Modal labelledBy="screenshot-title" onClose={onClose}>
            <form onSubmit={submit} className="modal-box flex flex-col gap-4">
                <h2 id="screenshot-title" className="text-lg font-semibold">Capture a web page</h2>

                <label className="floating-label">
                    <span>Page URL</span>
                    <input
                        type="url"
                        required
                        autoFocus
                        value={url}
                        onChange={(event) => setUrl(event.target.value)}
                        placeholder="https://example.com"
                        className="input w-full"
                    />
                </label>

                <label className="floating-label">
                    <span>Title (optional)</span>
                    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional, defaults to the page title)" className="input w-full" />
                </label>

                <div className="modal-action mt-0">
                    <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                    <button type="submit" className="btn btn-primary">Capture</button>
                </div>
            </form>
        </Modal>
    );
}
