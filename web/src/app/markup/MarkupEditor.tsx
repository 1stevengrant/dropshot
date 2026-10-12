import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { drawShape } from './drawShape';
import { MarkupToolbar } from './MarkupToolbar';
import { colors, type Shape, type Tool, tools } from './tools';

interface MarkupEditorProps {
    src: string;
    title: string;
    onCancel: () => void;
    onSave: (image: Blob, mode: 'copy' | 'replace') => Promise<void>;
}

/** A small Droplr style markup editor. Shapes are kept as data and drawn at the image's full resolution. */
export function MarkupEditor({ src, title, onCancel, onSave }: MarkupEditorProps) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [redo, setRedo] = useState<Shape[]>([]);
    const [draft, setDraftState] = useState<Shape | null>(null);
    // Pointer events can arrive faster than React re-renders, so handlers read the in-progress shape from a ref.
    const draftRef = useRef<Shape | null>(null);

    function setDraft(shape: Shape | null) {
        draftRef.current = shape;
        setDraftState(shape);
    }
    const [tool, setTool] = useState<Tool>('arrow');
    const [color, setColor] = useState(colors[0]);
    const [textEntry, setTextEntry] = useState<{ x: number; y: number; screenX: number; screenY: number; value: string } | null>(null);
    const [saving, setSaving] = useState<'copy' | 'replace' | null>(null);

    useEffect(() => {
        const element = new Image();
        element.onload = () => setImage(element);
        element.src = src;
    }, [src]);

    const scale = image ? Math.max(image.naturalWidth, image.naturalHeight) / 1000 : 1;
    const strokeWidth = Math.max(3, 4 * scale);

    useEffect(() => {
        const context = canvas.current?.getContext('2d');

        if (!context || !image) {
            return;
        }

        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        context.drawImage(image, 0, 0);

        for (const shape of draft ? [...shapes, draft] : shapes) {
            drawShape(context, image, shape);
        }
    }, [image, shapes, draft]);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (textEntry || (event.target as HTMLElement).tagName === 'INPUT') {
                return;
            }

            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
                event.preventDefault();
                event.shiftKey ? redoLast() : undoLast();

                return;
            }

            if (event.key === 'Escape') {
                onCancel();

                return;
            }

            const match = tools.find((item) => item.key === event.key.toLowerCase());

            if (match && !event.metaKey && !event.ctrlKey) {
                setTool(match.tool);
            }
        }

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    });

    function toImagePoint(event: PointerEvent<HTMLCanvasElement>) {
        const rect = event.currentTarget.getBoundingClientRect();

        return {
            x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width,
            y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height,
        };
    }

    function commit(shape: Shape) {
        setShapes((current) => [...current, shape]);
        setRedo([]);
    }

    function undoLast() {
        setShapes((current) => {
            if (!current.length) {
                return current;
            }

            setRedo((stack) => [...stack, current[current.length - 1]]);

            return current.slice(0, -1);
        });
    }

    function redoLast() {
        setRedo((stack) => {
            if (!stack.length) {
                return stack;
            }

            setShapes((current) => [...current, stack[stack.length - 1]]);

            return stack.slice(0, -1);
        });
    }

    function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
        const point = toImagePoint(event);

        if (tool === 'text') {
            setTextEntry({ ...point, screenX: event.clientX, screenY: event.clientY, value: '' });

            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        setDraft({ tool, points: [point, point], color, width: tool === 'highlighter' ? strokeWidth * 5 : strokeWidth });
    }

    function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
        const draft = draftRef.current;

        if (!draft) {
            return;
        }

        const point = toImagePoint(event);
        const freehand = draft.tool === 'pen' || draft.tool === 'highlighter';
        setDraft({ ...draft, points: freehand ? [...draft.points, point] : [draft.points[0], point] });
    }

    function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
        const draft = draftRef.current;

        if (!draft) {
            return;
        }

        const last = toImagePoint(event);
        const freehand = draft.tool === 'pen' || draft.tool === 'highlighter';
        draft.points = freehand ? [...draft.points, last] : [draft.points[0], last];

        const [start, end] = [draft.points[0], draft.points[draft.points.length - 1]];

        if (draft.tool === 'pen' || Math.hypot(end.x - start.x, end.y - start.y) > 3 * scale) {
            commit(draft);
        }

        setDraft(null);
    }

    function finishText() {
        if (textEntry?.value.trim()) {
            commit({ tool: 'text', points: [{ x: textEntry.x, y: textEntry.y }], color, width: strokeWidth, text: textEntry.value.trim(), fontSize: Math.round(28 * scale) });
        }

        setTextEntry(null);
    }

    async function save(mode: 'copy' | 'replace') {
        if (!canvas.current) {
            return;
        }

        setSaving(mode);

        const blob = await new Promise<Blob | null>((resolve) => canvas.current!.toBlob(resolve, 'image/png'));

        if (blob) {
            await onSave(blob, mode).finally(() => setSaving(null));
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-canvas" role="dialog" aria-label={`Markup ${title}`}>
            <MarkupToolbar
                title={title}
                tool={tool}
                onToolChange={setTool}
                color={color}
                onColorChange={setColor}
                hasShapes={shapes.length > 0}
                canRedo={redo.length > 0}
                onUndo={undoLast}
                onRedo={redoLast}
                saving={saving}
                onSave={save}
                onCancel={onCancel}
            />

            <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
                {!image && <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading image" />}
                {image && (
                    <canvas
                        ref={canvas}
                        width={image.naturalWidth}
                        height={image.naturalHeight}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        className="max-h-full max-w-full touch-none rounded-md shadow-lg"
                        style={{ cursor: tool === 'text' ? 'text' : 'crosshair' }}
                    />
                )}
                {textEntry && (
                    <input
                        autoFocus
                        value={textEntry.value}
                        onChange={(event) => setTextEntry({ ...textEntry, value: event.target.value })}
                        onBlur={finishText}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                finishText();
                            }

                            if (event.key === 'Escape') {
                                setTextEntry(null);
                            }
                        }}
                        placeholder="Type, then Enter"
                        className="fixed z-10 rounded border border-dashed border-accent bg-panel/90 px-2 py-1 text-lg font-bold outline-none"
                        style={{ left: textEntry.screenX, top: textEntry.screenY - 20, color }}
                    />
                )}
            </main>
        </div>
    );
}
