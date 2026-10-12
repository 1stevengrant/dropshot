import { createRouter } from '../app';

export const assets = createRouter();

/** The public pages' daisyUI stylesheet. */
assets.get('/_assets/*', (c) => c.env.ASSETS.fetch(c.req.raw));
