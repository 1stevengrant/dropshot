import AppKit
import SwiftUI

private struct CodeSnippetEditor: View {
    @AppStorage("snippet.language") private var languageId = "javascript"
    @State private var title = ""
    @State private var code = ""
    let onUpload: (_ code: String, _ title: String, _ language: CodeLanguage) -> Void

    private var language: CodeLanguage {
        CodeLanguage.all.first { $0.id == languageId } ?? CodeLanguage.all[0]
    }

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            HStack {
                TextField("Title (optional)", text: $title)
                    .textFieldStyle(.roundedBorder)

                Picker("Language", selection: $languageId) {
                    ForEach(CodeLanguage.all) { Text($0.label).tag($0.id) }
                }
                .labelsHidden()
                .frame(width: 160)
            }

            TextEditor(text: $code)
                .font(.system(.body, design: .monospaced))
                .autocorrectionDisabled()
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(Color(nsColor: .textBackgroundColor), in: RoundedRectangle(cornerRadius: 6))

            Button("Upload Snippet") { onUpload(code, title, language) }
                .keyboardShortcut(.return, modifiers: .command)
                .disabled(code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(12)
        .frame(minWidth: 520, minHeight: 340)
    }
}

/// Droplr's "Code Snippet": paste code, pick its language, and share it as a highlighted drop.
enum CodeSnippetWindowController {
    private static var window: NSWindow?

    static func present() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate()

            return
        }

        let window = NSWindow(
            contentRect: CGRect(x: 0, y: 0, width: 640, height: 440),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "New Code Snippet"
        window.isReleasedWhenClosed = false
        window.contentView = NSHostingView(rootView: CodeSnippetEditor { code, title, language in
            UploadCoordinator.shared.upload(snippet: code, title: title, language: language)
            self.window?.close()
            self.window = nil
        })
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate()

        self.window = window
    }
}
