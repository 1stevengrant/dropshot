import ImageIO
import UniformTypeIdentifiers
import XCTest
@testable import Dropshot

final class HEICConverterTests: XCTestCase {
    func testHEICAndHEIFNeedConverting() {
        XCTAssertTrue(HEICConverter.needsConversion(URL(filePath: "/tmp/IMG_0001.HEIC")))
        XCTAssertTrue(HEICConverter.needsConversion(URL(filePath: "/tmp/photo.heif")))
        XCTAssertFalse(HEICConverter.needsConversion(URL(filePath: "/tmp/photo.jpg")))
        XCTAssertFalse(HEICConverter.needsConversion(URL(filePath: "/tmp/notes.txt")))
    }

    func testTheJPEGKeepsTheName() {
        XCTAssertEqual(HEICConverter.jpegFilename(for: URL(filePath: "/tmp/IMG_0001.HEIC")), "IMG_0001.jpg")
    }

    func testConvertsToAJPEGOfTheSameSize() throws {
        let source = try makeHEIC(width: 400, height: 300)
        let destination = FileManager.default.temporaryDirectory.appending(path: "\(UUID()).jpg")

        XCTAssertTrue(HEICConverter.convert(source, to: destination))

        let imageSource = try XCTUnwrap(CGImageSourceCreateWithURL(destination as CFURL, nil))
        XCTAssertEqual(CGImageSourceGetType(imageSource) as String?, UTType.jpeg.identifier)

        let image = try XCTUnwrap(CGImageSourceCreateImageAtIndex(imageSource, 0, nil))
        XCTAssertEqual(CGSize(width: image.width, height: image.height), CGSize(width: 400, height: 300))
    }

    func testUnreadableFilesAreNotConverted() throws {
        let source = FileManager.default.temporaryDirectory.appending(path: "\(UUID()).heic")
        try "not an image".write(to: source, atomically: true, encoding: .utf8)

        XCTAssertFalse(HEICConverter.convert(source, to: FileManager.default.temporaryDirectory.appending(path: "\(UUID()).jpg")))
    }

    private func makeHEIC(width: Int, height: Int) throws -> URL {
        let context = try XCTUnwrap(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(CGColor(red: 0.8, green: 0.3, blue: 0.2, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID()).heic")
        let destination = try XCTUnwrap(CGImageDestinationCreateWithURL(url as CFURL, UTType.heic.identifier as CFString, 1, nil))
        CGImageDestinationAddImage(destination, try XCTUnwrap(context.makeImage()), nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))

        return url
    }
}
