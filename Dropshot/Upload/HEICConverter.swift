import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Only Safari displays HEIC, so HEIC and HEIF photos are uploaded as JPEGs that every visitor's browser can show.
/// The photo's metadata, orientation included, is carried over.
nonisolated enum HEICConverter {
    private static let quality = 0.9

    static func needsConversion(_ url: URL) -> Bool {
        guard let type = UTType(filenameExtension: url.pathExtension) else {
            return false
        }

        return type.conforms(to: .heic) || type.conforms(to: .heif)
    }

    static func jpegFilename(for url: URL) -> String {
        url.deletingPathExtension().appendingPathExtension("jpg").lastPathComponent
    }

    /// Writes the first image of `source` to `destination` as a JPEG. Returns false when the file can't be read.
    static func convert(_ source: URL, to destination: URL) -> Bool {
        guard
            let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil),
            CGImageSourceGetCount(imageSource) > 0,
            let imageDestination = CGImageDestinationCreateWithURL(destination as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
        else {
            return false
        }

        let properties = [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary
        CGImageDestinationAddImageFromSource(imageDestination, imageSource, 0, properties)

        return CGImageDestinationFinalize(imageDestination)
    }
}
