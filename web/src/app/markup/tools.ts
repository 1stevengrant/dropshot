import { ArrowUpRight, Circle, Grid3x3, Highlighter, type LucideIcon, Minus, PenLine, Square, Type } from 'lucide-react';

export type Tool = 'arrow' | 'line' | 'rectangle' | 'ellipse' | 'pen' | 'highlighter' | 'text' | 'pixelate';

export interface Shape {
    tool: Tool;
    points: { x: number; y: number }[];
    color: string;
    width: number;
    text?: string;
    fontSize?: number;
}

export const tools: { tool: Tool; label: string; key: string; icon: LucideIcon }[] = [
    { tool: 'arrow', label: 'Arrow', key: 'a', icon: ArrowUpRight },
    { tool: 'line', label: 'Line', key: 'l', icon: Minus },
    { tool: 'rectangle', label: 'Rectangle', key: 'r', icon: Square },
    { tool: 'ellipse', label: 'Ellipse', key: 'o', icon: Circle },
    { tool: 'pen', label: 'Pen', key: 'p', icon: PenLine },
    { tool: 'highlighter', label: 'Highlighter', key: 'h', icon: Highlighter },
    { tool: 'text', label: 'Text', key: 't', icon: Type },
    { tool: 'pixelate', label: 'Pixelate', key: 'x', icon: Grid3x3 },
];

export const colors = ['#e5484d', '#f76b15', '#ffc53d', '#30a46c', '#3b6ef5', '#8e4ec6', '#111111', '#ffffff'];
