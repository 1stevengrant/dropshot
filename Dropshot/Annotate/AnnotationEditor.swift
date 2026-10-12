import AppKit
import SwiftUI

struct AnnotationEditor: View {
    @Bindable var document: AnnotationDocument
    let onFinish: (AnnotationEditorAction) -> Void

    @State private var zoom: CGFloat = 1

    private let palette: [Color] = [.red, .orange, .yellow, .green, .blue, .purple, .black, .white]

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()
            GeometryReader { proxy in
                ScrollView([.horizontal, .vertical]) {
                    AnnotationCanvas(document: document)
                        .scaleEffect(zoom, anchor: .topLeading)
                        .frame(width: document.canvasSize.width * zoom, height: document.canvasSize.height * zoom, alignment: .topLeading)
                        .shadow(radius: 4)
                        .padding(20)
                }
                .background(Color(nsColor: .underPageBackgroundColor))
                .onAppear { zoom = fittingZoom(for: proxy.size) }
            }
        }
        .frame(minWidth: 640, minHeight: 420)
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            Picker("Tool", selection: $document.tool) {
                ForEach(AnnotationTool.allCases) { tool in
                    Image(systemName: tool.symbol)
                        .help("\(tool.title) (\(String(tool.shortcut.character).uppercased()))")
                        .tag(tool)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .fixedSize()
            .background { toolShortcuts }

            if document.tool == .emoji {
                EmojiPicker(selection: $document.emoji)
            }

            HStack(spacing: 4) {
                ForEach(palette, id: \.self) { color in
                    Button {
                        document.color = color
                    } label: {
                        Circle()
                            .fill(color)
                            .frame(width: 16, height: 16)
                            .overlay(Circle().strokeBorder(.primary.opacity(document.color == color ? 0.9 : 0.2), lineWidth: document.color == color ? 2 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            Menu {
                ForEach([2, 4, 6, 10], id: \.self) { width in
                    Button("\(width) pt") { document.lineWidth = CGFloat(width) }
                }

                Divider()

                ForEach([16, 24, 36, 48], id: \.self) { size in
                    Button("Text \(size) pt") { document.fontSize = CGFloat(size) }
                }
            } label: {
                Image(systemName: "lineweight")
            }
            .menuStyle(.borderlessButton)
            .fixedSize()
            .help("Stroke width and text size")

            Spacer()

            Button(action: document.undo) { Image(systemName: "arrow.uturn.backward") }
                .disabled(!document.canUndo)
                .keyboardShortcut("z", modifiers: .command)
                .help("Undo")

            Button(action: document.redo) { Image(systemName: "arrow.uturn.forward") }
                .disabled(!document.canRedo)
                .keyboardShortcut("z", modifiers: [.command, .shift])
                .help("Redo")

            Button("Cancel", role: .cancel) { onFinish(.cancel) }
                .keyboardShortcut(.cancelAction)

            Button("Copy") { onFinish(.copy) }
                .keyboardShortcut("c", modifiers: [.command, .shift])

            Button("Save…") { onFinish(.save) }
                .keyboardShortcut("s", modifiers: .command)

            Button("Upload") { onFinish(.upload) }
                .keyboardShortcut(.defaultAction)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    /// Single-key tool shortcuts, disabled while a text box has focus.
    private var toolShortcuts: some View {
        ForEach(AnnotationTool.allCases) { tool in
            Button("") { document.tool = tool }
                .keyboardShortcut(tool.shortcut, modifiers: [])
                .disabled(document.editingTextID != nil)
                .hidden()
        }
    }

    private func fittingZoom(for size: CGSize) -> CGFloat {
        let available = CGSize(width: size.width - 40, height: size.height - 40)
        let fit = min(available.width / document.canvasSize.width, available.height / document.canvasSize.height)

        return min(max(fit, 0.1), 1)
    }
}

enum AnnotationEditorAction {
    case upload
    case copy
    case save
    case cancel
}

/// Hosts one editor window per capture.
final class AnnotationWindowController: NSWindowController, NSWindowDelegate {
    private static var open: [AnnotationWindowController] = []

    private let annotationDocument: AnnotationDocument

    static func present(imageAt url: URL) {
        guard let document = AnnotationDocument(url: url) else {
            UploadCoordinator.shared.report(CaptureError.failed("Couldn't open \(url.lastPathComponent) for editing."))

            return
        }

        let controller = AnnotationWindowController(document: document)
        open.append(controller)
        controller.showWindow(nil)
        controller.window?.center()
        NSApp.activate()
    }

    private init(document: AnnotationDocument) {
        self.annotationDocument = document

        let screen = NSScreen.main?.visibleFrame.size ?? CGSize(width: 1280, height: 800)
        let size = CGSize(
            width: min(max(document.canvasSize.width + 60, 720), screen.width * 0.9),
            height: min(max(document.canvasSize.height + 110, 480), screen.height * 0.9)
        )

        let window = NSWindow(
            contentRect: CGRect(origin: .zero, size: size),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Annotate — \(annotationDocument.sourceURL.lastPathComponent)"
        window.isReleasedWhenClosed = false

        super.init(window: window)

        window.delegate = self
        window.contentView = NSHostingView(rootView: AnnotationEditor(document: document) { [weak self] action in
            self?.handle(action)
        })
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    private func handle(_ action: AnnotationEditorAction) {
        annotationDocument.editingTextID = nil

        switch action {
        case .cancel:
            close()
        case .copy:
            guard let png = annotationDocument.renderPNG() else {
                return
            }

            NSPasteboard.general.clearContents()
            NSPasteboard.general.setData(png, forType: .png)
            close()
        case .save:
            save()
        case .upload:
            guard let png = annotationDocument.renderPNG() else {
                return
            }

            do {
                try png.write(to: annotationDocument.sourceURL)
            } catch {
                UploadCoordinator.shared.report(error)

                return
            }

            let url = annotationDocument.sourceURL
            close()

            Task { await UploadCoordinator.shared.upload(fileAt: url, kind: .image) }
        }
    }

    private func save() {
        guard let window, let png = annotationDocument.renderPNG() else {
            return
        }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [.png]
        panel.nameFieldStringValue = annotationDocument.sourceURL.lastPathComponent

        panel.beginSheetModal(for: window) { [weak self] response in
            guard response == .OK, let url = panel.url else {
                return
            }

            do {
                try png.write(to: url)
                self?.close()
            } catch {
                UploadCoordinator.shared.report(error)
            }
        }
    }

    func windowWillClose(_ notification: Notification) {
        Self.open.removeAll { $0 === self }
    }
}
