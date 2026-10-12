import type { Shape } from './tools';

export function drawShape(context: CanvasRenderingContext2D, image: HTMLImageElement, shape: Shape) {
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
