import AppKit
import SwiftUI

private struct NoteEditor: View {
    @State private var text = ""
    let onUpload: (String) -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            TextEditor(text: $text)
                .font(.system(.body, design: .monospaced))
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))

            Button("Upload Note") { onUpload(text) }
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(12)
        .frame(minWidth: 420, minHeight: 280)
    }
}

/// A small editor for sharing a text snippet as a drop.
enum NoteWindowController {
    private static var window: NSWindow?

    static func present() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate()

            return
        }

        let window = NSWindow(
            contentRect: CGRect(x: 0, y: 0, width: 520, height: 360),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "New Note"
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: NoteEditor { text in
            UploadCoordinator.shared.upload(text: text)
            self.window?.close()
            self.window = nil
        })
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate()

        self.window = window
    }
}
