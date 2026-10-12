const width = 640;
const maxHeight = 960;

/**
 * Shrinks an image to a library thumbnail, 640px wide and cut off at the top 960px for tall ones. Browsers that can't
 * encode WebP (Safari) fall back to PNG, which still keeps transparent window shadows intact.
 */
export async function makeThumbnail(image: Blob): Promise<Blob | null> {
    let bitmap: ImageBitmap;

    try {
        bitmap = await createImageBitmap(image);
    } catch {
        return null;
    }

    const scale = Math.min(1, width / bitmap.width);
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.min(Math.round(bitmap.height * scale), maxHeight));

    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, bitmap.width * scale, bitmap.height * scale);
    bitmap.close();

    return canvas.convertToBlob({ type: 'image/webp', quality: 0.75 });
}
