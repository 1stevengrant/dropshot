import { attachImageZoom } from '../shared/imageZoom';

/** Public drop pages: the only script they load, and only for image drops. */
for (const root of document.querySelectorAll<HTMLElement>('[data-image-zoom]')) {
    attachImageZoom(root);
}
