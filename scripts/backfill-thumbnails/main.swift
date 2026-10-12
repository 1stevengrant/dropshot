import Foundation

// Usage: thumbnail <image> <output>. Prints the thumbnail's content type. Uses the Mac app's Thumbnailer, so
// backfilled thumbnails match the ones made at upload.
let arguments = CommandLine.arguments

guard arguments.count == 3 else {
    FileHandle.standardError.write(Data("usage: thumbnail <image> <output>\n".utf8))
    exit(2)
}

guard let thumbnail = Thumbnailer.thumbnail(ofImageAt: URL(filePath: arguments[1])) else {
    FileHandle.standardError.write(Data("not an image: \(arguments[1])\n".utf8))
    exit(1)
}

try thumbnail.data.write(to: URL(filePath: arguments[2]))
print(thumbnail.contentType)
