/*
 * Functions injected into the captured tab with chrome.scripting.executeScript. Each is serialised on its own, so
 * they can't share helpers or imports; state between calls lives on window.__dropshotCapture.
 */

export interface PageMetrics {
    height: number;
    viewportWidth: number;
    viewportHeight: number;
}

interface CaptureState {
    scrollX: number;
    scrollY: number;
    style: HTMLStyleElement;
    hidden: { element: HTMLElement; visibility: string; priority: string }[];
}

type CaptureWindow = Window & { __dropshotCapture?: CaptureState };

/** Hides scrollbars and smooth scrolling, scrolls once through the page for lazy content, and measures it. */
export async function preparePage(maxHeight: number): Promise<PageMetrics> {
    const style = document.createElement('style');
    style.textContent = 'html { scroll-behavior: auto !important; } ::-webkit-scrollbar { display: none !important; }';
    document.documentElement.append(style);
    (window as CaptureWindow).__dropshotCapture = { scrollX: window.scrollX, scrollY: window.scrollY, style, hidden: [] };

    const limit = Math.min(document.documentElement.scrollHeight, maxHeight);

    for (let y = 0; y < limit; y += window.innerHeight) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 100));
    }

    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
        height: Math.min(document.documentElement.scrollHeight, maxHeight),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
    };
}

/** Scrolls and waits for scroll triggered reveals, returning where the page stopped (short of `y` on the last tile). */
export async function scrollPage(y: number): Promise<number> {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 150));

    return window.scrollY;
}

/**
 * Fixed and sticky headers, banners and chat buttons belong in the first tile only. Pinned elements as tall as the
 * viewport are backgrounds (a hero's video, say), and hiding those leaves holes. Same rule as the Worker and Mac app.
 */
export function hidePinnedElements(): void {
    const state = (window as CaptureWindow).__dropshotCapture;

    for (const element of document.querySelectorAll<HTMLElement>('*')) {
        const pinned = ['fixed', 'sticky'].includes(getComputedStyle(element).position);

        if (pinned && element.getBoundingClientRect().height < window.innerHeight / 2) {
            state?.hidden.push({ element, visibility: element.style.getPropertyValue('visibility'), priority: element.style.getPropertyPriority('visibility') });
            element.style.setProperty('visibility', 'hidden', 'important');
        }
    }
}

/** Puts the page back the way the user left it. */
export function restorePage(): void {
    const window_ = window as CaptureWindow;
    const state = window_.__dropshotCapture;

    if (!state) {
        return;
    }

    for (const { element, visibility, priority } of state.hidden) {
        element.style.setProperty('visibility', visibility, priority);
    }

    state.style.remove();
    window.scrollTo(state.scrollX, state.scrollY);
    delete window_.__dropshotCapture;
}
