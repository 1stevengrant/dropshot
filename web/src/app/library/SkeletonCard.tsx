export function SkeletonCard() {
    return (
        <div className="flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100" aria-hidden="true">
            <div className="skeleton aspect-[4/3] rounded-none" />
            <div className="flex flex-col gap-2 p-4">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton mt-3 h-3 w-1/3" />
            </div>
        </div>
    );
}
