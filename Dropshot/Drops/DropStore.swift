import Foundation
import Observation

/// Persisted history of completed drops, newest first.
@Observable
final class DropStore {
    static let shared = DropStore()

    private(set) var drops: [Drop] = []

    @ObservationIgnored private let fileURL: URL

    private init() {
        let directory = URL.applicationSupportDirectory.appending(path: "Dropshot", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        fileURL = directory.appending(path: "drops.json")

        if let data = try? Data(contentsOf: fileURL) {
            drops = (try? Self.decoder.decode([Drop].self, from: data)) ?? []
        }
    }

    func add(_ drop: Drop) {
        drops.insert(drop, at: 0)
        save()
    }

    func remove(_ drop: Drop) {
        drops.removeAll { $0.id == drop.id }
        save()
    }

    func clear() {
        drops.removeAll()
        save()
    }

    private func save() {
        guard let data = try? Self.encoder.encode(drops) else {
            return
        }

        try? data.write(to: fileURL, options: .atomic)
    }

    private static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted]

        return encoder
    }()

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        return decoder
    }()

    /// Where captures and pasted content are written before upload.
    static var capturesDirectory: URL {
        let directory = URL.applicationSupportDirectory.appending(path: "Dropshot/Captures", directoryHint: .isDirectory)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        return directory
    }
}
