import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import Observation
import SwiftUI

enum AnnotationTool: String, CaseIterable, Identifiable {
    case arrow
    case line
    case rectangle
    case filledRectangle
    case ellipse
    case pen
    case highlighter
    case text
    case pixelate
    case step
    case emoji

    var id: String { rawValue }

    var title: String {
        switch self {
        case .arrow: "Arrow"
        case .line: "Line"
        case .rectangle: "Rectangle"
        case .filledRectangle: "Filled rectangle"
        case .ellipse: "Ellipse"
        case .pen: "Pen"
        case .highlighter: "Highlighter"
        case .text: "Text"
        case .pixelate: "Pixelate"
        case .step: "Step number"
        case .emoji: "Emoji"
        }
    }

    var symbol: String {
        switch self {
        case .arrow: "arrow.up.right"
        case .line: "line.diagonal"
        case .rectangle: "rectangle"
        case .filledRectangle: "rectangle.fill"
        case .ellipse: "circle"
        case .pen: "scribble"
        case .highlighter: "highlighter"
        case .text: "textformat"
        case .pixelate: "mosaic"
        case .step: "1.circle"
        case .emoji: "face.smiling"
        }
    }

    var shortcut: KeyEquivalent {
        switch self {
        case .arrow: "a"
        case .line: "l"
        case .rectangle: "r"
        case .filledRectangle: "f"
        case .ellipse: "o"
        case .pen: "p"
        case .highlighter: "h"
        case .text: "t"
        case .pixelate: "x"
        case .step: "n"
        case .emoji: "j"
        }
    }
}

struct Annotation: Identifiable, Equatable {
    let id = UUID()
    var tool: AnnotationTool
    var points: [CGPoint]
    var color: Color
    var lineWidth: CGFloat
    var text: String = ""
    var fontSize: CGFloat = 24
    var stepNumber: Int = 0
    var emoji: String?

    var start: CGPoint { points.first ?? .zero }
    var end: CGPoint { points.last ?? .zero }

    var rect: CGRect {
        CGRect(
            x: min(start.x, end.x),
            y: min(start.y, end.y),
            width: abs(end.x - start.x),
            height: abs(end.y - start.y)
        )
    }
}

@Observable
final class AnnotationDocument {
    let sourceURL: URL
    let image: NSImage
    let pixelatedImage: NSImage
    let canvasSize: CGSize

    var annotations: [Annotation] = []
    var tool: AnnotationTool = .arrow
    var color: Color = .red
    var lineWidth: CGFloat = 4
    var fontSize: CGFloat = 24
    var emoji = "👍"
    var draft: Annotation?
    var editingTextID: UUID?

    private var undoStack: [[Annotation]] = []
    private var redoStack: [[Annotation]] = []

    init?(url: URL) {
        guard let image = NSImage(contentsOf: url) else {
            return nil
        }

        sourceURL = url
        self.image = image
        canvasSize = image.size
        pixelatedImage = Self.pixelate(image) ?? image
    }

    var canUndo: Bool { !undoStack.isEmpty }
    var canRedo: Bool { !redoStack.isEmpty }

    func commit(_ change: (inout [Annotation]) -> Void) {
        undoStack.append(annotations)
        redoStack.removeAll()
        change(&annotations)
    }

    func placeEmoji(at point: CGPoint) {
        guard !emoji.isEmpty else {
            return
        }

        editingTextID = nil
        let annotation = Annotation(tool: .emoji, points: [point], color: color, lineWidth: lineWidth, fontSize: fontSize, emoji: emoji)
        commit { $0.append(annotation) }
    }

    func undo() {
        guard let previous = undoStack.popLast() else {
            return
        }

        redoStack.append(annotations)
        annotations = previous
        editingTextID = nil
    }

    func redo() {
        guard let next = redoStack.popLast() else {
            return
        }

        undoStack.append(annotations)
        annotations = next
    }

    var nextStepNumber: Int {
        (annotations.filter { $0.tool == .step }.map(\.stepNumber).max() ?? 0) + 1
    }

    func deleteLast() {
        if annotations.isEmpty {
            return
        }

        commit { $0.removeLast() }
    }

    /// Flattens the image and annotations at the image's full pixel resolution.
    func renderPNG() -> Data? {
        let pixelWidth = image.representations.map(\.pixelsWide).max() ?? Int(canvasSize.width)
        let renderer = ImageRenderer(content: AnnotationCanvas(document: self, interactive: false).frame(width: canvasSize.width, height: canvasSize.height))
        renderer.scale = CGFloat(pixelWidth) / canvasSize.width

        guard let cgImage = renderer.cgImage else {
            return nil
        }

        let bitmap = NSBitmapImageRep(cgImage: cgImage)
        bitmap.size = canvasSize

        return bitmap.representation(using: .png, properties: [:])
    }

    private static func pixelate(_ image: NSImage) -> NSImage? {
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }

        let input = CIImage(cgImage: cgImage)
        let filter = CIFilter.pixellate()
        filter.inputImage = input.clampedToExtent()
        filter.scale = Float(max(input.extent.width, input.extent.height) / 80)
        filter.center = .zero

        guard let output = filter.outputImage?.cropped(to: input.extent),
              let rendered = CIContext().createCGImage(output, from: input.extent) else {
            return nil
        }

        return NSImage(cgImage: rendered, size: image.size)
    }
}
