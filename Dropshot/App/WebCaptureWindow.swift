import AppKit
import SwiftUI

private struct WebCaptureForm: View {
    @State var address: String
    let onCapture: (URL) -> Void

    var body: some View {
        VStack(alignment: .trailing, spacing: 10) {
            TextField("https://example.com", text: $address)
                .textFieldStyle(.roundedBorder)
                .onSubmit(capture)

            Button("Capture", action: capture)
                .keyboardShortcut(.defaultAction)
                .disabled(WebCaptureURL.parse(address) == nil)
        }
        .padding(14)
        .frame(width: 460)
    }

    private func capture() {
        guard let url = WebCaptureURL.parse(address) else {
            return
        }

        onCapture(url)
    }
}

/// Asks for a page URL to capture, prefilled from the clipboard when it holds one. It closes as soon as the
/// capture starts; progress shows in the menu bar like an upload.
enum WebCaptureWindowController {
    private static var window: NSWindow?

    static func present(onCapture: @escaping (URL) -> Void) {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate()

            return
        }

        let clipboard = NSPasteboard.general.string(forType: .string).flatMap(WebCaptureURL.parse)?.absoluteString ?? ""

        let window = NSWindow(
            contentRect: CGRect(x: 0, y: 0, width: 460, height: 90),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "Capture Web Page"
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: WebCaptureForm(address: clipboard) { url in
            onCapture(url)
            self.window?.close()
            self.window = nil
        })
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate()

        self.window = window
    }
}
