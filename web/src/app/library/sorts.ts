import type { DropQuery } from '../../shared/types';

export interface SortOption {
    sort: NonNullable<DropQuery['sort']>;
    dir: NonNullable<DropQuery['dir']>;
    label: string;
}

export const sorts: SortOption[] = [
    { sort: 'created', dir: 'desc', label: 'Newest first' },
    { sort: 'created', dir: 'asc', label: 'Oldest first' },
    { sort: 'title', dir: 'asc', label: 'Name (A to Z)' },
    { sort: 'size', dir: 'desc', label: 'Largest first' },
    { sort: 'views', dir: 'desc', label: 'Most viewed' },
];
