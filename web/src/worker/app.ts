import { type Context, Hono } from 'hono';
import type { Boards } from './boards';
import type { BucketSync } from './bucketSync';
import type { Drops } from './drops';
import type { Tags } from './tags';
import type { Env } from './types';
import type { Visits } from './visits';

export type App = { Bindings: Env; Variables: { drops: Drops; sync: BucketSync; boards: Boards; tags: Tags; visits: Visits } };

export type AppContext = Context<App>;

export const createRouter = () => new Hono<App>();
