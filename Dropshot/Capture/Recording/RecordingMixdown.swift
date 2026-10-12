import AVFoundation

/// Mixes a finished recording's system audio and microphone tracks into one. Browsers only play a movie's first audio
/// track, so with separate tracks the microphone was silent on the drop page. The video is copied without re-encoding.
nonisolated enum RecordingMixdown {
    /// Rewrites `url` in place when it has more than one audio track, and returns it.
    static func mix(_ url: URL) async throws -> URL {
        let asset = AVURLAsset(url: url)
        let audioTracks = try await asset.loadTracks(withMediaType: .audio)

        guard audioTracks.count > 1, let videoTrack = try await asset.loadTracks(withMediaType: .video).first else {
            return url
        }

        let mixedURL = url.deletingLastPathComponent().appending(path: "mixed-\(UUID().uuidString).mov")
        let reader = try AVAssetReader(asset: asset)
        let writer = try AVAssetWriter(outputURL: mixedURL, fileType: .mov)

        let videoOutput = AVAssetReaderTrackOutput(track: videoTrack, outputSettings: nil)
        let audioOutput = AVAssetReaderAudioMixOutput(audioTracks: audioTracks, audioSettings: [
            AVFormatIDKey: kAudioFormatLinearPCM,
            AVSampleRateKey: 48_000,
            AVNumberOfChannelsKey: 2,
            AVLinearPCMBitDepthKey: 32,
            AVLinearPCMIsFloatKey: true,
            AVLinearPCMIsNonInterleaved: false,
            AVLinearPCMIsBigEndianKey: false,
        ])

        let videoFormat = try await videoTrack.load(.formatDescriptions).first
        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: nil, sourceFormatHint: videoFormat)
        videoInput.transform = try await videoTrack.load(.preferredTransform)

        var layout = AudioChannelLayout()
        layout.mChannelLayoutTag = kAudioChannelLayoutTag_Stereo

        let audioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 48_000,
            AVNumberOfChannelsKey: 2,
            AVChannelLayoutKey: Data(bytes: &layout, count: MemoryLayout<AudioChannelLayout>.size),
            AVEncoderBitRateKey: 128_000,
        ])

        reader.add(videoOutput)
        reader.add(audioOutput)
        writer.add(videoInput)
        writer.add(audioInput)

        guard reader.startReading(), writer.startWriting() else {
            try? FileManager.default.removeItem(at: mixedURL)

            throw reader.error ?? writer.error ?? CaptureError.failed("Couldn't mix the recording's audio.")
        }

        writer.startSession(atSourceTime: .zero)

        let videoPump = Pump(output: videoOutput, input: videoInput)
        let audioPump = Pump(output: audioOutput, input: audioInput)

        async let video: Void = videoPump.run()
        async let audio: Void = audioPump.run()
        _ = await (video, audio)

        await writer.finishWriting()

        guard reader.status == .completed, writer.status == .completed else {
            try? FileManager.default.removeItem(at: mixedURL)

            throw writer.error ?? reader.error ?? CaptureError.failed("Couldn't mix the recording's audio.")
        }

        _ = try FileManager.default.replaceItemAt(url, withItemAt: mixedURL)

        return url
    }
}

/// Copies one reader output into one writer input as fast as the writer accepts it.
private nonisolated final class Pump: @unchecked Sendable {
    private let output: AVAssetReaderOutput
    private let input: AVAssetWriterInput
    private let queue = DispatchQueue(label: "nz.ghijk.dropshot.mixdown")

    init(output: AVAssetReaderOutput, input: AVAssetWriterInput) {
        self.output = output
        self.input = input
    }

    func run() async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            input.requestMediaDataWhenReady(on: queue) { [self] in
                while input.isReadyForMoreMediaData {
                    guard let sampleBuffer = output.copyNextSampleBuffer(), input.append(sampleBuffer) else {
                        input.markAsFinished()
                        continuation.resume()

                        return
                    }
                }
            }
        }
    }
}
