import type { Drop } from '../../shared/types';
import { api } from './api';
import { makeThumbnail } from './makeThumbnail';

/** Stores a library thumbnail for an image drop. It's optional, so a failure only means the card shows an icon. */
export async function uploadThumbnail(drop: Drop, file: Blob): Promise<void> {
    if (drop.kind !== 'image') {
        return;
    }

    try {
        const thumbnail = await makeThumbnail(file);

        if (thumbnail) {
            await api.putThumbnail(drop.id, thumbnail);
        }
    } catch (error) {
        console.warn(`Couldn't store a thumbnail for ${drop.id}`, error);
    }
}
