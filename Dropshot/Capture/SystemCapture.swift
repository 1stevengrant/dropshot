import AppKit
import ApplicationServices
import Observation
import UniformTypeIdentifiers

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

/// Screenshots and recordings through the system's own interactive capture UI (`/usr/sbin/screencapture`),
/// which is also what Droplr uses. Selection, window picking, Esc to cancel and multi-display all come for free.
enum SystemCapture {
    /// Returns nil when the user cancels the selection.
    static func screenshot() async throws -> URL? {
        try ensurePermission()

        let url = DropStore.capturesDirectory.appending(path: "Screenshot \(UploadCoordinator.timestamp()).png")
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

/// One interactive recording at a time through the system recording toolbar. macOS shows a stop button in the menu bar;
/// Dropshot's status item (red, with a timer) and the finish-recording hotkey stop it too.
@Observable
final class ScreenRecorder {
    static let shared = ScreenRecorder()

    private(set) var isRecording = false
    private(set) var startedAt: Date?

    @ObservationIgnored private var process: Process?

    /// Returns the finished movie, or nil when the user cancels before recording starts.
    func record(microphone: String, systemAudio: Bool, showClicks: Bool) async throws -> URL? {
        if isRecording {
            return nil
        }

        try SystemCapture.ensurePermission()

        let url = DropStore.capturesDirectory.appending(path: "Recording \(UploadCoordinator.timestamp()).mov")
        var arguments = ["-i", "-v", "-J", "video", "-U", "-x"]

        arguments += MicrophoneChoice.arguments(for: microphone)

        if systemAudio {
            arguments.append("-A")
        }

        if showClicks {
            arguments.append("-k")
        }

        arguments.append(url.path)

        let startedAt = Date.now
        self.startedAt = startedAt
        isRecording = true

        defer {
            isRecording = false
            self.startedAt = nil
            process = nil
        }

        let status = try await ScreencaptureProcess.run(arguments: arguments) { [weak self] process in
            self?.process = process
        }

        guard status == 0 else {
            return nil
        }

        if FileManager.default.fileExists(atPath: url.path) {
            return url
        }

        isRecording = false

        // macOS may save toolbar recordings elsewhere. Never infer ownership from a timestamp.
        let panel = NSOpenPanel()
        panel.title = "Choose the recording to upload"
        panel.message = "macOS did not save a recording to the requested location. Select the recording you want to share, or cancel to upload nothing. The original file will stay in place."
        panel.allowedContentTypes = [.quickTimeMovie]
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.prompt = "Upload Recording"
        NSApp.activate()

        guard panel.runModal() == .OK, let recording = panel.url else {
            return nil
        }

        try FileManager.default.copyItem(at: recording, to: url)

        return url
    }

    /// Sends macOS's own "stop screen recording" shortcut (⌃⌘Esc). Interrupting screencapture instead
    /// sometimes trims the end of the recording or kills it before it saves.
    func stop() {
        guard let process, process.isRunning else {
            return
        }

        let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary

        guard AXIsProcessTrustedWithOptions(options) else {
            UploadCoordinator.shared.report(CaptureError.failed("To stop recordings from Dropshot, allow it in System Settings › Privacy & Security › Accessibility. Until then, press ⌃⌘Esc or use the stop button in the menu bar."))

            return
        }

        let source = CGEventSource(stateID: .hidSystemState)
        let escape: CGKeyCode = 53

        for keyDown in [true, false] {
            let event = CGEvent(keyboardEventSource: source, virtualKey: escape, keyDown: keyDown)
            event?.flags = [.maskControl, .maskCommand]
            event?.post(tap: .cghidEventTap)
        }
    }
}

private enum ScreencaptureProcess {
    static func run(arguments: [String], started: ((Process) -> Void)? = nil) async throws -> Int32 {
        let process = Process()
        process.executableURL = URL(filePath: "/usr/sbin/screencapture")
        process.arguments = arguments

        return try await withCheckedThrowingContinuation { continuation in
            process.terminationHandler = { process in
                continuation.resume(returning: process.terminationStatus)
            }

            do {
                try process.run()
                started?(process)
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }
}
