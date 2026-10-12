import { ArrowUpRight, Circle, Grid3x3, Highlighter, Minus, PenLine, Redo2, Square, Type, Undo2, X } from 'lucide-react';
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';

type Tool = 'arrow' | 'line' | 'rectangle' | 'ellipse' | 'pen' | 'highlighter' | 'text' | 'pixelate';

interface Shape {
    tool: Tool;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    text?: string;
    fontSize?: number;
}

const tools: { tool: Tool; label: string; key: string; icon: ReactNode }[] = [
    { tool: 'arrow', label: 'Arrow', key: 'a', icon: <ArrowUpRight size={18} /> },
    { tool: 'line', label: 'Line', key: 'l', icon: <Minus size={18} /> },
    { tool: 'rectangle', label: 'Rectangle', key: 'r', icon: <Square size={18} /> },
    { tool: 'ellipse', label: 'Ellipse', key: 'o', icon: <Circle size={18} /> },
    { tool: 'pen', label: 'Pen', key: 'p', icon: <PenLine size={18} /> },
    { tool: 'highlighter', label: 'Highlighter', key: 'h', icon: <Highlighter size={18} /> },
    { tool: 'text', label: 'Text', key: 't', icon: <Type size={18} /> },
    { tool: 'pixelate', label: 'Pixelate', key: 'x', icon: <Grid3x3 size={18} /> },
];

const colors = ['#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#3b6ef5', '#8e4ec6', '#111111', '#ffffff'];

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
            <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2.5">
                <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm btn-square" title="Close (Esc)">
                    <X size={20} />
                </button>
                <span className="mr-2 max-w-64 truncate font-medium">Markup: {title}</span>

                <div className="join" role="toolbar" aria-label="Tools">
                    {tools.map((item) => (
                        <button
                            key={item.tool}
                            type="button"
                            title={`${item.label} (${item.key.toUpperCase()})`}
                            aria-pressed={tool === item.tool}
                            onClick={() => setTool(item.tool)}
                            className={`join-item btn btn-sm ${tool === item.tool ? 'btn-active btn-primary' : ''}`}
                        >
                            {item.icon}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Colour">
                    {colors.map((swatch) => (
                        <button
                            key={swatch}
                            type="button"
                            role="radio"
                            aria-checked={color === swatch}
                            aria-label={swatch}
                            onClick={() => setColor(swatch)}
                            className={`size-6 rounded-full border ${color === swatch ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'border-line'}`}
                            style={{ background: swatch }}
                        />
                    ))}
                </div>

                <div className="flex gap-1">
                    <button type="button" onClick={undoLast} disabled={!shapes.length} title="Undo (⌘Z)" className="btn btn-ghost btn-sm btn-square"><Undo2 size={18} /></button>
                    <button type="button" onClick={redoLast} disabled={!redo.length} title="Redo (⇧⌘Z)" className="btn btn-ghost btn-sm btn-square"><Redo2 size={18} /></button>
                </div>

                <div className="ml-auto flex gap-2">
                    <button type="button" onClick={() => save('replace')} disabled={!shapes.length || saving !== null} className="btn btn-sm">
                        {saving === 'replace' && <span className="loading loading-spinner loading-xs" />}
                        Replace original
                    </button>
                    <button type="button" onClick={() => save('copy')} disabled={!shapes.length || saving !== null} className="btn btn-primary btn-sm">
                        {saving === 'copy' && <span className="loading loading-spinner loading-xs" />}
                        Save as new drop
                    </button>
                </div>
            </header>

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

function drawShape(context: CanvasRenderingContext2D, image: HTMLImageElement, shape: Shape) {
    const [start, end] = [shape.points[0], shape.points[shape.points.length - 1]];

    context.save();
    context.strokeStyle = shape.color;
    context.fillStyle = shape.color;
    context.lineWidth = shape.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    switch (shape.tool) {
        case 'arrow': {
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const head = Math.max(shape.width * 4, 16);
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x - Math.cos(angle) * head * 0.8, end.y - Math.sin(angle) * head * 0.8);
            context.stroke();
            context.beginPath();
            context.moveTo(end.x, end.y);
            context.lineTo(end.x - Math.cos(angle - Math.PI / 7) * head, end.y - Math.sin(angle - Math.PI / 7) * head);
            context.lineTo(end.x - Math.cos(angle + Math.PI / 7) * head, end.y - Math.sin(angle + Math.PI / 7) * head);
            context.closePath();
            context.fill();
            break;
        }
        case 'line':
            context.beginPath();
            context.moveTo(start.x, start.y);
            context.lineTo(end.x, end.y);
            context.stroke();
            break;
        case 'rectangle':
            context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
            break;
        case 'ellipse':
            context.beginPath();
            context.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2);
            context.stroke();
            break;
        case 'pen':
        case 'highlighter':
            if (shape.tool === 'highlighter') {
                context.globalAlpha = 0.35;
                context.globalCompositeOperation = 'multiply';
                context.lineCap = 'butt';
            }

            context.beginPath();
            shape.points.forEach((point, index) => (index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)));
            context.stroke();
            break;
        case 'text': {
            context.font = `bold ${shape.fontSize ?? 28}px -apple-system, BlinkMacSystemFont, sans-serif`;
            context.textBaseline = 'middle';
            context.shadowColor = 'rgba(0, 0, 0, 0.45)';
            context.shadowBlur = 4;
            context.fillText(shape.text ?? '', start.x, start.y);
            break;
        }
        case 'pixelate': {
            const x = Math.round(Math.min(start.x, end.x));
            const y = Math.round(Math.min(start.y, end.y));
            const width = Math.round(Math.abs(end.x - start.x));
            const height = Math.round(Math.abs(end.y - start.y));

            if (width < 2 || height < 2) {
                break;
            }

            const block = Math.max(8, Math.round(Math.max(image.naturalWidth, image.naturalHeight) / 90));
            const small = document.createElement('canvas');
            small.width = Math.max(1, Math.round(width / block));
            small.height = Math.max(1, Math.round(height / block));
            small.getContext('2d')!.drawImage(image, x, y, width, height, 0, 0, small.width, small.height);
            context.imageSmoothingEnabled = false;
            context.drawImage(small, 0, 0, small.width, small.height, x, y, width, height);
            break;
        }
    }

    context.restore();
}
