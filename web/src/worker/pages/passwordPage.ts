import type { DropRow } from '../drops';
import { escape } from './html';
import { layout } from './layout';

/** Asks a visitor for the password of a protected drop. */
export function passwordPage(row: DropRow, failed: boolean): string {
    return layout({
        title: 'Password required',
        body: `<form class="card w-full max-w-sm border border-base-300 bg-base-100 shadow-sm" method="post" action="/${escape(row.id)}/unlock">
    <div class="card-body gap-4 text-center">
        <h1 class="card-title justify-center">This drop is password protected</h1>
        <p class="opacity-70">Enter the password to view it.</p>
        ${failed ? '<div role="alert" class="alert alert-error alert-soft">That password is incorrect.</div>' : ''}
        <label class="input w-full">
            <span class="sr-only">Password</span>
            <input type="password" name="password" autofocus required autocomplete="current-password" placeholder="Password">
        </label>
        <button class="btn btn-primary" type="submit">View drop</button>
    </div>
</form>`,
    });
}
