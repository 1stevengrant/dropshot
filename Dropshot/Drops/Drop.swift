import Foundation

enum DropKind: String, Codable {
    case file
    case image
    case video
    case text
    case link
}

struct Drop: Codable, Identifiable, Equatable {
    let id: String
    let filename: String
    let kind: DropKind
    let url: URL
    let objectKey: String
    let byteCount: Int64
    let createdAt: Date
    var localCopy: URL?
}
