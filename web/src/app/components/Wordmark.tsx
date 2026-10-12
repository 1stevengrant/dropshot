interface WordmarkProps {
    size: number;
}

/** The app icon followed by the Dropshot name, sized to sit beside text of the surrounding size. */
export function Wordmark({ size }: WordmarkProps) {
    return (
        <span className="inline-flex items-center gap-2">
            <img src="/favicon.svg" alt="" width={size} height={size} className="shrink-0" />
            Dropshot
        </span>
    );
}
