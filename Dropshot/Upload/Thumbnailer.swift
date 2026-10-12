import Foundation
import ImageIO

/// Library thumbnails: 640px wide, cut off at the top 960px for tall images, matching what the dashboard and the
/// Worker store. AVIF keeps them small and keeps transparent window shadows; PNG is the fallback.
nonisolated enum Thumbnailer {
    private static let width = 640
    private static let maxHeight = 960

    static func thumbnail(ofImageAt url: URL) -> (data: Data, contentType: String)? {
        guard
            let source = CGImageSourceCreateWithURL(url as CFURL, nil),
            let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
            let pixelWidth = properties[kCGImagePropertyPixelWidth] as? Int,
            let pixelHeight = properties[kCGImagePropertyPixelHeight] as? Int,
            pixelWidth > 0
        else {
            return nil
        }

        // The size limit applies to the longer side, so tall images need a bigger one to come out 640px wide.
        let longestSide = Double(width) * Double(max(pixelWidth, pixelHeight)) / Double(pixelWidth)
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: Int(longestSide.rounded()),
        ]

        guard let scaled = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }

        let image = scaled.cropping(to: CGRect(x: 0, y: 0, width: scaled.width, height: min(scaled.height, maxHeight))) ?? scaled

        if let avif = encode(image, as: "public.avif", quality: 0.6) {
            return (avif, "image/avif")
        }

        return encode(image, as: "public.png", quality: nil).map { ($0, "image/png") }
    }

    private static func encode(_ image: CGImage, as type: String, quality: Double?) -> Data? {
        let data = NSMutableData()

        guard let destination = CGImageDestinationCreateWithData(data, type as CFString, 1, nil) else {
            return nil
        }

        let properties = quality.map { [kCGImageDestinationLossyCompressionQuality: $0] as CFDictionary }
        CGImageDestinationAddImage(destination, image, properties)

        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }
}
