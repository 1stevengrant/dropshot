import type { PageMetrics } from './pageControl';
import type { Tile } from './captureFullPage';

/** Chrome can't encode a WebP taller than this. */
const maxWebpPixels = 16383;

/** Draws the tiles onto one canvas at the screen's pixel density, shrinking it only when it would be too tall for WebP. */
export async function stitchTiles(tiles: Tile[], metrics: PageMetrics): Promise<Blob> {
    const bitmaps = await Promise.all(tiles.map(async (tile) => createImageBitmap(await (await fetch(tile.dataUrl)).blob())));
    const density = bitmaps[0]!.width / metrics.viewportWidth;
    const scale = Math.min(density, maxWebpPixels / metrics.height);
    const canvas = new OffscreenCanvas(Math.round(metrics.viewportWidth * scale), Math.round(metrics.height * scale));
    const context = canvas.getContext('2d')!;

    tiles.forEach((tile, index) => {
        const bitmap = bitmaps[index]!;
        context.drawImage(bitmap, 0, Math.round(tile.offset * scale), Math.round(bitmap.width * (scale / density)), Math.round(bitmap.height * (scale / density)));
        bitmap.close();
    });

    return canvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
}
