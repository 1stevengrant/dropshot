import puppeteer, { type Page } from '@cloudflare/puppeteer';

import { captureTiles } from './captureTiles';
import { stitchTiles } from './stitchTiles';

const width = 1440;
const viewportHeight = 900;
const maxHeight = 8192;
// Chromium can't encode a WebP taller than 16,383 pixels, so the tallest pages drop to 1x.
const maxWebpPixels = 16383;
// Library cards are 4:3; 640px wide covers them on Retina screens.
const thumbnailWidth = 640;

/**
 * Renders a page in Browser Rendering and returns a full length WebP: 2x when it fits, capped so endless pages stay a
 * sane size. WebP at quality 80 is about a third of the PNG's size with no visible loss on text at 2x.
 */
export async function capturePage(binding: Fetcher, url: URL): Promise<{ webp: Uint8Array; thumbnail: Uint8Array; title: string }> {
    const browser = await puppeteer.launch(binding);

    try {
        const page = await browser.newPage();

        await page.setViewport({ width, height: viewportHeight, deviceScaleFactor: 2 });
        await page.goto(url.href, { waitUntil: 'networkidle2', timeout: 30_000 });
        await loadLazyContent(page);

        const title = (await page.title()).trim();
        const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), maxHeight);
        const scale = height * 2 <= maxWebpPixels ? 2 : 1;

        await page.setViewport({ width, height: width * 0.75, deviceScaleFactor: thumbnailWidth / width });
        const thumbnail = await page.screenshot({ type: 'webp', quality: 75 });

        await page.setViewport({ width, height: viewportHeight, deviceScaleFactor: scale });
        await page.evaluate(() => document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important'));

        const webp = await stitchTiles(browser, await captureTiles(page, height), { width, height, scale });

        return { webp, thumbnail, title };
    } finally {
        await browser.close();
    }
}

/** Scrolls through the page so lazily loaded images render before the capture. */
async function loadLazyContent(page: Page): Promise<void> {
    await page.evaluate(async (limit: number) => {
        for (let y = 0; y < Math.min(document.documentElement.scrollHeight, limit); y += window.innerHeight) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }

        window.scrollTo(0, 0);
    }, maxHeight);

    await new Promise((resolve) => setTimeout(resolve, 500));
}
