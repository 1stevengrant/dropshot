import { ArrowUpDown } from 'lucide-react';
import { Menu } from '../components/Menu';
import { MenuItem } from '../components/MenuItem';
import { type SortOption, sorts } from './sorts';

export function SortMenu({ current, onChange }: { current: SortOption; onChange: (sort: SortOption) => void }) {
    return (
        <Menu
            align="right"
            label="Sort"
            trigger={({ toggle }) => (
                <button type="button" onClick={toggle} className="btn btn-ghost btn-sm">
                    <ArrowUpDown size={15} /> {current.label}
                </button>
            )}
        >
            {(close) => sorts.map((sort) => (
                <MenuItem
                    key={sort.label}
                    checked={sort === current}
                    onSelect={() => {
                        onChange(sort);
                        close();
                    }}
                >
                    {sort.label}
                </MenuItem>
            ))}
        </Menu>
    );
}
