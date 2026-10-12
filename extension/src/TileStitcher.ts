import type { Tile } from './captureFullPage';
import type { PageMetrics } from './pageControl';

/** Chrome can't encode a WebP taller than this. */
const maxWebpPixels = 16383;
/** Chrome's canvas height limit; JPEG takes over between the two. */
const maxCanvasPixels = 32767;
/** Library thumbnails: 640px wide, cut off at the top 960px, as the dashboard and Mac app make them. */
const thumbnailWidth = 640;
const thumbnailMaxHeight = 960;

export interface StitchedImage {
    blob: Blob;
    extension: 'webp' | 'jpg';
}

/**
 * Draws tiles onto one canvas as they arrive, cropped to the scrolling region. It keeps the screen's pixel density
 * when the result fits in a WebP; taller pages become JPEG, shrunk only as far as the canvas limit needs.
 */
export class TileStitcher {
    private canvas: OffscreenCanvas | null = null;
    private scale = 1;
    private density = 1;

    constructor(private readonly metrics: PageMetrics) {}

    async draw(tile: Tile): Promise<void> {
        const bitmap = await createImageBitmap(await (await fetch(tile.dataUrl)).blob());
        const { region, height } = this.metrics;

        if (!this.canvas) {
            this.density = bitmap.width / this.metrics.viewportWidth;
            this.scale = height * this.density <= maxWebpPixels ? this.density : Math.min(this.density, maxCanvasPixels / height);
            this.canvas = new OffscreenCanvas(Math.round(region.width * this.scale), Math.round(height * this.scale));
        }

        this.canvas.getContext('2d')!.drawImage(
            bitmap,
            region.left * this.density,
            region.top * this.density,
            region.width * this.density,
            region.height * this.density,
            0,
            Math.round(tile.offset * this.scale),
            region.width * this.scale,
            region.height * this.scale,
        );
        bitmap.close();
    }

    async encode(): Promise<StitchedImage> {
        if (!this.canvas) {
            throw new Error('Nothing was captured.');
        }

        return this.canvas.height <= maxWebpPixels
            ? { blob: await this.canvas.convertToBlob({ type: 'image/webp', quality: 0.8 }), extension: 'webp' }
            : { blob: await this.canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 }), extension: 'jpg' };
    }

    async thumbnail(): Promise<Blob> {
        if (!this.canvas) {
            throw new Error('Nothing was captured.');
        }

        const scale = Math.min(1, thumbnailWidth / this.canvas.width);
        const thumbnail = new OffscreenCanvas(Math.round(this.canvas.width * scale), Math.min(Math.round(this.canvas.height * scale), thumbnailMaxHeight));
        thumbnail.getContext('2d')!.drawImage(this.canvas, 0, 0, this.canvas.width * scale, this.canvas.height * scale);

        return thumbnail.convertToBlob({ type: 'image/webp', quality: 0.75 });
    }
}
