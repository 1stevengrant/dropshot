import { dropshotUrl } from './config';

/**
 * Stores the library thumbnail, as the dashboard does after an upload; originals this big are never used as their own.
 * It's optional, so a failure only means the card shows an icon.
 */
export async function uploadThumbnail(dropId: string, thumbnail: Blob): Promise<void> {
    try {
        const response = await fetch(`${dropshotUrl}/api/drops/${dropId}/thumbnail`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': thumbnail.type },
            body: thumbnail,
        });

        if (!response.ok) {
            console.warn(`Couldn't store a thumbnail for ${dropId} (${response.status})`);
        }
    } catch (error) {
        console.warn(`Couldn't store a thumbnail for ${dropId}`, error);
    }
}
