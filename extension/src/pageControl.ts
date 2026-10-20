/*
 * Functions injected into the captured tab with chrome.scripting.executeScript. Each is serialised on its own, so
 * they can't share helpers or imports; state between calls lives on window.__dropshotCapture.
 */

/** The part of the tab that scrolls, in CSS pixels: the whole viewport, or a panel inside the page. */
export interface ScrollRegion {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface PageMetrics {
    region: ScrollRegion;
    /** The scrolled content's full height, capped. */
    height: number;
    viewportWidth: number;
}

export interface ViewportState {
    viewportWidth: number;
    viewportHeight: number;
    scrollX: number;
    scrollY: number;
}

interface CaptureState {
    scroller: Element | null;
    scrollX: number;
    scrollY: number;
    scrollTop: number;
    style: HTMLStyleElement;
    hidden: { element: HTMLElement; visibility: string; priority: string }[];
}

/** __dropshotSelected is the element picked in the area overlay, which must stay visible. */
type CaptureWindow = Window & { __dropshotCapture?: CaptureState; __dropshotSelected?: Element };

/**
 * Turns off smooth scrolling, optionally hides scrollbars, and remembers where the user was, for restorePage.
 * Selections keep their scrollbars: where they always show, hiding them would shift the page under the selection.
 */
export function beginCapture(hideScrollbars: boolean): ViewportState {
    const style = document.createElement('style');
    style.textContent = hideScrollbars
        ? '* { scroll-behavior: auto !important; scrollbar-width: none !important; } ::-webkit-scrollbar { display: none !important; }'
        : '* { scroll-behavior: auto !important; }';
    document.documentElement.append(style);
    (window as CaptureWindow).__dropshotCapture = { scroller: null, scrollX: window.scrollX, scrollY: window.scrollY, scrollTop: 0, style, hidden: [] };

    return { viewportWidth: window.innerWidth, viewportHeight: window.innerHeight, scrollX: window.scrollX, scrollY: window.scrollY };
}

/**
 * Finds what scrolls, scrolls once through it for lazy content, and measures. Runs after beginCapture.
 * Many web apps (mail, docs, dashboards) keep the page still and scroll a panel instead; the largest scrollable
 * panel is captured then, cropped to its area.
 */
export async function preparePage(maxHeight: number): Promise<PageMetrics> {
    const minScroll = 50;
    const page = document.scrollingElement ?? document.documentElement;
    let scroller: Element | null = null;

    if (page.scrollHeight - window.innerHeight < minScroll) {
        let largestArea = window.innerWidth * window.innerHeight * 0.3;

        for (const element of document.querySelectorAll('*')) {
            const overflow = getComputedStyle(element).overflowY;

            if (!['auto', 'scroll', 'overlay'].includes(overflow) || element.scrollHeight - element.clientHeight < minScroll) {
                continue;
            }

            const rect = element.getBoundingClientRect();
            const area = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));

            if (area > largestArea) {
                largestArea = area;
                scroller = element;
            }
        }
    }

    const state = (window as CaptureWindow).__dropshotCapture!;
    state.scroller = scroller;
    state.scrollTop = scroller?.scrollTop ?? 0;

    const scrollTo = (y: number) => (scroller ? (scroller.scrollTop = y) : window.scrollTo(0, y));
    const contentHeight = () => Math.min(scroller ? scroller.scrollHeight : page.scrollHeight, maxHeight);
    const region = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    if (scroller) {
        // Only the part of the panel that's on screen can be captured.
        const rect = scroller.getBoundingClientRect();
        region.left = Math.max(0, rect.left + scroller.clientLeft);
        region.top = Math.max(0, rect.top + scroller.clientTop);
        region.width = Math.min(scroller.clientWidth, window.innerWidth - region.left);
        region.height = Math.min(scroller.clientHeight, window.innerHeight - region.top);
    }

    for (let y = 0; y < contentHeight(); y += region.height) {
        scrollTo(y);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    scrollTo(0);
    await new Promise((resolve) => setTimeout(resolve, 500));

    return { region, height: contentHeight(), viewportWidth: window.innerWidth };
}

/** Scrolls and waits for scroll triggered reveals, returning where it stopped (short of `y` on the last tile). */
export async function scrollPage(y: number): Promise<number> {
    const scroller = (window as CaptureWindow).__dropshotCapture?.scroller;

    if (scroller) {
        scroller.scrollTop = y;
    } else {
        window.scrollTo(window.scrollX, y);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    return scroller ? scroller.scrollTop : window.scrollY;
}

/**
 * Fixed and sticky headers, banners and chat buttons belong in the first tile only. Large pinned elements that content
 * scrolls over are backgrounds (a hero's video, say), and hiding those leaves holes. Sidebars, drawers and dialogs
 * would repeat down the page, so they go too, except an app shell around
 * the scrolling panel. Same rule as the Worker and Mac app.
 */
export function hidePinnedElements(): void {
    const state = (window as CaptureWindow).__dropshotCapture;
    const selected = (window as CaptureWindow).__dropshotSelected;
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
    const pinned = [...document.querySelectorAll<HTMLElement>('*')].filter((element) => {
        const related = selected && (element.contains(selected) || selected.contains(element));
        const shell = state?.scroller && element.contains(state.scroller);

        return ['fixed', 'sticky'].includes(getComputedStyle(element).position) && !related && !shell && !isBackground(element);
    });

    for (const element of pinned) {
        state?.hidden.push({ element, visibility: element.style.getPropertyValue('visibility'), priority: element.style.getPropertyPriority('visibility') });
        element.style.setProperty('visibility', 'hidden', 'important');
    }
}

/** Puts the page back the way the user left it. */
export function restorePage(): void {
    const captureWindow = window as CaptureWindow;
    const state = captureWindow.__dropshotCapture;

    if (!state) {
        return;
    }

    for (const { element, visibility, priority } of state.hidden) {
        element.style.setProperty('visibility', visibility, priority);
    }

    state.style.remove();

    if (state.scroller) {
        state.scroller.scrollTop = state.scrollTop;
    }

    window.scrollTo(state.scrollX, state.scrollY);
    delete captureWindow.__dropshotCapture;
    delete captureWindow.__dropshotSelected;
}
