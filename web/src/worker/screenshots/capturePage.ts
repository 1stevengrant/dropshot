import puppeteer, { type Page } from '@cloudflare/puppeteer';

const width = 1440;
// Headless Chromium repeats the top of the page past 8192 device pixels, so tall pages drop to 1x.
const maxDevicePixels = 8192;
const maxHeight = maxDevicePixels;
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

        await page.setViewport({ width, height: 900, deviceScaleFactor: 2 });
        await page.goto(url.href, { waitUntil: 'networkidle2', timeout: 30_000 });
        await loadLazyContent(page);

        const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), maxHeight);

        // A viewport as tall as the page puts every section in view, so fixed headers stay at the top and scroll
        // triggered reveals run. Capturing beyond a short viewport instead repeats and blanks parts of the page.
        await page.setViewport({ width, height, deviceScaleFactor: height * 2 <= maxDevicePixels ? 2 : 1 });
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const webp = await page.screenshot({ type: 'webp', quality: 80 });

        await page.setViewport({ width, height: width * 0.75, deviceScaleFactor: thumbnailWidth / width });
        const thumbnail = await page.screenshot({ type: 'webp', quality: 75 });

        return { webp, thumbnail, title: (await page.title()).trim() };
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
