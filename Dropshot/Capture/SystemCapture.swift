import AppKit

nonisolated enum CaptureError: LocalizedError {
    case permissionDenied
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            "Dropshot needs Screen Recording permission. Enable it in System Settings › Privacy & Security › Screen & System Audio Recording, then relaunch Dropshot."
        case let .failed(reason):
            reason
        }
    }
}

/// Screenshots through the system's own interactive capture UI (`/usr/sbin/screencapture`), which is also what Droplr
/// uses. Selection, window picking, Esc to cancel and multi-display all come for free. Recordings go through
/// `ScreenRecorder` instead, which needs pause and mute.
enum SystemCapture {
    /// Returns nil when the user cancels the selection.
    static func screenshot() async throws -> URL? {
        try ensurePermission()

        let url = try UploadCoordinator.captureFile(named: "Screenshot \(UploadCoordinator.timestamp()).png")
        _ = try await ScreencaptureProcess.run(arguments: ["-i", "-x", url.path])

        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    static func ensurePermission() throws {
        if CGPreflightScreenCaptureAccess() {
            return
        }

        CGRequestScreenCaptureAccess()

        throw CaptureError.permissionDenied
    }
}

private enum ScreencaptureProcess {
    static func run(arguments: [String]) async throws -> Int32 {
        let process = Process()
        process.executableURL = URL(filePath: "/usr/sbin/screencapture")
        process.arguments = arguments

        return try await withCheckedThrowingContinuation { continuation in
            process.terminationHandler = { process in
                continuation.resume(returning: process.terminationStatus)
            }

            do {
                try process.run()
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}
