/** Preview style zoom levels the buttons and keys step through. */
const steps = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2, 3, 4];
const minScale = steps[0];
const maxScale = steps[steps.length - 1];

/** Web page captures are rendered 1440px wide, so that is their actual size whatever the pixel density. */
const pageCaptureWidth = 1440;

type Mode = 'fit' | number;

/**
 * Zoom for a drop's image, shared by the dashboard and the public page. Expects, inside `root`:
 * `[data-zoom-viewport]` (the scrolling box), `[data-zoom-image]` (with `data-zoom-fit="width"` for page captures),
 * `[data-zoom-label]`, and buttons with `data-zoom="out|in|fit|actual"`.
 *
 * Click toggles fit and actual size, drag pans, Ctrl or Cmd with the scroll wheel (or a trackpad pinch) zooms around
 * the pointer, and + - 0 1 work from the keyboard. Returns a function that detaches everything.
 */
export function attachImageZoom(root: HTMLElement): () => void {
    const viewport = root.querySelector<HTMLElement>('[data-zoom-viewport]');
    const image = root.querySelector<HTMLImageElement>('[data-zoom-image]');
    const label = root.querySelector<HTMLElement>('[data-zoom-label]');

    if (!viewport || !image) {
        return () => {};
    }

    const fitsWidth = image.dataset.zoomFit === 'width';
    const cleanups: (() => void)[] = [];
    let mode: Mode = 'fit';
    let drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;

    const actualWidth = () => (fitsWidth ? pageCaptureWidth : image.naturalWidth / window.devicePixelRatio);

    function fitScale(): number {
        const style = getComputedStyle(viewport!);
        const width = viewport!.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const height = viewport!.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
        const byWidth = width / actualWidth();

        if (fitsWidth) {
            return Math.min(1, byWidth);
        }

        return Math.min(1, byWidth, height / ((image!.naturalHeight / image!.naturalWidth) * actualWidth()));
    }

    const scaleFor = (value: Mode) => (value === 'fit' ? fitScale() : value);

    function apply(next: Mode, anchor?: { x: number; y: number }) {
        if (!image!.naturalWidth) {
            return;
        }

        const before = image!.getBoundingClientRect();
        const box = viewport!.getBoundingClientRect();
        const x = anchor?.x ?? box.left + box.width / 2;
        const y = anchor?.y ?? box.top + box.height / 2;
        const ratioX = before.width ? (x - before.left) / before.width : 0.5;
        const ratioY = before.height ? (y - before.top) / before.height : 0;

        mode = next;

        const scale = scaleFor(mode);

        image!.style.width = `${Math.round(actualWidth() * scale)}px`;
        image!.style.height = 'auto';
        image!.style.maxWidth = 'none';
        image!.style.maxHeight = 'none';

        const after = image!.getBoundingClientRect();
        viewport!.scrollLeft += after.left + ratioX * after.width - x;
        viewport!.scrollTop += after.top + ratioY * after.height - y;

        root.dataset.zoomed = String(mode !== 'fit');

        if (label) {
            label.textContent = mode === 'fit' ? `Fit · ${Math.round(scale * 100)}%` : `${Math.round(scale * 100)}%`;
        }
    }

    function step(direction: 1 | -1) {
        const current = scaleFor(mode);
        const next = direction > 0 ? steps.find((value) => value > current + 0.001) : [...steps].reverse().find((value) => value < current - 0.001);

        apply(next ?? (direction > 0 ? maxScale : minScale));
    }

    function listen<K extends keyof HTMLElementEventMap>(target: HTMLElement | Window, type: K, handler: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) {
        target.addEventListener(type, handler as EventListener, options);
        cleanups.push(() => target.removeEventListener(type, handler as EventListener, options));
    }

    for (const button of root.querySelectorAll<HTMLElement>('[data-zoom]')) {
        listen(button, 'click', () => {
            const action = button.dataset.zoom;

            if (action === 'in' || action === 'out') {
                step(action === 'in' ? 1 : -1);
            } else {
                apply(action === 'actual' ? 1 : 'fit');
            }
        });
    }

    listen(image, 'click', (event) => {
        if (drag?.moved) {
            return;
        }

        apply(mode === 'fit' && fitScale() < 0.999 ? 1 : 'fit', { x: event.clientX, y: event.clientY });
    });

    listen(viewport, 'wheel', (event) => {
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }

        event.preventDefault();
        const scale = Math.min(maxScale, Math.max(minScale, scaleFor(mode) * Math.exp(-event.deltaY * 0.01)));
        apply(scale, { x: event.clientX, y: event.clientY });
    }, { passive: false });

    listen(viewport, 'pointerdown', (event) => {
        if (event.button !== 0 || mode === 'fit') {
            drag = null;

            return;
        }

        drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop, moved: false };
    });

    listen(viewport, 'pointermove', (event) => {
        if (!drag || !(event.buttons & 1)) {
            return;
        }

        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;

        if (!drag.moved && Math.hypot(dx, dy) < 4) {
            return;
        }

        drag.moved = true;
        viewport.scrollLeft = drag.left - dx;
        viewport.scrollTop = drag.top - dy;
        event.preventDefault();
    });

    listen(window, 'keydown', (event) => {
        const target = event.target as HTMLElement | null;

        if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"]')) {
            return;
        }

        const actions: Record<string, () => void> = { '+': () => step(1), '=': () => step(1), '-': () => step(-1), '0': () => apply('fit'), '1': () => apply(1) };
        const action = actions[event.key];

        if (action) {
            event.preventDefault();
            action();
        }
    });

    const resize = new ResizeObserver(() => {
        if (mode === 'fit') {
            apply('fit');
        }
    });
    resize.observe(viewport);
    cleanups.push(() => resize.disconnect());

    if (image.complete) {
        apply('fit');
    } else {
        listen(image, 'load', () => apply('fit'), { once: true });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
}
