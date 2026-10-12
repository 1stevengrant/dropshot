import SwiftUI

struct AnnotationCanvas: View {
    @Bindable var document: AnnotationDocument
    var interactive = true

    var body: some View {
        ZStack(alignment: .topLeading) {
            Canvas { context, size in
                context.draw(Image(nsImage: document.image), in: CGRect(origin: .zero, size: size))

                let visible = document.annotations + (document.draft.map { [$0] } ?? [])

                for annotation in visible {
                    draw(annotation, in: &context)
                }
            }
            .frame(width: document.canvasSize.width, height: document.canvasSize.height)
            .gesture(interactive ? drawingGesture : nil)

            if interactive {
                textEditors
            }
        }
    }

    private var drawingGesture: some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .local)
            .onChanged { value in
                if document.tool == .text || document.tool == .step || document.tool == .emoji {
                    return
                }

                if document.draft == nil {
                    document.editingTextID = nil
                    document.draft = Annotation(
                        tool: document.tool,
                        points: [value.startLocation],
                        color: document.color,
                        lineWidth: document.tool == .highlighter ? document.lineWidth * 4 : document.lineWidth
                    )
                }

                if document.tool == .pen || document.tool == .highlighter {
                    document.draft?.points.append(value.location)

                    return
                }

                document.draft?.points = [value.startLocation, value.location]
            }
            .onEnded { value in
                switch document.tool {
                case .text:
                    placeText(at: value.location)
                case .step:
                    placeStep(at: value.location)
                case .emoji:
                    document.placeEmoji(at: value.location)
                default:
                    commitDraft()
                }
            }
    }

    private func commitDraft() {
        guard let draft = document.draft else {
            return
        }

        document.draft = nil

        let isDot = hypot(draft.end.x - draft.start.x, draft.end.y - draft.start.y) < 3

        if isDot && draft.tool != .pen {
            return
        }

        document.commit { $0.append(draft) }
    }

    private func placeText(at point: CGPoint) {
        if document.editingTextID != nil {
            document.editingTextID = nil

            return
        }

        let annotation = Annotation(
            tool: .text,
            points: [point],
            color: document.color,
            lineWidth: document.lineWidth,
            fontSize: document.fontSize
        )

        document.commit { $0.append(annotation) }
        document.editingTextID = annotation.id
    }

    private func placeStep(at point: CGPoint) {
        let annotation = Annotation(
            tool: .step,
            points: [point],
            color: document.color,
            lineWidth: document.lineWidth,
            fontSize: document.fontSize,
            stepNumber: document.nextStepNumber
        )

        document.commit { $0.append(annotation) }
    }

    @ViewBuilder
    private var textEditors: some View {
        if let id = document.editingTextID, let index = document.annotations.firstIndex(where: { $0.id == id }) {
            let annotation = document.annotations[index]

            TextField("Text", text: $document.annotations[index].text, axis: .vertical)
                .textFieldStyle(.plain)
                .font(.system(size: annotation.fontSize, weight: .bold))
                .foregroundStyle(annotation.color)
                .fixedSize()
                .frame(minWidth: 40, alignment: .leading)
                .padding(2)
                .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(.secondary, style: StrokeStyle(lineWidth: 1, dash: [4])))
                .offset(x: annotation.start.x, y: annotation.start.y - annotation.fontSize * 0.6)
                .onSubmit { document.editingTextID = nil }
        }
    }

    private func draw(_ annotation: Annotation, in context: inout GraphicsContext) {
        let shading = GraphicsContext.Shading.color(annotation.color)
        let style = StrokeStyle(lineWidth: annotation.lineWidth, lineCap: .round, lineJoin: .round)

        switch annotation.tool {
        case .arrow:
            context.stroke(arrowShaft(annotation), with: shading, style: style)
            context.fill(arrowHead(annotation), with: shading)
        case .line:
            context.stroke(Path { $0.move(to: annotation.start); $0.addLine(to: annotation.end) }, with: shading, style: style)
        case .rectangle:
            context.stroke(Path(roundedRect: annotation.rect, cornerRadius: 2), with: shading, style: style)
        case .filledRectangle:
            context.fill(Path(roundedRect: annotation.rect, cornerRadius: 2), with: shading)
        case .ellipse:
            context.stroke(Path(ellipseIn: annotation.rect), with: shading, style: style)
        case .pen:
            context.stroke(freehand(annotation.points), with: shading, style: style)
        case .highlighter:
            var layer = context
            layer.opacity = 0.35
            layer.blendMode = .multiply
            layer.stroke(freehand(annotation.points), with: shading, style: StrokeStyle(lineWidth: annotation.lineWidth, lineCap: .butt, lineJoin: .round))
        case .pixelate:
            var clipped = context
            clipped.clip(to: Path(annotation.rect))
            clipped.draw(Image(nsImage: document.pixelatedImage), in: CGRect(origin: .zero, size: document.canvasSize))
        case .text:
            if annotation.id == document.editingTextID && interactive {
                return
            }

            let text = Text(annotation.text).font(.system(size: annotation.fontSize, weight: .bold)).foregroundStyle(annotation.color)
            var shadowed = context
            shadowed.addFilter(.shadow(color: .black.opacity(0.4), radius: 2, y: 1))
            shadowed.draw(text, at: CGPoint(x: annotation.start.x + 2, y: annotation.start.y), anchor: .leading)
        case .emoji:
            context.draw(Text(annotation.emoji ?? "👍").font(.system(size: annotation.fontSize * 2)), at: annotation.start)
        case .step:
            let diameter = max(annotation.fontSize * 1.3, 24)
            let circle = CGRect(x: annotation.start.x - diameter / 2, y: annotation.start.y - diameter / 2, width: diameter, height: diameter)
            context.fill(Path(ellipseIn: circle), with: shading)
            context.draw(
                Text("\(annotation.stepNumber)").font(.system(size: diameter * 0.55, weight: .heavy)).foregroundStyle(.white),
                at: CGPoint(x: circle.midX, y: circle.midY)
            )
        }
    }

    private func freehand(_ points: [CGPoint]) -> Path {
        Path { path in
            guard let first = points.first else {
                return
            }

            path.move(to: first)

            for point in points.dropFirst() {
                path.addLine(to: point)
            }
        }
    }

    private func arrowGeometry(_ annotation: Annotation) -> (angle: CGFloat, headLength: CGFloat) {
        let angle = atan2(annotation.end.y - annotation.start.y, annotation.end.x - annotation.start.x)

        return (angle, max(annotation.lineWidth * 4, 14))
    }

    private func arrowShaft(_ annotation: Annotation) -> Path {
        let (angle, headLength) = arrowGeometry(annotation)
        let shaftEnd = CGPoint(
            x: annotation.end.x - cos(angle) * headLength * 0.8,
            y: annotation.end.y - sin(angle) * headLength * 0.8
        )

        return Path { $0.move(to: annotation.start); $0.addLine(to: shaftEnd) }
    }

    private func arrowHead(_ annotation: Annotation) -> Path {
        let (angle, headLength) = arrowGeometry(annotation)
        let spread = CGFloat.pi / 7

        return Path { path in
            path.move(to: annotation.end)
            path.addLine(to: CGPoint(x: annotation.end.x - cos(angle - spread) * headLength, y: annotation.end.y - sin(angle - spread) * headLength))
            path.addLine(to: CGPoint(x: annotation.end.x - cos(angle + spread) * headLength, y: annotation.end.y - sin(angle + spread) * headLength))
            path.closeSubpath()
        }
    }
}
