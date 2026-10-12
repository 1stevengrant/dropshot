import type { Page } from '@cloudflare/puppeteer';

export interface Tile {
    image: Uint8Array;
    /** Where the page actually stopped scrolling, short of the step on the last tile. */
    offset: number;
}

/**
 * Scrolls one viewport at a time and screenshots each, the way GoFullPage does. Growing the viewport to the page's
 * height instead stretches anything sized in viewport units, such as a 100vh hero, over the whole capture.
 * The Mac app's `WebPageCapture` does the same in WebKit.
 */
export async function captureTiles(page: Page, height: number): Promise<Tile[]> {
    const tiles: Tile[] = [];

    for (let step = 0; step < height; ) {
        const offset = await page.evaluate(async (y: number) => {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 150));

            return window.scrollY;
        }, step);

        // WebP at quality 92 keeps the tiles small enough to pass back into the browser for stitching.
        tiles.push({ image: await page.screenshot({ type: 'webp', quality: 92 }), offset });

        if (tiles.length === 1) {
            await hidePinnedElements(page);
        }

        step += page.viewport()?.height ?? 900;
    }

    return tiles;
}

/**
 * Fixed and sticky headers, banners and chat buttons belong in the first tile only. Pinned elements as tall as the
 * viewport are backgrounds (a hero's video, say), and hiding those leaves holes.
 */
async function hidePinnedElements(page: Page): Promise<void> {
    await page.evaluate(() => {
        for (const element of document.querySelectorAll<HTMLElement>('*')) {
            const pinned = ['fixed', 'sticky'].includes(getComputedStyle(element).position);

            if (pinned && element.getBoundingClientRect().height < window.innerHeight / 2) {
                element.style.setProperty('visibility', 'hidden', 'important');
            }
        }
    });
}
