import { createRouter } from './app';
import type { Env } from './drops';
import { importer } from './import';
import { ownerOnly } from './middleware/ownerOnly';
import { withDrops } from './middleware/withDrops';
import { assets } from './routes/assets';
import { boardsApi } from './routes/boardsApi';
import { dashboard } from './routes/dashboard';
import { dropPage } from './routes/dropPage';
import { dropsApi } from './routes/dropsApi';
import { embed } from './routes/embed';
import { files } from './routes/files';
import { linksApi } from './routes/linksApi';
import { rawLink } from './routes/rawLink';
import { tagsApi } from './routes/tagsApi';
import { testUpload } from './routes/testUpload';
import { trashApi } from './routes/trashApi';
import { unlock } from './routes/unlock';
import { uploadApi } from './routes/uploadApi';
import { scheduled } from './scheduled';

const app = createRouter();

app.use('*', withDrops);
app.use('/app/*', ownerOnly);
app.use('/app', ownerOnly);
app.use('/api/*', ownerOnly);

app.route('/_import', importer);

// Order matters: specific routes before the /:id catch-alls, and <id>+ before /:id.
for (const router of [assets, dashboard, dropsApi, trashApi, uploadApi, linksApi, tagsApi, boardsApi]) {
    app.route('/', router);
}

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

for (const router of [testUpload, rawLink, dropPage, embed, unlock, files]) {
    app.route('/', router);
}

export default {
    fetch: app.fetch,
    scheduled,
} satisfies ExportedHandler<Env>;
