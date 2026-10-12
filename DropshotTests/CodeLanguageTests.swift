import XCTest
@testable import Dropshot

final class CodeLanguageTests: XCTestCase {
    func testMatchesExtensionsCaseInsensitively() {
        XCTAssertEqual(CodeLanguage.matching(extension: "PY")?.label, "Python")
        XCTAssertEqual(CodeLanguage.matching(extension: "tsx")?.id, "typescript")
        XCTAssertNil(CodeLanguage.matching(extension: "png"))
        XCTAssertNil(CodeLanguage.matching(extension: "txt"))
    }

    func testCodeIsUploadedAsPlainTextSoTypeScriptIsNotTreatedAsVideo() {
        XCTAssertEqual(S3Uploader.contentType(for: "helper.ts"), "text/plain; charset=utf-8")
        XCTAssertTrue(S3Uploader.contentDisposition(for: "helper.ts").hasPrefix("inline"))
        XCTAssertEqual(S3Uploader.contentType(for: "Recording.mov"), "video/quicktime")
    }

    @MainActor
    func testSourceFilesAreClassifiedAsCode() {
        XCTAssertEqual(UploadCoordinator.kind(for: URL(filePath: "/tmp/deploy.sh")), .code)
        XCTAssertEqual(UploadCoordinator.kind(for: URL(filePath: "/tmp/notes.txt")), .text)
    }
}
