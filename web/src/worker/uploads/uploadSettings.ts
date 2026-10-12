import type { Privacy } from '../../shared/types';

export interface UploadSettings {
    privacy?: Privacy;
    passwordHash?: string;
    expiresAt?: number;
    allowDownload?: boolean;
}

const privacies: Privacy[] = ['public', 'password', 'private'];

/**
 * Reads the drop settings the Mac app sends as `x-amz-meta-*` headers. Invalid values are ignored. A password drop
 * without a usable hash becomes private rather than public. An expiry already in the past is kept, so a drop synced
 * after its self destruct time is gone at once instead of living forever.
 */
export function parseUploadSettings(read: (name: string) => string): UploadSettings {
    const settings: UploadSettings = {};

    const privacy = read('privacy') as Privacy;

    if (privacies.includes(privacy)) {
        settings.privacy = privacy;
    }

    const passwordHash = read('password-hash');

    if (/^pbkdf2\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/.test(passwordHash)) {
        settings.passwordHash = passwordHash;
    }

    if (settings.privacy === 'password' && !settings.passwordHash) {
        settings.privacy = 'private';
    }

    if (settings.privacy !== 'password') {
        delete settings.passwordHash;
    }

    const expiresAt = read('expires-at');

    if (/^\d{1,15}$/.test(expiresAt) && Number(expiresAt) > 0) {
        settings.expiresAt = Number(expiresAt);
    }

    const allowDownload = read('allow-download');

    if (allowDownload === '0' || allowDownload === '1') {
        settings.allowDownload = allowDownload === '1';
    }

    return settings;
}
