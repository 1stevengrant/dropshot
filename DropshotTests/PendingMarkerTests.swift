import XCTest
@testable import Dropshot

final class PendingMarkerTests: XCTestCase {
    /// The Worker looks for `<prefix>/_pending/<id>`, and bucket sync skips it because it starts with `_`.
    func testMarkerKeySitsUnderThePrefix() {
        XCTAssertEqual(S3Uploader.pendingMarkerKey(prefix: "", dropId: "abc123"), "_pending/abc123")
        XCTAssertEqual(S3Uploader.pendingMarkerKey(prefix: "drops", dropId: "abc123"), "drops/_pending/abc123")
    }
}
