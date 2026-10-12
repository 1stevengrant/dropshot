import { escape } from './html';
import { layout } from './layout';

/** Not found, expired, private and similar notices. */
export function messagePage(title: string, message: string, action?: { label: string; href: string }): string {
    return layout({
        title,
        body: `<div class="card w-full max-w-sm border border-base-300 bg-base-100 shadow-sm">
    <div class="card-body items-center gap-3 text-center">
        <h1 class="card-title">${escape(title)}</h1>
        <p class="opacity-70">${escape(message)}</p>
        ${action ? `<div class="card-actions"><a class="btn btn-outline" href="${escape(action.href)}">${escape(action.label)}</a></div>` : ''}
    </div>
</div>`,
    });
}
