export function DropOverlay() {
    return (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/15 backdrop-blur-[2px]">
            <div className="rounded-2xl border-2 border-dashed border-accent bg-panel px-10 py-8 text-center text-lg font-semibold text-accent shadow-xl">
                Drop to upload
            </div>
        </div>
    );
}
