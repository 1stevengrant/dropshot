import AVFoundation
import XCTest
@testable import Dropshot

final class RecordingWriterTests: XCTestCase {
    private func tone(frames: Int = 480, at seconds: Double = 10) throws -> CMSampleBuffer {
        let format = try XCTUnwrap(AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 48_000, channels: 1, interleaved: false))
        let buffer = try XCTUnwrap(AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)))
        buffer.frameLength = AVAudioFrameCount(frames)

        for index in 0..<frames {
            buffer.floatChannelData![0][index] = 0.5
        }

        var description: CMAudioFormatDescription?
        CMAudioFormatDescriptionCreate(allocator: nil, asbd: format.streamDescription, layoutSize: 0, layout: nil, magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &description)

        var sampleBuffer: CMSampleBuffer?
        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: 48_000), presentationTimeStamp: CMTime(seconds: seconds, preferredTimescale: 48_000), decodeTimeStamp: .invalid)
        CMSampleBufferCreate(allocator: nil, dataBuffer: nil, dataReady: false, makeDataReadyCallback: nil, refcon: nil, formatDescription: description, sampleCount: frames, sampleTimingEntryCount: 1, sampleTimingArray: &timing, sampleSizeEntryCount: 0, sampleSizeArray: nil, sampleBufferOut: &sampleBuffer)

        let result = try XCTUnwrap(sampleBuffer)
        XCTAssertEqual(CMSampleBufferSetDataBufferFromAudioBufferList(result, blockBufferAllocator: nil, blockBufferMemoryAllocator: nil, flags: 0, bufferList: buffer.audioBufferList), noErr)

        return result
    }

    private func samples(of sampleBuffer: CMSampleBuffer) throws -> [Float] {
        let block = try XCTUnwrap(sampleBuffer.dataBuffer)
        var data = [Float](repeating: -1, count: CMBlockBufferGetDataLength(block) / MemoryLayout<Float>.size)
        CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: CMBlockBufferGetDataLength(block), destination: &data)

        return data
    }

    func testSilencedZeroesEverySampleAndKeepsTiming() throws {
        let original = try tone()
        let silent = try XCTUnwrap(RecordingWriter.silenced(original))

        XCTAssertEqual(try samples(of: original).first, 0.5)
        XCTAssertEqual(silent.numSamples, original.numSamples)
        XCTAssertEqual(silent.presentationTimeStamp, original.presentationTimeStamp)
        XCTAssertTrue(try samples(of: silent).allSatisfy { $0 == 0 })
    }

    func testRetimedShiftsThePresentationTime() throws {
        let original = try tone(at: 10)
        let shifted = try XCTUnwrap(RecordingWriter.retimed(original, by: CMTime(seconds: 4, preferredTimescale: 48_000)))

        XCTAssertEqual(shifted.presentationTimeStamp.seconds, 6, accuracy: 0.0001)
        XCTAssertEqual(shifted.numSamples, original.numSamples)
    }
}
