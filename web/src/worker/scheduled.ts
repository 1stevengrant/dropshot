import { BucketSync } from './bucketSync';
import { Drops } from './drops';
import type { Env } from './types';
import { purgeStalePendingUploads } from './uploads/pendingUpload';

/**
 * Every five minutes: register new uploads, move self-destructed drops to the trash, purge 30 day old trash, and
 * clear instant link markers left by uploads that never finished.
 */
export async function scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const drops = new Drops(env, '');

    ctx.waitUntil(
        new BucketSync(env, drops)
            .sync()
            .catch((error) => console.error('Scheduled sync failed', error))
            .then(() => drops.trashExpired())
            .then(() => drops.purgeTrash())
            .then(() => purgeStalePendingUploads(env)),
    );
}
