import Foundation

enum DropKind: String, Codable {
    case file
    case image
    case video
    case code
    case text
    case link
}

struct Drop: Codable, Identifiable, Equatable {
    let id: String
    let filename: String
    let kind: DropKind
    /// The drop page, which is the link that gets shared.
    let url: URL
    /// The raw file, for embedding images. Missing on drops made before drop pages existed.
    var directURL: URL?
    let objectKey: String
    let byteCount: Int64
    let createdAt: Date
    var localCopy: URL?
}
