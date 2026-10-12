/** A picked element or dragged area, in document coordinates (CSS pixels from the top left of the page). */
export interface Selection {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * The area overlay, injected into the tab. Hovering outlines the element under the pointer, clicking (or Enter)
 * picks it, dragging draws a rectangle, the arrow keys move to the parent or child element, and Esc cancels.
 * Resolves once the overlay is gone from the screen, so it never appears in the capture. Self contained, because
 * chrome.scripting serialises it on its own.
 */
export function selectArea(): Promise<Selection | null> {
    type SelectionWindow = Window & { __dropshotSelected?: Element; __dropshotSelecting?: boolean };
    const selectionWindow = window as SelectionWindow;

    if (selectionWindow.__dropshotSelecting) {
        return Promise.resolve(null);
    }

    selectionWindow.__dropshotSelecting = true;

    const host = document.createElement('dropshot-overlay');
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; cursor: crosshair;';
    const shadow = host.attachShadow({ mode: 'closed' });
    shadow.innerHTML = `
        <style>
            :host { font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
            .shade { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.35); }
            .box { position: fixed; display: none; outline: 2px solid #3b82f6; background: rgba(59, 130, 246, 0.12); box-shadow: 0 0 0 100vmax rgba(15, 23, 42, 0.35); pointer-events: none; }
            .size { position: fixed; display: none; padding: 2px 6px; border-radius: 4px; background: #1e293b; color: #fff; pointer-events: none; white-space: nowrap; }
            .hint { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); padding: 6px 12px; border-radius: 999px; background: #1e293b; color: #fff; pointer-events: none; white-space: nowrap; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25); }
        </style>
        <div class="shade"></div>
        <div class="box"></div>
        <div class="size"></div>
        <div class="hint">Click an element or drag an area · ↑ ↓ parent or child · Esc to cancel</div>`;
    document.documentElement.append(host);

    const shade = shadow.querySelector<HTMLElement>('.shade')!;
    const box = shadow.querySelector<HTMLElement>('.box')!;
    const size = shadow.querySelector<HTMLElement>('.size')!;

    let target: Element | null = null;
    const descendants: Element[] = [];
    let dragStart: { x: number; y: number } | null = null;
    let dragRect: DOMRect | null = null;
    let pointer = { x: 0, y: 0 };

    /** What the element actually shows: clipped by any ancestor that scrolls or hides overflow. */
    const visibleRect = (element: Element): DOMRect => {
        const rect = element.getBoundingClientRect();
        let top = rect.top;
        let bottom = rect.bottom;
        let left = Math.max(rect.left, 0);
        let right = Math.min(rect.right, window.innerWidth);

        for (let ancestor = element.parentElement; ancestor && ancestor !== document.body && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
            const overflow = getComputedStyle(ancestor).overflowY;

            if (['auto', 'scroll', 'overlay', 'hidden', 'clip'].includes(overflow)) {
                const clip = ancestor.getBoundingClientRect();
                top = Math.max(top, clip.top);
                bottom = Math.min(bottom, clip.bottom);
                left = Math.max(left, clip.left);
                right = Math.min(right, clip.right);
            }
        }

        return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
    };

    const draw = (rect: DOMRect | null) => {
        shade.style.display = rect ? 'none' : 'block';
        box.style.display = rect ? 'block' : 'none';
        size.style.display = rect ? 'block' : 'none';

        if (!rect) {
            return;
        }

        // The outline is clamped to the screen, but the size shows the whole selection.
        const top = Math.max(rect.top, 0);
        const bottom = Math.min(rect.bottom, window.innerHeight);
        Object.assign(box.style, { left: `${rect.left}px`, top: `${top}px`, width: `${rect.width}px`, height: `${Math.max(0, bottom - top)}px` });
        size.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
        Object.assign(size.style, { left: `${Math.max(rect.left, 4)}px`, top: `${top >= 28 ? top - 24 : Math.min(top + 4, window.innerHeight - 24)}px` });
    };

    const targetAt = (x: number, y: number) => document.elementsFromPoint(x, y).find((element) => element !== host && element !== document.documentElement) ?? null;

    const highlight = (element: Element | null) => {
        target = element;
        draw(element ? visibleRect(element) : null);
    };

    return new Promise((resolve) => {
        const finish = (rect: DOMRect | null, element: Element | null) => {
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('scroll', onScroll, true);
            host.remove();
            delete selectionWindow.__dropshotSelecting;

            if (element) {
                selectionWindow.__dropshotSelected = element;
            }

            const selection = rect && rect.width >= 4 && rect.height >= 4 ? { x: rect.left + window.scrollX, y: rect.top + window.scrollY, width: rect.width, height: rect.height } : null;

            // Two frames, so the overlay is off the screen before anything is captured.
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(selection)));
        };

        const onKey = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            if (event.key === 'Escape') {
                finish(null, null);
            } else if (event.key === 'Enter' && target) {
                finish(visibleRect(target), target);
            } else if (event.key === 'ArrowUp' && target?.parentElement && target.parentElement !== document.documentElement) {
                descendants.push(target);
                highlight(target.parentElement);
            } else if (event.key === 'ArrowDown' && target) {
                highlight(descendants.pop() ?? target.firstElementChild ?? target);
            }
        };

        const onScroll = () => {
            if (!dragStart) {
                highlight(targetAt(pointer.x, pointer.y));
            }
        };

        host.addEventListener('mousemove', (event) => {
            pointer = { x: event.clientX, y: event.clientY };

            if (dragStart && (dragRect || Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 4)) {
                dragRect = new DOMRect(Math.min(dragStart.x, event.clientX), Math.min(dragStart.y, event.clientY), Math.abs(event.clientX - dragStart.x), Math.abs(event.clientY - dragStart.y));
                draw(dragRect);

                return;
            }

            descendants.length = 0;
            highlight(targetAt(event.clientX, event.clientY));
        });

        host.addEventListener('mousedown', (event) => {
            event.preventDefault();
            dragStart = { x: event.clientX, y: event.clientY };
            dragRect = null;
        });

        host.addEventListener('mouseup', (event) => {
            event.preventDefault();

            if (dragRect) {
                finish(dragRect, null);
            } else if (target) {
                finish(visibleRect(target), target);
            }

            dragStart = null;
        });

        window.addEventListener('keydown', onKey, true);
        window.addEventListener('scroll', onScroll, true);
    });
}
