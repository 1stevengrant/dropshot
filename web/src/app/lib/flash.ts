const key = 'dropshot:flash';

/** A message to show on the next page load, for actions that leave the current page (like deleting a drop). */
export function setFlash(message: string): void {
    try {
        sessionStorage.setItem(key, message);
    } catch {
        // Storage can be unavailable; the message is a nicety.
    }
}

export function takeFlash(): string | null {
    try {
        const message = sessionStorage.getItem(key);
        sessionStorage.removeItem(key);

        return message;
    } catch {
        return null;
    }
}
