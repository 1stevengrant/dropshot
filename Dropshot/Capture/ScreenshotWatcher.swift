import AppKit

/// Uploads screenshots and recordings macOS saves itself (⌘⇧3, ⌘⇧4, ⌘⇧5). Like Droplr's `ScreenshotDetector`, it
/// watches a Spotlight query and uploads only items that just appeared. The originals are never deleted.
final class ScreenshotWatcher {
    private let query = NSMetadataQuery()
    private var observer: NSObjectProtocol?
    private var lastSeen: String?

    init() {
        query.predicate = NSPredicate(format: "kMDItemIsScreenCapture == 1 || kMDItemIsScreenRecording == 1")
        query.searchScopes = [NSMetadataQueryLocalComputerScope]
    }

    func start() {
        guard observer == nil else {
            return
        }

        // macOS writes a hidden file first and renames it, so a new screenshot can arrive as a changed item too.
        observer = NotificationCenter.default.addObserver(forName: .NSMetadataQueryDidUpdate, object: query, queue: .main) { [weak self] notification in
            let keys = [NSMetadataQueryUpdateAddedItemsKey, NSMetadataQueryUpdateChangedItemsKey]
            let items = keys.flatMap { notification.userInfo?[$0] as? [NSMetadataItem] ?? [] }
            let found = items.compactMap { item -> (path: String, created: Date)? in
                guard let path = item.value(forAttribute: NSMetadataItemPathKey) as? String,
                      let created = item.value(forAttribute: NSMetadataItemFSCreationDateKey) as? Date else {
                    return nil
                }

                return (path, created)
            }

            MainActor.assumeIsolated {
                self?.upload(found)
            }
        }

        query.start()
    }

    func stop() {
        guard let observer else {
            return
        }

        query.stop()
        NotificationCenter.default.removeObserver(observer)
        self.observer = nil
    }

    private func upload(_ items: [(path: String, created: Date)]) {
        for item in items where Self.shouldUpload(path: item.path, created: item.created, now: .now, lastSeen: lastSeen) {
            lastSeen = item.path

            let url = URL(filePath: item.path)
            let kind = UploadCoordinator.kind(for: url)

            guard kind == .image || kind == .video else {
                continue
            }

            Task { await UploadCoordinator.shared.upload(fileAt: url, kind: kind) }
        }
    }

    /// Only a capture from the last 10 seconds that wasn't just uploaded, isn't hidden, and isn't one of Dropshot's
    /// own captures (those upload already).
    static func shouldUpload(path: String, created: Date, now: Date, lastSeen: String?, capturesDirectory: URL = DropStore.capturesDirectory) -> Bool {
        if path == lastSeen {
            return false
        }

        let age = now.timeIntervalSince(created)

        if age < 0 || age > 10 {
            return false
        }

        let url = URL(filePath: path).standardizedFileURL

        if url.pathComponents.contains(where: { $0.hasPrefix(".") }) {
            return false
        }

        return !url.path.hasPrefix(capturesDirectory.standardizedFileURL.path + "/")
    }
}
