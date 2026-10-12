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

    func toggleRecording(as format: RecordingFormat) {
        if recorder.isRecording {
            stopRecording()

            return
        }

        startRecording(as: format)
    }

    func startRecording(as format: RecordingFormat) {
        if isCapturing || recorder.isRecording {
            return
        }

        Task {
            do {
                guard let movie = try await recorder.record(microphone: preferences.microphone, systemAudio: preferences.recordSystemAudio, showClicks: preferences.showClicksInRecordings) else {
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
        recorder.stop()
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

    func newNote() {
        NoteWindowController.present()
    }

    func newCodeSnippet() {
        CodeSnippetWindowController.present()
    }
}
