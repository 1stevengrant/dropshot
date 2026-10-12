import XCTest
@testable import Dropshot

@MainActor
final class ScreenshotWatcherTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_000_000)
    private let captures = URL(filePath: "/Users/me/Library/Application Support/Dropshot/Captures", directoryHint: .isDirectory)
    private let desktop = "/Users/me/Desktop/Screenshot 2026-10-12 at 10.00.00.png"

    func testUploadsANewScreenshot() {
        XCTAssertTrue(ScreenshotWatcher.shouldUpload(path: desktop, created: now.addingTimeInterval(-2), now: now, lastSeen: nil, capturesDirectory: captures))
    }

    func testSkipsOldScreenshots() {
        XCTAssertFalse(ScreenshotWatcher.shouldUpload(path: desktop, created: now.addingTimeInterval(-11), now: now, lastSeen: nil, capturesDirectory: captures))
    }

    func testSkipsTheLastItemSeen() {
        XCTAssertFalse(ScreenshotWatcher.shouldUpload(path: desktop, created: now, now: now, lastSeen: desktop, capturesDirectory: captures))
    }

    func testSkipsDropshotsOwnCaptures() {
        let own = captures.appending(path: "ABC/Screenshot.png").path
        XCTAssertFalse(ScreenshotWatcher.shouldUpload(path: own, created: now, now: now, lastSeen: nil, capturesDirectory: captures))
    }

    func testSkipsHiddenFiles() {
        XCTAssertFalse(ScreenshotWatcher.shouldUpload(path: "/Users/me/Desktop/.Screenshot 2026-10-12.png", created: now, now: now, lastSeen: nil, capturesDirectory: captures))
    }
}
