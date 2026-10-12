import XCTest
@testable import Dropshot

final class DropHTMLTests: XCTestCase {
    @MainActor
    func testEscapesImageFilenameAndURLAttributes() {
        let drop = fixture(filename: "A\" title=\"B & C.png", kind: .image)
        XCTAssertEqual(drop.clipboardHTML, "<img src=\"https://example.com/raw?a=1&amp;b=2\" alt=\"A&quot; title=&quot;B &amp; C.png\">")
    }

    @MainActor
    func testEscapesLinkTextAndUsesPageURL() {
        let drop = fixture(filename: "<b>report's.txt", kind: .file)
        XCTAssertEqual(drop.clipboardHTML, "<a href=\"https://example.com/page?a=1&amp;b=2\">&lt;b&gt;report&#39;s.txt</a>")
    }

    @MainActor
    func testImageFallsBackToPageURL() {
        var drop = fixture(filename: "image.png", kind: .image)
        drop.directURL = nil
        XCTAssertTrue(drop.clipboardHTML.contains("src=\"https://example.com/page?a=1&amp;b=2\""))
    }

    @MainActor
    private func fixture(filename: String, kind: DropKind) -> Drop {
        Drop(id: "html123", filename: filename, kind: kind,
             url: URL(string: "https://example.com/page?a=1&b=2")!,
             directURL: URL(string: "https://example.com/raw?a=1&b=2")!,
             objectKey: "html123/file", byteCount: 0, createdAt: .now)
    }
}
