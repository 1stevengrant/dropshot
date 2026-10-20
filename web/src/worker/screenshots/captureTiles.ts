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
 * Fixed and sticky headers, banners and chat buttons belong in the first tile only. Large pinned elements that content
 * scrolls over are backgrounds (a hero's video, say), and hiding those leaves holes. Sidebars, drawers and dialogs
 * would repeat down the page, so they go too.
 */
async function hidePinnedElements(page: Page): Promise<void> {
    await page.evaluate(() => {
        const isBackground = (element: HTMLElement) => {
            const rect = element.getBoundingClientRect();
            const left = Math.max(rect.left, 0);
            const top = Math.max(rect.top, 0);
            const width = Math.min(rect.right, window.innerWidth) - left;
            const height = Math.min(rect.bottom, window.innerHeight) - top;

            if (width < window.innerWidth / 2 || height < window.innerHeight / 2) {
                return false;
            }

            // Content scrolls over a background, while drawers and dialogs sit on top wherever you look.
            for (const x of [0.25, 0.5, 0.75]) {
                for (const y of [0.25, 0.5, 0.75]) {
                    const hit = document.elementFromPoint(left + width * x, top + height * y);

                    if (hit && !element.contains(hit)) {
                        return true;
                    }
                }
            }

            return false;
        };

        // Decided before hiding anything, so hidden elements don't change what isBackground sees.
        const pinned = [...document.querySelectorAll<HTMLElement>('*')].filter((element) => ['fixed', 'sticky'].includes(getComputedStyle(element).position) && !isBackground(element));

        for (const element of pinned) {
            element.style.setProperty('visibility', 'hidden', 'important');
        }
    });
}
