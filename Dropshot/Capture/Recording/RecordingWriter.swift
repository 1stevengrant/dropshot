import AVFoundation
import ScreenCaptureKit
import Synchronization

/// Writes a capture stream to a QuickTime movie: one H.264 video track plus separate system audio and microphone tracks.
/// Every sample arrives on `queue`, so the writer state is only touched there; pause and mute are the only inputs set
/// from outside and live behind a mutex.
nonisolated final class RecordingWriter: NSObject, SCStreamOutput, @unchecked Sendable {
    let queue = DispatchQueue(label: "nz.ghijk.dropshot.recording")
    let url: URL

    private struct Controls {
        var isPaused = false
        var isMuted = false
    }

    private let controls = Mutex(Controls())
    private let writer: AVAssetWriter
    private let video: AVAssetWriterInput
    private let systemAudio: AVAssetWriterInput?
    private let microphone: AVAssetWriterInput?
    private var clock = RecordingClock()
    private var hasStarted = false

    init(url: URL, videoSize: CGSize, systemAudio recordsSystemAudio: Bool, microphoneChannels: Int?) throws {
        self.url = url
        writer = try AVAssetWriter(outputURL: url, fileType: .mov)

        let codec = Self.codec(for: videoSize)
        var compression: [String: Any] = [AVVideoExpectedSourceFrameRateKey: 60]

        if codec == .h264 {
            compression[AVVideoProfileLevelKey] = AVVideoProfileLevelH264HighAutoLevel
        }

        video = AVAssetWriterInput(mediaType: .video, outputSettings: [
            AVVideoCodecKey: codec,
            AVVideoWidthKey: Int(videoSize.width),
            AVVideoHeightKey: Int(videoSize.height),
            AVVideoCompressionPropertiesKey: compression,
        ])
        video.expectsMediaDataInRealTime = true
        systemAudio = recordsSystemAudio ? Self.audioInput(channels: 2) : nil
        microphone = microphoneChannels.map { Self.audioInput(channels: $0) }

        super.init()

        for input in [video, systemAudio, microphone].compactMap(\.self) where writer.canAdd(input) {
            writer.add(input)
        }
    }

    /// H.264 plays everywhere but its hardware encoder stops at 4096 × 2304, so larger captures (a whole 5K display)
    /// are written as HEVC.
    static func codec(for size: CGSize) -> AVVideoCodecType {
        size.width > 4096 || size.height > 2304 ? .hevc : .h264
    }

    private static func audioInput(channels: Int) -> AVAssetWriterInput {
        let channels = min(max(channels, 1), 2)
        var layout = AudioChannelLayout()
        layout.mChannelLayoutTag = channels == 1 ? kAudioChannelLayoutTag_Mono : kAudioChannelLayoutTag_Stereo

        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 48_000,
            AVNumberOfChannelsKey: channels,
            AVChannelLayoutKey: Data(bytes: &layout, count: MemoryLayout<AudioChannelLayout>.size),
            AVEncoderBitRateKey: channels * 64_000,
        ])
        input.expectsMediaDataInRealTime = true

        return input
    }

    func setPaused(_ paused: Bool) {
        controls.withLock { $0.isPaused = paused }
    }

    func setMuted(_ muted: Bool) {
        controls.withLock { $0.isMuted = muted }
    }

    // MARK: - Samples

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard sampleBuffer.isValid, writer.status != .failed, writer.status != .cancelled else {
            return
        }

        let time = sampleBuffer.presentationTimeStamp.seconds
        let current = controls.withLock { $0 }

        if type == .screen {
            guard Self.isCompleteFrame(sampleBuffer) else {
                return
            }

            startIfNeeded(at: sampleBuffer.presentationTimeStamp)
        }

        guard hasStarted else {
            return
        }

        if current.isPaused {
            clock.pause(at: time)
        } else {
            clock.resume(at: time)
        }

        guard clock.includes(time) else {
            return
        }

        switch type {
        case .screen:
            append(sampleBuffer, to: video)
        case .audio:
            append(sampleBuffer, to: systemAudio)
        case .microphone:
            append(current.isMuted ? Self.silenced(sampleBuffer) : sampleBuffer, to: microphone)
        @unknown default:
            break
        }
    }

    private func startIfNeeded(at time: CMTime) {
        if hasStarted {
            return
        }

        guard writer.startWriting() else {
            return
        }

        writer.startSession(atSourceTime: time)
        clock.start(at: time.seconds)
        hasStarted = true
    }

    private func append(_ sampleBuffer: CMSampleBuffer?, to input: AVAssetWriterInput?) {
        guard let input, let sampleBuffer, input.isReadyForMoreMediaData else {
            return
        }

        let offset = CMTime(seconds: clock.pausedDuration, preferredTimescale: 1_000_000_000)

        guard let retimed = offset == .zero ? sampleBuffer : Self.retimed(sampleBuffer, by: offset) else {
            return
        }

        input.append(retimed)
    }

    /// ScreenCaptureKit also sends idle and blank frames, which carry no image.
    private static func isCompleteFrame(_ sampleBuffer: CMSampleBuffer) -> Bool {
        guard
            let attachments = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
            let rawStatus = attachments.first?[.status] as? Int,
            let status = SCFrameStatus(rawValue: rawStatus)
        else {
            return false
        }

        return status == .complete && sampleBuffer.imageBuffer != nil
    }

    static func retimed(_ sampleBuffer: CMSampleBuffer, by offset: CMTime) -> CMSampleBuffer? {
        var count: CMItemCount = 0
        CMSampleBufferGetSampleTimingInfoArray(sampleBuffer, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count)

        var timing = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
        CMSampleBufferGetSampleTimingInfoArray(sampleBuffer, entryCount: count, arrayToFill: &timing, entriesNeededOut: &count)

        for index in timing.indices {
            timing[index].presentationTimeStamp = timing[index].presentationTimeStamp - offset

            if timing[index].decodeTimeStamp.isValid {
                timing[index].decodeTimeStamp = timing[index].decodeTimeStamp - offset
            }
        }

        var copy: CMSampleBuffer?
        CMSampleBufferCreateCopyWithNewTiming(allocator: nil, sampleBuffer: sampleBuffer, sampleTimingEntryCount: count, sampleTimingArray: &timing, sampleBufferOut: &copy)

        return copy
    }

    /// The same audio with every sample zeroed, which is silence for linear PCM.
    static func silenced(_ sampleBuffer: CMSampleBuffer) -> CMSampleBuffer? {
        guard let source = sampleBuffer.dataBuffer, let format = sampleBuffer.formatDescription else {
            return nil
        }

        let length = CMBlockBufferGetDataLength(source)
        var block: CMBlockBuffer?

        guard
            CMBlockBufferCreateWithMemoryBlock(allocator: nil, memoryBlock: nil, blockLength: length, blockAllocator: nil, customBlockSource: nil, offsetToData: 0, dataLength: length, flags: kCMBlockBufferAssureMemoryNowFlag, blockBufferOut: &block) == noErr,
            let block,
            CMBlockBufferFillDataBytes(with: 0, blockBuffer: block, offsetIntoDestination: 0, dataLength: length) == noErr
        else {
            return nil
        }

        var silent: CMSampleBuffer?
        CMAudioSampleBufferCreateReadyWithPacketDescriptions(allocator: nil, dataBuffer: block, formatDescription: format, sampleCount: sampleBuffer.numSamples, presentationTimeStamp: sampleBuffer.presentationTimeStamp, packetDescriptions: nil, sampleBufferOut: &silent)

        return silent
    }

    // MARK: - Finishing

    /// Closes the movie. Throws when no frame was ever captured, so there is nothing to upload.
    func finish() async throws -> URL {
        let started = queue.sync { hasStarted }

        guard started else {
            cancel()

            throw CaptureError.failed("Nothing was recorded.")
        }

        let writer = self.writer

        queue.sync {
            [video, systemAudio, microphone].compactMap(\.self).forEach { $0.markAsFinished() }
        }

        await writer.finishWriting()

        if writer.status != .completed {
            throw writer.error ?? CaptureError.failed("Couldn't finish writing the recording.")
        }

        return url
    }

    func cancel() {
        queue.sync {
            if writer.status == .writing {
                writer.cancelWriting()
            }
        }

        try? FileManager.default.removeItem(at: url)
    }
}
