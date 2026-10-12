import ImageIO
import XCTest
@testable import Dropshot

final class ThumbnailerTests: XCTestCase {
    func testTallImagesComeOut640WideAndCutTo960() throws {
        let thumbnail = try XCTUnwrap(Thumbnailer.thumbnail(ofImageAt: try makePNG(width: 2880, height: 16000)))

        XCTAssertEqual(try size(of: thumbnail.data), CGSize(width: 640, height: 960))
    }

    func testWideImagesKeepTheirShape() throws {
        let thumbnail = try XCTUnwrap(Thumbnailer.thumbnail(ofImageAt: try makePNG(width: 3200, height: 2000)))

        XCTAssertEqual(try size(of: thumbnail.data), CGSize(width: 640, height: 400))
    }

    func testSmallImagesAreNotEnlarged() throws {
        let thumbnail = try XCTUnwrap(Thumbnailer.thumbnail(ofImageAt: try makePNG(width: 300, height: 200)))

        XCTAssertEqual(try size(of: thumbnail.data), CGSize(width: 300, height: 200))
    }

    func testNonImagesHaveNoThumbnail() throws {
        let file = FileManager.default.temporaryDirectory.appending(path: "\(UUID()).txt")
        try "hello".write(to: file, atomically: true, encoding: .utf8)

        XCTAssertNil(Thumbnailer.thumbnail(ofImageAt: file))
    }

    private func makePNG(width: Int, height: Int) throws -> URL {
        let context = try XCTUnwrap(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(CGColor(red: 0.2, green: 0.4, blue: 0.8, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        let url = FileManager.default.temporaryDirectory.appending(path: "\(UUID()).png")
        let destination = try XCTUnwrap(CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil))
        CGImageDestinationAddImage(destination, try XCTUnwrap(context.makeImage()), nil)
        XCTAssertTrue(CGImageDestinationFinalize(destination))

        return url
    }

    private func size(of data: Data) throws -> CGSize {
        let image = try XCTUnwrap(CGImageSourceCreateWithData(data as CFData, nil).flatMap { CGImageSourceCreateImageAtIndex($0, 0, nil) })

        return CGSize(width: image.width, height: image.height)
    }
}
