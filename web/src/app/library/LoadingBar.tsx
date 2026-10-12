export function LoadingBar() {
    return (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent/20" role="progressbar" aria-label="Loading drops">
            <div className="h-full w-1/3 animate-[loading_1s_ease-in-out_infinite] bg-accent" />
        </div>
    );
}
