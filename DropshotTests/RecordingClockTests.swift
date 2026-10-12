import AVFoundation
import XCTest
@testable import Dropshot

final class RecordingClockTests: XCTestCase {
    func testElapsedIsZeroBeforeStarting() {
        XCTAssertEqual(RecordingClock().elapsed(at: 50), 0)
    }

    func testElapsedCountsFromTheStart() {
        var clock = RecordingClock()
        clock.start(at: 100)

        XCTAssertEqual(clock.elapsed(at: 112), 12)
    }

    func testElapsedExcludesPauses() {
        var clock = RecordingClock()
        clock.start(at: 100)
        clock.pause(at: 110)
        clock.resume(at: 115)

        XCTAssertEqual(clock.pausedDuration, 5)
        XCTAssertEqual(clock.elapsed(at: 120), 15)
    }

    func testElapsedStandsStillWhilePaused() {
        var clock = RecordingClock()
        clock.start(at: 100)
        clock.pause(at: 110)

        XCTAssertTrue(clock.isPaused)
        XCTAssertEqual(clock.elapsed(at: 130), 10)
    }

    func testRepeatedPausesAddUp() {
        var clock = RecordingClock()
        clock.start(at: 0)
        clock.pause(at: 10)
        clock.resume(at: 12)
        clock.pause(at: 20)
        clock.pause(at: 25)
        clock.resume(at: 30)

        XCTAssertEqual(clock.pausedDuration, 12)
        XCTAssertEqual(clock.elapsed(at: 40), 28)
    }

    func testResumeWithoutPauseChangesNothing() {
        var clock = RecordingClock()
        clock.start(at: 0)
        clock.resume(at: 5)

        XCTAssertEqual(clock.pausedDuration, 0)
        XCTAssertFalse(clock.isPaused)
    }

    func testPauseBeforeStartIsIgnored() {
        var clock = RecordingClock()
        clock.pause(at: 5)

        XCTAssertFalse(clock.isPaused)
    }

    func testIncludesOnlyMediaOutsidePauses() {
        var clock = RecordingClock()
        clock.start(at: 100)

        XCTAssertFalse(clock.includes(99))
        XCTAssertTrue(clock.includes(100))

        clock.pause(at: 110)

        XCTAssertTrue(clock.includes(109.9), "media from before the pause that arrives late is kept")
        XCTAssertFalse(clock.includes(112))

        clock.resume(at: 115)

        XCTAssertFalse(clock.includes(113), "audio from inside the pause that arrives after resuming is dropped")
        XCTAssertTrue(clock.includes(115))
    }

    func testAdjustedClosesTheGap() {
        var clock = RecordingClock()
        clock.start(at: 100)

        XCTAssertEqual(clock.adjusted(109), 109)

        clock.pause(at: 110)
        clock.resume(at: 115)

        XCTAssertEqual(clock.adjusted(116), 111)
    }

    func testCodecSwitchesToHEVCAboveH264Limits() {
        XCTAssertEqual(RecordingWriter.codec(for: CGSize(width: 3024, height: 1964)), .h264)
        XCTAssertEqual(RecordingWriter.codec(for: CGSize(width: 5120, height: 2880)), .hevc)
    }
}
