import AppKit
import XCTest
@testable import Dropshot

final class AnnotationEmojiTests: XCTestCase {
    @MainActor
    func testEmojiPlacementUndoRedoAndPNGExport() throws {
        let url = FileManager.default.temporaryDirectory.appending(path: "emoji-\(UUID().uuidString).png")
        defer { try? FileManager.default.removeItem(at: url) }
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 100, pixelsHigh: 100, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        try XCTUnwrap(bitmap.representation(using: .png, properties: [:])).write(to: url)
        let document = try XCTUnwrap(AnnotationDocument(url: url))
        let original = try XCTUnwrap(document.renderPNG())
        document.emoji = "🔥"
        document.fontSize = 36
        document.placeEmoji(at: CGPoint(x: 50, y: 50))
        XCTAssertEqual(document.annotations.count, 1)
        XCTAssertEqual(document.annotations[0].emoji, "🔥")
        XCTAssertEqual(document.annotations[0].fontSize, 36)
        XCTAssertEqual(document.annotations[0].start, CGPoint(x: 50, y: 50))
        let stamped = try XCTUnwrap(document.renderPNG())
        XCTAssertNotEqual(stamped, original)
        document.undo()
        XCTAssertTrue(document.annotations.isEmpty)
        XCTAssertEqual(document.renderPNG(), original)
        document.redo()
        XCTAssertEqual(document.annotations[0].emoji, "🔥")
        XCTAssertEqual(document.renderPNG(), stamped)
    }
}
