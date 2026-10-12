import AVFoundation
import ImageIO
import UniformTypeIdentifiers

/// Converts a recording to an animated GIF with ImageIO, sampling frames at a fixed rate.
nonisolated enum GIFEncoder {
    static func convert(_ videoURL: URL, framesPerSecond: Double = 12, maxWidth: CGFloat = 960) async throws -> URL {
        let asset = AVURLAsset(url: videoURL)
        let duration = try await asset.load(.duration).seconds

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: maxWidth, height: 0)
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero

        let frameCount = max(Int(duration * framesPerSecond), 1)
        let outputURL = videoURL.deletingPathExtension().appendingPathExtension("gif")

        guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.gif.identifier as CFString, frameCount, nil) else {
            throw CaptureError.failed("Couldn't create the GIF file.")
        }

        CGImageDestinationSetProperties(destination, [
            kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFLoopCount: 0],
        ] as CFDictionary)

        let frameProperties = [
            kCGImagePropertyGIFDictionary: [kCGImagePropertyGIFDelayTime: 1 / framesPerSecond],
        ] as CFDictionary

        let times = (0..<frameCount).map { CMTime(seconds: Double($0) / framesPerSecond, preferredTimescale: 600) }

        for await result in generator.images(for: times) {
            guard let image = try? result.image else {
                continue
            }

            CGImageDestinationAddImage(destination, image, frameProperties)
        }

        guard CGImageDestinationFinalize(destination) else {
            throw CaptureError.failed("Couldn't finish writing the GIF.")
        }

        return outputURL
    }
}
