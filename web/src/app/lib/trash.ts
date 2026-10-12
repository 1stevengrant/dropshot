const retentionDays = 30;

/** Whole days before a trashed drop is deleted forever. */
export function daysLeftInTrash(deletedAt: number): number {
    return Math.max(0, Math.ceil((deletedAt + retentionDays * 86_400_000 - Date.now()) / 86_400_000));
}

export function trashCountdown(deletedAt: number): string {
    const days = daysLeftInTrash(deletedAt);

    return days <= 1 ? 'Deleted forever within a day' : `Deleted forever in ${days} days`;
}
