import KeyboardShortcuts

/// Defaults match Droplr 5.9 (see re/SPEC.md, "Default hotkeys").
extension KeyboardShortcuts.Name {
    static let uploadClipboard = Self("uploadClipboard", default: .init(.d, modifiers: [.option]))
    static let captureScreenshot = Self("captureScreenshot", default: .init(.four, modifiers: [.option, .shift]))
    static let captureAndAnnotate = Self("captureAndAnnotate", default: .init(.three, modifiers: [.option, .shift]))
    static let recordVideo = Self("recordVideo", default: .init(.five, modifiers: [.option, .shift]))
    static let recordGIF = Self("recordGIF", default: .init(.two, modifiers: [.option, .shift]))
    static let uploadFile = Self("uploadFile", default: .init(.six, modifiers: [.option, .shift]))
    static let newNote = Self("newNote", default: .init(.n, modifiers: [.option, .shift]))
    /// Droplr had no default for code snippets.
    static let newCodeSnippet = Self("newCodeSnippet")
    static let finishRecording = Self("finishRecording", default: .init(.d, modifiers: [.command, .shift]))
}

enum Hotkeys {
    static func register(_ actions: CaptureActions) {
        KeyboardShortcuts.onKeyUp(for: .uploadClipboard) { UploadCoordinator.shared.uploadPasteboard() }
        KeyboardShortcuts.onKeyUp(for: .captureScreenshot) { actions.screenshot(annotate: nil) }
        KeyboardShortcuts.onKeyUp(for: .captureAndAnnotate) { actions.screenshot(annotate: true) }
        KeyboardShortcuts.onKeyUp(for: .recordVideo) { actions.toggleRecording(as: .video) }
        KeyboardShortcuts.onKeyUp(for: .recordGIF) { actions.toggleRecording(as: .gif) }
        KeyboardShortcuts.onKeyUp(for: .uploadFile) { actions.chooseFiles() }
        KeyboardShortcuts.onKeyUp(for: .newNote) { actions.newNote() }
        KeyboardShortcuts.onKeyUp(for: .newCodeSnippet) { actions.newCodeSnippet() }
        KeyboardShortcuts.onKeyUp(for: .finishRecording) { actions.stopRecording() }
    }
}
