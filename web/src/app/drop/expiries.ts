const hour = 3_600_000;

export const expiries: { label: string; duration: number | null }[] = [
    { label: 'Keep forever', duration: null },
    { label: 'One hour', duration: hour },
    { label: 'One day', duration: 24 * hour },
    { label: 'One week', duration: 7 * 24 * hour },
    { label: 'One month', duration: 30 * 24 * hour },
    { label: 'Three months', duration: 91 * 24 * hour },
    { label: 'Six months', duration: 182 * 24 * hour },
];
