import AppKit
import KeyboardShortcuts
import Observation

/// The menu bar icon: a drop target for files and text, and the entry point to every action.
final class StatusItemController: NSObject, NSMenuDelegate, NSWindowDelegate {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let menu = NSMenu()
    private let actions: CaptureActions
    private let recorder = ScreenRecorder.shared
    private let uploads = UploadCoordinator.shared
    private let store = DropStore.shared
    private var recordingTimer: Timer?

    init(actions: CaptureActions) {
        self.actions = actions

        super.init()

        menu.delegate = self
        menu.autoenablesItems = false

        guard let button = statusItem.button else {
            return
        }

        button.target = self
        button.action = #selector(statusItemClicked)
        button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        button.window?.registerForDraggedTypes([.fileURL, .URL, .string, .png, .tiff])
        button.window?.delegate = self

        updateButton()
        observeState()
    }

    // MARK: - Button

    @objc private func statusItemClicked() {
        if recorder.isRecording {
            actions.stopRecording()

            return
        }

        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    private func observeState() {
        withObservationTracking {
            _ = recorder.isRecording
            _ = uploads.activeUploads.map(\.progress)
        } onChange: { [weak self] in
            Task { @MainActor in
                self?.updateButton()
                self?.observeState()
            }
        }
    }

    private func updateButton() {
        guard let button = statusItem.button else {
            return
        }

        if recorder.isRecording {
            button.image = NSImage(systemSymbolName: "stop.circle.fill", accessibilityDescription: "Stop recording")
            button.contentTintColor = .systemRed
            button.imagePosition = .imageLeading
            button.toolTip = "Recording. Click to stop (⇧⌘D)"
            updateRecordingTitle()

            if recordingTimer == nil {
                recordingTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
                    Task { @MainActor in self?.updateRecordingTitle() }
                }
            }

            return
        }

        recordingTimer?.invalidate()
        recordingTimer = nil
        button.contentTintColor = nil
        button.image = NSImage(systemSymbolName: "drop.fill", accessibilityDescription: "Dropshot")
        button.toolTip = "Dropshot: drop files here to upload"

        guard !uploads.activeUploads.isEmpty else {
            button.title = ""

            return
        }

        let total = uploads.activeUploads.map(\.progress).reduce(0, +) / Double(uploads.activeUploads.count)
        button.title = " \(Int(total * 100))%"
        button.imagePosition = .imageLeading
    }

    private func updateRecordingTitle() {
        guard let startedAt = recorder.startedAt else {
            return
        }

        let seconds = Int(Date.now.timeIntervalSince(startedAt))
        statusItem.button?.title = String(format: " %d:%02d", seconds / 60, seconds % 60)
    }

    // MARK: - Drag and drop onto the icon

    func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        statusItem.button?.highlight(true)

        return .copy
    }

    func draggingExited(_ sender: NSDraggingInfo?) {
        statusItem.button?.highlight(false)
    }

    func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        statusItem.button?.highlight(false)
        uploads.uploadPasteboard(sender.draggingPasteboard)

        return true
    }

    // MARK: - Menu

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()

        menu.addItem(item("Take Screenshot", symbol: "camera.viewfinder", action: #selector(screenshot), hotkey: .captureScreenshot))
        menu.addItem(item("Screenshot and Annotate", symbol: "pencil.and.outline", action: #selector(screenshotAndAnnotate), hotkey: .captureAndAnnotate))
        menu.addItem(item("Record Video", symbol: "record.circle", action: #selector(recordVideo), hotkey: .recordVideo))
        menu.addItem(item("Record GIF", symbol: "photo.stack", action: #selector(recordGIF), hotkey: .recordGIF))
        menu.addItem(.separator())
        menu.addItem(item("Upload File…", symbol: "arrow.up.doc", action: #selector(uploadFile), hotkey: .uploadFile))
        menu.addItem(item("Upload Clipboard", symbol: "doc.on.clipboard", action: #selector(uploadClipboard), hotkey: .uploadClipboard))
        menu.addItem(item("New Note…", symbol: "note.text", action: #selector(newNote), hotkey: .newNote))

        if !uploads.activeUploads.isEmpty {
            menu.addItem(.separator())

            for upload in uploads.activeUploads {
                let progress = NSMenuItem(title: "Uploading \(upload.filename) (\(Int(upload.progress * 100))%)", action: nil, keyEquivalent: "")
                progress.isEnabled = false
                menu.addItem(progress)
            }
        }

        menu.addItem(.separator())
        addRecentDrops(to: menu)
        menu.addItem(.separator())
        menu.addItem(item("Settings…", symbol: "gearshape", action: #selector(openSettings), key: ","))
        menu.addItem(item("Quit Dropshot", symbol: nil, action: #selector(quit), key: "q"))
    }

    private func addRecentDrops(to menu: NSMenu) {
        let header = NSMenuItem(title: "Recent Drops", action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)

        if store.drops.isEmpty {
            let empty = NSMenuItem(title: "Nothing yet. Drop a file on the icon.", action: nil, keyEquivalent: "")
            empty.isEnabled = false
            menu.addItem(empty)

            return
        }

        for drop in store.drops.prefix(10) {
            let dropItem = NSMenuItem(title: drop.filename, action: #selector(openInBrowser(_:)), keyEquivalent: "")
            dropItem.target = self
            dropItem.representedObject = drop.id
            dropItem.image = thumbnail(for: drop)
            dropItem.toolTip = drop.url.absoluteString
            dropItem.submenu = submenu(for: drop)
            menu.addItem(dropItem)
        }

        let clear = item("Clear History", symbol: nil, action: #selector(clearHistory))
        clear.indentationLevel = 0
        menu.addItem(clear)
    }

    private func submenu(for drop: Drop) -> NSMenu {
        let submenu = NSMenu()
        submenu.autoenablesItems = false

        let entries: [(String, Selector, Bool)] = [
            ("Copy Link", #selector(copyLink(_:)), true),
            ("Copy as Markdown", #selector(copyMarkdown(_:)), true),
            ("Copy as HTML", #selector(copyHTML(_:)), true),
            ("Open in Browser", #selector(openInBrowser(_:)), true),
            ("Show in Finder", #selector(showInFinder(_:)), drop.localCopy.map { FileManager.default.fileExists(atPath: $0.path) } ?? false),
            ("Remove from History", #selector(removeFromHistory(_:)), true),
        ]

        for (title, selector, enabled) in entries {
            let entry = NSMenuItem(title: title, action: selector, keyEquivalent: "")
            entry.target = self
            entry.representedObject = drop.id
            entry.isEnabled = enabled
            submenu.addItem(entry)
        }

        let detail = NSMenuItem(title: "\(drop.url.absoluteString)", action: nil, keyEquivalent: "")
        detail.isEnabled = false
        submenu.addItem(.separator())
        submenu.addItem(detail)

        let meta = NSMenuItem(title: "\(ByteCountFormatter.string(fromByteCount: drop.byteCount, countStyle: .file)) · \(drop.createdAt.formatted(.relative(presentation: .named)))", action: nil, keyEquivalent: "")
        meta.isEnabled = false
        submenu.addItem(meta)

        return submenu
    }

    private func thumbnail(for drop: Drop) -> NSImage? {
        if drop.kind == .image, let local = drop.localCopy, let image = NSImage(contentsOf: local) {
            let size = NSSize(width: 18, height: 18 * image.size.height / max(image.size.width, 1))
            image.size = NSSize(width: size.width, height: min(size.height, 18))

            return image
        }

        let symbol = switch drop.kind {
        case .image: "photo"
        case .video: "film"
        case .text: "doc.plaintext"
        case .link: "link"
        case .file: "doc"
        }

        return NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
    }

    private func item(_ title: String, symbol: String?, action: Selector, key: String = "", hotkey: KeyboardShortcuts.Name? = nil) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self

        if let symbol {
            item.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
        }

        if let hotkey {
            item.setShortcut(for: hotkey)
        }

        return item
    }

    private func drop(for sender: NSMenuItem) -> Drop? {
        store.drops.first { $0.id == sender.representedObject as? String }
    }

    // MARK: - Actions

    @objc private func screenshot() { actions.screenshot(annotate: nil) }
    @objc private func screenshotAndAnnotate() { actions.screenshot(annotate: true) }
    @objc private func recordVideo() { actions.startRecording(as: .video) }
    @objc private func recordGIF() { actions.startRecording(as: .gif) }
    @objc private func uploadFile() { actions.chooseFiles() }
    @objc private func uploadClipboard() { uploads.uploadPasteboard() }
    @objc private func newNote() { actions.newNote() }
    @objc private func openSettings() { SettingsOpener.open() }
    @objc private func quit() { NSApp.terminate(nil) }
    @objc private func clearHistory() { store.clear() }

    @objc private func copyLink(_ sender: NSMenuItem) {
        guard let drop = drop(for: sender) else {
            return
        }

        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(drop.url.absoluteString, forType: .string)
    }

    @objc private func copyMarkdown(_ sender: NSMenuItem) {
        guard let drop = drop(for: sender) else {
            return
        }

        let link = drop.kind == .image ? "![\(drop.filename)](\(drop.url.absoluteString))" : "[\(drop.filename)](\(drop.url.absoluteString))"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(link, forType: .string)
    }

    @objc private func copyHTML(_ sender: NSMenuItem) {
        guard let drop = drop(for: sender) else {
            return
        }

        let url = drop.url.absoluteString
        let html = drop.kind == .image ? "<img src=\"\(url)\" alt=\"\(drop.filename)\">" : "<a href=\"\(url)\">\(drop.filename)</a>"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(html, forType: .string)
    }

    @objc private func openInBrowser(_ sender: NSMenuItem) {
        guard let drop = drop(for: sender) else {
            return
        }

        NSWorkspace.shared.open(drop.url)
    }

    @objc private func showInFinder(_ sender: NSMenuItem) {
        guard let local = drop(for: sender)?.localCopy else {
            return
        }

        NSWorkspace.shared.activateFileViewerSelecting([local])
    }

    @objc private func removeFromHistory(_ sender: NSMenuItem) {
        guard let drop = drop(for: sender) else {
            return
        }

        store.remove(drop)
    }
}
