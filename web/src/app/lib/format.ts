export function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
}

export function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatExpiry(expiresAt: number | null): string {
    if (expiresAt === null) {
        return 'Kept forever';
    }

    const minutes = Math.round((expiresAt - Date.now()) / 60_000);

    if (minutes < 60) {
        return `Expires in ${Math.max(minutes, 1)} min`;
    }

    if (minutes < 60 * 48) {
        return `Expires in ${Math.round(minutes / 60)} h`;
    }

    return `Expires ${new Date(expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export async function copy(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
}
