export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
    const pages = [...new Set([1, page - 2, page - 1, page, page + 1, page + 2, pageCount])].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);

    return (
        <nav className="mt-8 flex justify-center" aria-label="Pages">
            <div className="join">
                <button type="button" className="join-item btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
                {pages.map((value, index) => (
                    <span key={value} className="contents">
                        {index > 0 && value - pages[index - 1] > 1 && <button type="button" className="join-item btn btn-sm btn-disabled" tabIndex={-1}>…</button>}
                        <button
                            type="button"
                            aria-current={value === page ? 'page' : undefined}
                            className={`join-item btn btn-sm ${value === page ? 'btn-primary' : ''}`}
                            onClick={() => onChange(value)}
                        >
                            {value}
                        </button>
                    </span>
                ))}
                <button type="button" className="join-item btn btn-sm" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>Next</button>
            </div>
        </nav>
    );
}
