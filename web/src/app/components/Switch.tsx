export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label?: string }) {
    return <input type="checkbox" className="toggle toggle-success" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} />;
}
