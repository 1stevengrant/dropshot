import Foundation

/// Pause bookkeeping for a recording, in seconds on any one clock. The recorder runs it on wall time for the elapsed
/// time shown in the menu bar; the writer runs it on sample timestamps to drop paused media and close the gap.
nonisolated struct RecordingClock {
    private(set) var startedAt: Double?
    private(set) var pausedAt: Double?
    private(set) var resumedAt: Double?
    /// Total time spent paused so far. Subtracting it from a timestamp removes every pause before it.
    private(set) var pausedDuration: Double = 0

    var isPaused: Bool { pausedAt != nil }

    mutating func start(at time: Double) {
        startedAt = time
        pausedAt = nil
        resumedAt = nil
        pausedDuration = 0
    }

    mutating func pause(at time: Double) {
        guard startedAt != nil, pausedAt == nil else {
            return
        }

        pausedAt = time
    }

    mutating func resume(at time: Double) {
        guard let pausedAt else {
            return
        }

        pausedDuration += max(time - pausedAt, 0)
        self.pausedAt = nil
        resumedAt = time
    }

    /// Recorded time so far, excluding pauses.
    func elapsed(at time: Double) -> Double {
        guard let startedAt else {
            return 0
        }

        return max((pausedAt ?? time) - startedAt - pausedDuration, 0)
    }

    /// Whether media stamped `time` belongs in the recording: after the start and the last resume, and before a pause
    /// in progress. Audio arrives slightly behind video, so a late buffer from inside a pause is dropped here too.
    func includes(_ time: Double) -> Bool {
        guard let startedAt, time >= startedAt else {
            return false
        }

        if let resumedAt, time < resumedAt {
            return false
        }

        if let pausedAt, time >= pausedAt {
            return false
        }

        return true
    }

    /// Where media stamped `time` lands in the finished file, with the pauses taken out.
    func adjusted(_ time: Double) -> Double {
        time - pausedDuration
    }
}
