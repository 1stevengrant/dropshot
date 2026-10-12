import { useState } from 'react';
import { useToast } from '../components/Toast/useToast';
import { chunkedUpload } from '../lib/chunkedUpload';
import { copy } from '../lib/format';

export interface UploadProgress {
    files: number;
    loaded: number;
    total: number;
}

const idle: UploadProgress = { files: 0, loaded: 0, total: 0 };

export function useUpload(onUploaded: () => void) {
    const [progress, setProgress] = useState<UploadProgress>(idle);
    const toast = useToast();

    async function upload(files: FileList | File[]) {
        const list = Array.from(files);

        if (!list.length) {
            return;
        }

        const sent = new Map<File, number>();
        const batchBytes = list.reduce((sum, file) => sum + file.size, 0);

        setProgress((current) => ({ files: current.files + list.length, loaded: current.loaded, total: current.total + batchBytes }));

        function report(file: File, bytes: number) {
            const delta = bytes - (sent.get(file) ?? 0);
            sent.set(file, bytes);
            setProgress((current) => ({ ...current, loaded: current.loaded + delta }));
        }

        function finish(file: File) {
            const remaining = file.size - (sent.get(file) ?? 0);
            setProgress((current) => (current.files <= 1 ? idle : { files: current.files - 1, loaded: current.loaded + remaining, total: current.total }));
        }

        const results = await Promise.allSettled(
            list.map((file) => chunkedUpload(file, { onProgress: (bytes) => report(file, bytes) }).finally(() => finish(file))),
        );
        const uploaded = results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));

        if (uploaded.length === 1) {
            await copy(uploaded[0].pageUrl);
            toast('Uploaded. Link copied.');
        } else if (uploaded.length) {
            toast(`Uploaded ${uploaded.length} files`);
        }

        if (uploaded.length < list.length) {
            toast(`${list.length - uploaded.length} upload${list.length - uploaded.length === 1 ? '' : 's'} failed`);
        }

        onUploaded();
    }

    return { progress, upload };
}
