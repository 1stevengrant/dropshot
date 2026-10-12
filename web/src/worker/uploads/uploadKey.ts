import type { Env } from '../types';

/** Strips path separators so an uploaded filename can't escape its drop's folder. */
export function uploadFilename(raw: string): string {
    return raw.replace(/[/\\]/g, '_').trim();
}

/** Uploaded files live at `<prefix>/<id>/<filename>`, the layout the bucket sync and the Mac app use. */
export function uploadKey(env: Env, id: string, filename: string): string {
    return [env.KEY_PREFIX.replace(/\/+$/, ''), id, filename].filter(Boolean).join('/');
}
