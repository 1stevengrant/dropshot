import { layout } from './layout';

/** Shown at an instant link while the Mac app is still uploading; it reloads until the drop exists. */
export function pendingPage(): string {
    return layout({
        title: 'Still uploading…',
        head: '<meta http-equiv="refresh" content="3">',
        body: `<div class="card w-full max-w-sm border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body items-center gap-3 text-center">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <h1 class="card-title">Still uploading…</h1>
        <p class="opacity-70">This page refreshes by itself as soon as the drop is ready.</p>
    </div>
</div>`,
    });
}
