import AppKit

/// User-facing capture commands shared by the menu, hotkeys and URL scheme.
final class CaptureActions {
    private let preferences = Preferences.shared
    private let recorder = ScreenRecorder.shared
    private var isCapturing = false

    /// `annotate: nil` follows the user's "after capture" preference.
    func screenshot(annotate: Bool?) {
        if isCapturing || recorder.isRecording {
            return
        }

        isCapturing = true

        Task {
            defer { isCapturing = false }

            do {
                guard let url = try await SystemCapture.screenshot() else {
                    return
                }

                if annotate ?? (preferences.screenshotAction == .annotate) {
                    AnnotationWindowController.present(imageAt: url)

                    return
                }

                await UploadCoordinator.shared.upload(fileAt: url, kind: .image)
            } catch {
                UploadCoordinator.shared.report(error)
            }
        }
    }

    func toggleRecording(as format: RecordingFormat, camera: Bool = false) {
        if recorder.isRecording {
            stopRecording()

            return
        }

        startRecording(as: format, camera: camera)
    }

    func startRecording(as format: RecordingFormat, camera: Bool = false) {
        if isCapturing || recorder.isRecording {
            return
        }

        Task {
            do {
                // GIFs have no sound, so they record without audio tracks.
                guard let movie = try await recorder.record(
                    microphone: format == .gif ? MicrophoneChoice.none : preferences.microphone,
                    systemAudio: format == .video && preferences.recordSystemAudio,
                    showClicks: preferences.showClicksInRecordings,
                    countdown: preferences.recordingCountdown,
                    camera: camera ? (preferences.camera, preferences.cameraSize) : nil
                ) else {
                    return
                }

                if format == .gif {
                    let gif = try await GIFEncoder.convert(movie)
                    try? FileManager.default.removeItem(at: movie)
                    await UploadCoordinator.shared.upload(fileAt: gif, kind: .image)

                    return
                }

                await UploadCoordinator.shared.upload(fileAt: movie, kind: .video)
            } catch {
                UploadCoordinator.shared.report(error)
            }
        }
    }

    func stopRecording() {
        recorder.finish()
    }

    func togglePause() {
        recorder.togglePause()
    }

    func toggleMute() {
        recorder.toggleMute()
    }

    func cancelRecording() {
        recorder.cancel()
    }

    func chooseFiles() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = true
        panel.prompt = "Upload"

        NSApp.activate()

        if panel.runModal() == .OK {
            UploadCoordinator.shared.upload(files: panel.urls)
        }
    }

    /// Without a URL, asks for one; with one (from the URL scheme), captures straight away.
    func captureWebPage(_ url: URL? = nil) {
        guard let url else {
            WebCaptureWindowController.present { url in Task { await self.capture(url: url) } }

            return
        }

        Task { await capture(url: url) }
    }

    private func capture(url: URL) async {
        do {
            let host = (url.host() ?? "page").replacingOccurrences(of: "/", with: "-")
            let capture = try await UploadCoordinator.shared.preparing(host) { try await WebPageCapture.capture(url) }
            let fileURL = try UploadCoordinator.captureFile(named: "Screenshot of \(host).\(capture.fileExtension)")

            try capture.image.write(to: fileURL)

            await UploadCoordinator.shared.upload(fileAt: fileURL, kind: .image, metadata: ["source-url": url.absoluteString, "title": capture.title.isEmpty ? host : capture.title])
        } catch {
            UploadCoordinator.shared.report(error)
        }
    }

    func newNote() {
        NoteWindowController.present()
    }

    func newCodeSnippet() {
        CodeSnippetWindowController.present()
    }
}
