import AppKit
import AVFoundation
import Observation
import ScreenCaptureKit

/// One recording at a time through ScreenCaptureKit: pick an area, count down, record (with pause and mute), finish.
/// `isRecording` stays true from the countdown until the movie is written, so the menu bar shows the session throughout.
@Observable
final class ScreenRecorder: NSObject, SCStreamDelegate {
    static let shared = ScreenRecorder()

    enum State {
        case idle
        case countdown
        case recording
        case paused
        case finishing
    }

    private(set) var state = State.idle
    private(set) var isMuted = false
    private(set) var hasMicrophone = false

    var isRecording: Bool { state != .idle }
    var isPaused: Bool { state == .paused }

    @ObservationIgnored private var clock = RecordingClock()
    @ObservationIgnored private var isPicking = false
    @ObservationIgnored private var isCancelled = false
    @ObservationIgnored private var countdown: Task<Void, Error>?
    @ObservationIgnored private var ending: CheckedContinuation<Bool, Never>?
    @ObservationIgnored private var writer: RecordingWriter?
    @ObservationIgnored private var controlBar: RecordingControlBar?

    /// Recorded time so far, excluding pauses.
    func elapsed(at date: Date = .now) -> TimeInterval {
        clock.elapsed(at: date.timeIntervalSinceReferenceDate)
    }

    static func format(_ elapsed: TimeInterval) -> String {
        let seconds = Int(elapsed)

        return String(format: "%d:%02d", seconds / 60, seconds % 60)
    }

    /// Returns the finished movie, or nil when the user cancels at any point.
    func record(microphone: String, systemAudio: Bool, showClicks: Bool, countdown seconds: Int) async throws -> URL? {
        guard state == .idle, !isPicking else {
            return nil
        }

        try SystemCapture.ensurePermission()

        isPicking = true
        let picked: RecordingTarget?

        do {
            picked = try await RecordingRegionPicker.pick()
            isPicking = false
        } catch {
            isPicking = false

            throw error
        }

        guard let target = picked else {
            return nil
        }

        state = .countdown
        hasMicrophone = microphone != MicrophoneChoice.none

        defer { reset() }

        if seconds > 0 {
            let countdown = Task { try await CountdownOverlay.run(seconds: seconds, over: target.frame) }
            self.countdown = countdown

            guard (try? await countdown.value) != nil else {
                return nil
            }
        }

        if isCancelled {
            return nil
        }

        let (stream, writer) = try await makeStream(for: target, microphone: microphone, systemAudio: systemAudio, showClicks: showClicks)
        self.writer = writer

        do {
            try await stream.startCapture()
        } catch {
            writer.cancel()

            throw error
        }

        if isCancelled {
            try? await stream.stopCapture()
            writer.cancel()

            return nil
        }

        clock.start(at: Date.now.timeIntervalSinceReferenceDate)
        state = .recording
        controlBar = RecordingControlBar(beside: target.frame)

        let keep = await withCheckedContinuation { ending = $0 }

        controlBar?.close()
        try? await stream.stopCapture()

        guard keep else {
            writer.cancel()

            return nil
        }

        return try await RecordingMixdown.mix(writer.finish())
    }

    private func makeStream(for target: RecordingTarget, microphone: String, systemAudio: Bool, showClicks: Bool) async throws -> (SCStream, RecordingWriter) {
        let info = SCShareableContent.info(for: target.filter)
        let points = target.sourceRect?.size ?? info.contentRect.size
        let scale = CGFloat(info.pointPixelScale)
        let pixels = CGSize(width: Self.even(points.width * scale), height: Self.even(points.height * scale))

        let configuration = SCStreamConfiguration()
        configuration.width = Int(pixels.width)
        configuration.height = Int(pixels.height)
        configuration.minimumFrameInterval = CMTime(value: 1, timescale: 60)
        configuration.pixelFormat = kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        configuration.queueDepth = 8
        configuration.showsCursor = true
        configuration.showMouseClicks = showClicks
        configuration.capturesAudio = systemAudio
        configuration.excludesCurrentProcessAudio = true
        configuration.sampleRate = 48_000
        configuration.channelCount = 2
        configuration.captureMicrophone = hasMicrophone
        configuration.microphoneCaptureDeviceID = microphone == MicrophoneChoice.systemDefault ? nil : microphone

        if let sourceRect = target.sourceRect {
            configuration.sourceRect = sourceRect
        }

        let url = try UploadCoordinator.captureFile(named: "Recording \(UploadCoordinator.timestamp()).mov")
        let writer = try RecordingWriter(
            url: url,
            videoSize: pixels,
            systemAudio: systemAudio,
            microphoneChannels: hasMicrophone ? MicrophoneChoice.channelCount(for: microphone) : nil
        )

        let stream = SCStream(filter: target.filter, configuration: configuration, delegate: self)
        try stream.addStreamOutput(writer, type: .screen, sampleHandlerQueue: writer.queue)

        if systemAudio {
            try stream.addStreamOutput(writer, type: .audio, sampleHandlerQueue: writer.queue)
        }

        if hasMicrophone {
            try stream.addStreamOutput(writer, type: .microphone, sampleHandlerQueue: writer.queue)
        }

        return (stream, writer)
    }

    /// Video encoders need even dimensions.
    private static func even(_ value: CGFloat) -> CGFloat {
        max(2, (value / 2).rounded(.down) * 2)
    }

    // MARK: - Controls

    /// Stops and keeps the recording. Before recording has started there is nothing to keep, so it cancels.
    func finish() {
        guard state == .recording || state == .paused else {
            cancel()

            return
        }

        end(keeping: true)
    }

    /// Stops and throws the recording away.
    func cancel() {
        switch state {
        case .idle, .finishing:
            return
        case .countdown:
            isCancelled = true
            countdown?.cancel()
        case .recording, .paused:
            end(keeping: false)
        }
    }

    func togglePause() {
        let now = Date.now.timeIntervalSinceReferenceDate

        switch state {
        case .recording:
            clock.pause(at: now)
            writer?.setPaused(true)
            state = .paused
        case .paused:
            clock.resume(at: now)
            writer?.setPaused(false)
            state = .recording
        default:
            return
        }
    }

    func toggleMute() {
        guard hasMicrophone, state == .recording || state == .paused else {
            return
        }

        isMuted.toggle()
        writer?.setMuted(isMuted)
    }

    private func end(keeping: Bool) {
        if state == .paused {
            clock.resume(at: Date.now.timeIntervalSinceReferenceDate)
        }

        clock.pause(at: Date.now.timeIntervalSinceReferenceDate)
        state = .finishing
        ending?.resume(returning: keeping)
        ending = nil
    }

    private func reset() {
        controlBar?.close()
        controlBar = nil
        countdown = nil
        writer = nil
        clock = RecordingClock()
        isCancelled = false
        isMuted = false
        hasMicrophone = false
        state = .idle
    }

    /// The stream stops on its own when the display goes away or the user stops sharing from the system menu.
    /// Whatever was recorded until then is kept.
    nonisolated func stream(_ stream: SCStream, didStopWithError error: any Error) {
        Task { @MainActor in
            self.finish()
        }
    }
}
