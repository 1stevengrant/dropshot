import XCTest
@testable import Dropshot

final class WebCaptureURLTests: XCTestCase {
    func testAddsHttpsToABareHost() {
        XCTAssertEqual(WebCaptureURL.parse("example.com")?.absoluteString, "https://example.com")
    }

    func testKeepsAFullURLAndTrimsWhitespace() {
        XCTAssertEqual(WebCaptureURL.parse("  http://example.com/a?b=1\n")?.absoluteString, "http://example.com/a?b=1")
    }

    func testRejectsOtherSchemes() {
        XCTAssertNil(WebCaptureURL.parse("ftp://example.com"))
        XCTAssertNil(WebCaptureURL.parse("file:///etc/hosts"))
    }

    func testRejectsTextThatIsNotAURL() {
        XCTAssertNil(WebCaptureURL.parse(""))
        XCTAssertNil(WebCaptureURL.parse("hello world"))
        XCTAssertNil(WebCaptureURL.parse("hello"))
    }

    func testAllowsLocalhost() {
        XCTAssertEqual(WebCaptureURL.parse("localhost:3000")?.host(), "localhost")
    }

    func testPercentEncodesMetadataSoHeadersStayASCII() {
        XCTAssertEqual(S3Uploader.metadataValue("Café — 100%"), "Caf%C3%A9%20%E2%80%94%20100%25")
    }
}
