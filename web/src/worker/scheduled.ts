import { BucketSync } from './bucketSync';
import { Drops } from './drops';
import type { Env } from './types';

/** Every five minutes: register new uploads, then delete drops that have self-destructed. */
export async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const drops = new Drops(env, '');
    ctx.waitUntil(new BucketSync(env, drops).sync().catch((error) => console.error('Scheduled sync failed', error)).then(() => drops.purgeExpired()));
}
