import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');

await build({
    entryPoints: ['src/background.ts', 'src/offscreen.ts'],
    bundle: true,
    format: 'esm',
    target: 'chrome120',
    outdir: 'dist',
});

await cp('manifest.json', 'dist/manifest.json');
await cp('src/offscreen.html', 'dist/offscreen.html');
await cp('icons', 'dist/icons', { recursive: true });

console.log('Built extension into dist/. Load it unpacked from chrome://extensions.');
