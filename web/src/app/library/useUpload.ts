import { useState } from 'react';
import { useToast } from '../components/Toast/useToast';
import { api } from '../lib/api';
import { copy } from '../lib/format';

export function useUpload(onUploaded: () => void) {
    const [uploading, setUploading] = useState(0);
    const toast = useToast();

    async function upload(files: FileList | File[]) {
        const list = Array.from(files);

        if (!list.length) {
            return;
        }

        setUploading((count) => count + list.length);

        const results = await Promise.allSettled(list.map((file) => api.upload(file).finally(() => setUploading((count) => count - 1))));
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

    return { uploading, upload };
}
