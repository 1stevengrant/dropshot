import { Redo2, Undo2, X } from 'lucide-react';
import { colors, type Tool, tools } from './tools';

interface MarkupToolbarProps {
    title: string;
    tool: Tool;
    onToolChange: (tool: Tool) => void;
    color: string;
    onColorChange: (color: string) => void;
    hasShapes: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    saving: 'copy' | 'replace' | null;
    onSave: (mode: 'copy' | 'replace') => void;
    onCancel: () => void;
}

export function MarkupToolbar({
    title, tool, onToolChange, color, onColorChange, hasShapes, canRedo, onUndo, onRedo, saving, onSave, onCancel,
}: MarkupToolbarProps) {
    return (
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
                        onClick={() => onToolChange(item.tool)}
                        className={`join-item btn btn-sm ${tool === item.tool ? 'btn-active btn-primary' : ''}`}
                    >
                        <item.icon size={18} />
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
                        onClick={() => onColorChange(swatch)}
                        className={`size-6 rounded-full border ${color === swatch ? 'ring-2 ring-accent ring-offset-2 ring-offset-panel' : 'border-line'}`}
                        style={{ background: swatch }}
                    />
                ))}
            </div>

            <div className="flex gap-1">
                <button type="button" onClick={onUndo} disabled={!hasShapes} title="Undo (⌘Z)" className="btn btn-ghost btn-sm btn-square"><Undo2 size={18} /></button>
                <button type="button" onClick={onRedo} disabled={!canRedo} title="Redo (⇧⌘Z)" className="btn btn-ghost btn-sm btn-square"><Redo2 size={18} /></button>
            </div>

            <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => onSave('replace')} disabled={!hasShapes || saving !== null} className="btn btn-sm">
                    {saving === 'replace' && <span className="loading loading-spinner loading-xs" />}
                    Replace original
                </button>
                <button type="button" onClick={() => onSave('copy')} disabled={!hasShapes || saving !== null} className="btn btn-primary btn-sm">
                    {saving === 'copy' && <span className="loading loading-spinner loading-xs" />}
                    Save as new drop
                </button>
            </div>
        </header>
    );
}
