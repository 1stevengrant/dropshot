import type { Browser } from '@cloudflare/puppeteer';
import type { Tile } from './captureTiles';

/** Workers have no image library, so the tiles are drawn onto a canvas in the same browser and encoded there. */
export async function stitchTiles(browser: Browser, tiles: Tile[], size: { width: number; height: number; scale: number }): Promise<Uint8Array> {
    const page = await browser.newPage();
    const sources = tiles.map((tile) => ({ src: `data:image/webp;base64,${toBase64(tile.image)}`, offset: tile.offset }));

    const dataUrl = await page.evaluate(
        async (sources: { src: string; offset: number }[], { width, height, scale }: { width: number; height: number; scale: number }) => {
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const context = canvas.getContext('2d')!;

            for (const { src, offset } of sources) {
                const image = new Image();
                image.src = src;
                await image.decode();
                context.drawImage(image, 0, offset * scale);
            }

            return canvas.toDataURL('image/webp', 0.8);
        },
        sources,
        size,
    );

    await page.close();

    return Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (char) => char.charCodeAt(0));
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';

    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }

    return btoa(binary);
}
