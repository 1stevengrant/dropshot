import type { AppContext } from '../app';
import { Boards } from '../boards';
import { BucketSync } from '../bucketSync';
import { Drops } from '../drops';
import { Tags } from '../tags';
import { Visits } from '../visits';

/** Gives every request its repositories, bound to the request's origin. */
export async function withDrops(c: AppContext, next: () => Promise<void>) {
    const drops = new Drops(c.env, new URL(c.req.url).origin);

    c.set('drops', drops);
    c.set('sync', new BucketSync(c.env, drops));
    c.set('boards', new Boards(c.env));
    c.set('tags', new Tags(c.env));
    c.set('visits', new Visits(c.env));
    await next();
}
