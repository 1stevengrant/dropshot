import AppKit
import Observation
import UniformTypeIdentifiers
import UserNotifications

@Observable
final class ActiveUpload: Identifiable {
    let id = UUID()
    let filename: String
    /// Work that happens before the upload, like rendering a web page, has no byte progress to show.
    let isPreparing: Bool
    var progress: Double = 0

    init(filename: String, isPreparing: Bool = false) {
        self.filename = filename
        self.isPreparing = isPreparing
    }
}

/// Owns the full drop lifecycle: prepare, upload, copy link, notify, record history.
@Observable
final class UploadCoordinator {
    static let shared = UploadCoordinator()

    private(set) var activeUploads: [ActiveUpload] = []

    @ObservationIgnored private let preferences = Preferences.shared
    @ObservationIgnored private let store = DropStore.shared

    /// Lists slow work that comes before an upload (a web page capture) in the menu while it runs.
    func preparing<T>(_ name: String, _ work: () async throws -> T) async rethrows -> T {
        let active = ActiveUpload(filename: name, isPreparing: true)
        activeUploads.append(active)

        defer { activeUploads.removeAll { $0.id == active.id } }

        return try await work()
    }

    func upload(files: [URL]) {
        if files.isEmpty {
            return
        }

        if files.count > 1 {
            Task { await uploadBundle(of: files) }

            return
        }

        Task { await upload(fileAt: files[0], kind: Self.kind(for: files[0])) }
    }

    func upload(text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmed.isEmpty {
            return
        }

        if let url = URL(string: trimmed), url.scheme?.hasPrefix("http") == true, !trimmed.contains(" ") {
            Task { await shorten(url) }

            return
        }

        do {
            let fileURL = try Self.captureFile(named: "Note \(Self.timestamp()).txt")
            try trimmed.write(to: fileURL, atomically: true, encoding: .utf8)
            Task { await upload(fileAt: fileURL, kind: .text) }
        } catch {
            report(error)

            return
        }
    }

    func upload(snippet code: String, title: String, language: CodeLanguage) {
        let name = title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "\(language.label) snippet \(Self.timestamp())" : title
        let safeName = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")

        do {
            let fileURL = try Self.captureFile(named: "\(safeName).\(language.fileExtension)")
            try code.write(to: fileURL, atomically: true, encoding: .utf8)
            Task { await upload(fileAt: fileURL, kind: .code) }
        } catch {
            report(error)

            return
        }
    }

    func uploadPasteboard(_ pasteboard: NSPasteboard = .general) {
        if let files = pasteboard.readObjects(forClasses: [NSURL.self], options: [.urlReadingFileURLsOnly: true]) as? [URL], !files.isEmpty {
            upload(files: files)

            return
        }

        if let image = NSImage(pasteboard: pasteboard), let png = image.pngData {
            do {
                let fileURL = try Self.captureFile(named: "Pasted Image \(Self.timestamp()).png")
                try png.write(to: fileURL)
                upload(files: [fileURL])
            } catch {
                report(error)

                return
            }

            return
        }

        if let string = pasteboard.string(forType: .string) {
            upload(text: string)
        }
    }

    /// `metadata` is stored on the object as `x-amz-meta-*`; the Worker's bucket sync reads `source-url` and `title`.
    func upload(fileAt fileURL: URL, kind: DropKind, metadata: [String: String] = [:]) async {
        guard let configuration = preferences.storageConfiguration else {
            report(UploadError.notConfigured)
            SettingsOpener.open()

            return
        }

        let prepared: URL

        do {
            prepared = try await prepare(fileURL)
        } catch {
            report(error)

            return
        }

        let filename = prepared.lastPathComponent
        let active = ActiveUpload(filename: filename)
        activeUploads.append(active)

        defer { activeUploads.removeAll { $0.id == active.id } }

        let uploader = S3Uploader(configuration: configuration) { fraction in
            Task { @MainActor in active.progress = fraction }
        }

        let shortId = S3Uploader.makeShortId()
        let uploadedName = configuration.linkStyle == .shortId ? Self.shortName(for: filename, shortId: shortId) : filename

        do {
            let result = try await uploader.upload(fileAt: prepared, filename: uploadedName, shortId: configuration.linkStyle == .shortId ? "" : shortId, metadata: metadata)
            let size = (try? prepared.resourceValues(forKeys: [.fileSizeKey]).fileSize).map(Int64.init) ?? 0
            let discardLocal = kind == .link || (!preferences.keepLocalCopies && Self.isCapture(prepared))

            let drop = Drop(
                id: shortId,
                filename: filename,
                kind: kind,
                url: configuration.publicBaseURL.appending(path: shortId),
                directURL: result.directURL,
                objectKey: result.objectKey,
                byteCount: size,
                createdAt: .now,
                localCopy: discardLocal ? nil : prepared
            )

            store.add(drop)
            complete(drop)

            if kind == .image, let thumbnail = Thumbnailer.thumbnail(ofImageAt: prepared) {
                // Optional: without it the dashboard card shows an icon (or the original, when that's small).
                try? await uploader.uploadThumbnail(thumbnail.data, contentType: thumbnail.contentType, dropId: shortId)
            }

            if discardLocal {
                try? FileManager.default.removeItem(at: prepared)
            }
        } catch {
            report(error)
        }
    }

    /// Links are stored as a tiny HTML redirect so the public URL works on any static bucket.
    private func shorten(_ url: URL) async {
        let escaped = url.absoluteString
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "<", with: "&lt;")
        let html = "<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=\"0;url=\(escaped)\"><title>Redirecting</title><a href=\"\(escaped)\">\(escaped)</a>"

        do {
            let fileURL = try Self.captureFile(named: "index.html")
            try html.write(to: fileURL, atomically: true, encoding: .utf8)
            await upload(fileAt: fileURL, kind: .link)
        } catch {
            report(error)

            return
        }
    }

    private func uploadBundle(of files: [URL]) async {
        let folder = FileManager.default.temporaryDirectory.appending(path: "Dropshot \(UUID().uuidString)", directoryHint: .isDirectory)

        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

            for file in files {
                try FileManager.default.copyItem(at: file, to: folder.appending(path: file.lastPathComponent))
            }
        } catch {
            report(error)

            return
        }

        await upload(fileAt: folder, kind: .file)

        try? FileManager.default.removeItem(at: folder)
    }

    /// Each generated file owns a directory so repeated display names cannot replace it.
    static func captureFile(named filename: String) throws -> URL {
        let directory = DropStore.capturesDirectory.appending(path: UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        return directory.appending(path: filename)
    }

    /// Only files Dropshot created itself (captures, notes, pasted images, archives) are ever deleted, never the user's own.
    private static func isCapture(_ url: URL) -> Bool {
        url.standardizedFileURL.path.hasPrefix(DropStore.capturesDirectory.standardizedFileURL.path + "/")
    }

    /// Folders and app bundles become zip archives, matching how a browser can serve them.
    private func prepare(_ url: URL) async throws -> URL {
        let values = try url.resourceValues(forKeys: [.isDirectoryKey])

        if values.isDirectory != true {
            return url
        }

        let archive = try Self.captureFile(named: "\(url.lastPathComponent).zip")

        try await Process.run("/usr/bin/ditto", arguments: ["-c", "-k", "--sequesterRsrc", "--keepParent", url.path, archive.path])

        return archive
    }

    private func complete(_ drop: Drop) {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(drop.url.absoluteString, forType: .string)

        if preferences.playSounds {
            NSSound(named: "Glass")?.play()
        }

        if preferences.showNotifications {
            Notifier.post(title: "Link copied", body: drop.url.absoluteString, identifier: drop.id)
        }
    }

    func report(_ error: Error) {
        if preferences.playSounds {
            NSSound(named: "Basso")?.play()
        }

        Notifier.post(title: "Dropshot", body: error.localizedDescription, identifier: UUID().uuidString)
    }

    static func kind(for url: URL) -> DropKind {
        if CodeLanguage.matching(extension: url.pathExtension) != nil {
            return .code
        }

        guard let type = UTType(filenameExtension: url.pathExtension) else {
            return .file
        }

        if type.conforms(to: .image) {
            return .image
        }

        if type.conforms(to: .movie) {
            return .video
        }

        if type.conforms(to: .text) {
            return .text
        }

        return .file
    }

    static func timestamp(_ date: Date = .now) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd 'at' HH.mm.ss"

        return formatter.string(from: date)
    }

    private static func shortName(for filename: String, shortId: String) -> String {
        let ext = (filename as NSString).pathExtension

        return ext.isEmpty ? shortId : "\(shortId).\(ext)"
    }
}

extension NSImage {
    var pngData: Data? {
        guard let tiff = tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff) else {
            return nil
        }

        return bitmap.representation(using: .png, properties: [:])
    }
}

extension Process {
    nonisolated static func run(_ executable: String, arguments: [String]) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let process = Process()
            process.executableURL = URL(filePath: executable)
            process.arguments = arguments
            process.terminationHandler = { process in
                if process.terminationStatus == 0 {
                    continuation.resume()

                    return
                }

                continuation.resume(throwing: CocoaError(.fileWriteUnknown, userInfo: [
                    NSLocalizedDescriptionKey: "\((executable as NSString).lastPathComponent) exited with status \(process.terminationStatus)",
                ]))
            }

            do {
                try process.run()
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}

enum Notifier {
    static func requestAuthorization() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    static func post(title: String, body: String, identifier: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body

        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: identifier, content: content, trigger: nil))
    }
}
