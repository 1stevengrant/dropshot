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
        statusItem.menu = menu
        statusItem.button?.performClick(nil)
        statusItem.menu = nil
    }

    private func observeState() {
        withObservationTracking {
            _ = recorder.state
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
            button.image = NSImage(systemSymbolName: recorder.isPaused ? "pause.circle.fill" : "stop.circle.fill", accessibilityDescription: "Recording")
            button.contentTintColor = recorder.isPaused ? .systemOrange : .systemRed
            button.imagePosition = .imageLeading
            button.toolTip = recorder.isPaused ? "Recording paused" : "Recording. Finish with ⇧⌘D"
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

        let sending = uploads.activeUploads.filter { !$0.isPreparing }
        let total = sending.map(\.progress).reduce(0, +) / Double(max(sending.count, 1))
        button.title = sending.isEmpty ? " …" : " \(Int(total * 100))%"
        button.imagePosition = .imageLeading
    }

    private func updateRecordingTitle() {
        statusItem.button?.title = recorder.state == .countdown ? "" : " \(ScreenRecorder.format(recorder.elapsed()))"
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

        if recorder.isRecording {
            addRecordingControls(to: menu)

            return
        }

        menu.addItem(item("Take Screenshot", symbol: "camera.viewfinder", action: #selector(screenshot), hotkey: .captureScreenshot))
        menu.addItem(item("Screenshot and Annotate", symbol: "pencil.and.outline", action: #selector(screenshotAndAnnotate), hotkey: .captureAndAnnotate))
        menu.addItem(item("Record Video", symbol: "record.circle", action: #selector(recordVideo), hotkey: .recordVideo))
        menu.addItem(item("Record GIF", symbol: "photo.stack", action: #selector(recordGIF), hotkey: .recordGIF))
        menu.addItem(item("Record with Camera", symbol: "person.crop.circle", action: #selector(recordWithCamera), hotkey: .recordWithCamera))
        menu.addItem(item("Capture Web Page…", symbol: "globe", action: #selector(captureWebPage), hotkey: .captureWebPage))
        menu.addItem(.separator())
        menu.addItem(item("Upload File…", symbol: "arrow.up.doc", action: #selector(uploadFile), hotkey: .uploadFile))
        menu.addItem(item("Upload Clipboard", symbol: "doc.on.clipboard", action: #selector(uploadClipboard), hotkey: .uploadClipboard))
        menu.addItem(item("New Note…", symbol: "note.text", action: #selector(newNote), hotkey: .newNote))
        menu.addItem(item("New Code Snippet…", symbol: "chevron.left.forwardslash.chevron.right", action: #selector(newCodeSnippet), hotkey: .newCodeSnippet))

        if !uploads.activeUploads.isEmpty {
            menu.addItem(.separator())

            for upload in uploads.activeUploads {
                let title = upload.isPreparing ? "Capturing \(upload.filename)…" : "Uploading \(upload.filename) (\(Int(upload.progress * 100))%)"
                let progress = NSMenuItem(title: title, action: nil, keyEquivalent: "")
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

    private func addRecordingControls(to menu: NSMenu) {
        menu.addItem(item("Finish Recording", symbol: "stop.fill", action: #selector(finishRecording), hotkey: .finishRecording))
        menu.addItem(item(recorder.isPaused ? "Resume" : "Pause", symbol: recorder.isPaused ? "play.fill" : "pause.fill", action: #selector(togglePause), hotkey: .pauseRecording))

        if recorder.hasMicrophone {
            menu.addItem(item(recorder.isMuted ? "Unmute Microphone" : "Mute Microphone", symbol: recorder.isMuted ? "mic.fill" : "mic.slash.fill", action: #selector(toggleMute), hotkey: .muteRecording))
        }

        menu.addItem(.separator())
        menu.addItem(item("Cancel Recording", symbol: "trash", action: #selector(cancelRecording), hotkey: .cancelRecording))

        // During the countdown only Cancel applies; while the movie is being written nothing does.
        let isCapturing = recorder.state == .recording || recorder.state == .paused

        for entry in menu.items {
            entry.isEnabled = entry.action == #selector(cancelRecording) ? recorder.state != .finishing : isCapturing
        }
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
            ("Copy Direct Link", #selector(copyDirectLink(_:)), drop.directURL != nil),
            ("Copy as Markdown", #selector(copyMarkdown(_:)), true),
            ("Copy as HTML", #selector(copyHTML(_:)), true),
            ("Open in Browser", #selector(openInBrowser(_:)), true),
            // The share link shows the owner the management view, where privacy and expiry can be changed later.
            ("Manage…", #selector(openInBrowser(_:)), true),
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
        case .code: "chevron.left.forwardslash.chevron.right"
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
    @objc private func recordWithCamera() { actions.startRecording(as: .video, camera: true) }
    @objc private func finishRecording() { actions.stopRecording() }
    @objc private func togglePause() { actions.togglePause() }
    @objc private func toggleMute() { actions.toggleMute() }
    @objc private func cancelRecording() { actions.cancelRecording() }
    @objc private func captureWebPage() { actions.captureWebPage() }
    @objc private func uploadFile() { actions.chooseFiles() }
    @objc private func uploadClipboard() { uploads.uploadPasteboard() }
    @objc private func newNote() { actions.newNote() }
    @objc private func newCodeSnippet() { actions.newCodeSnippet() }
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

    @objc private func copyDirectLink(_ sender: NSMenuItem) {
        guard let directURL = drop(for: sender)?.directURL else {
            return
        }

        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(directURL.absoluteString, forType: .string)
    }

    @objc private func copyMarkdown(_ sender: NSMenuItem) {
        guard let drop = drop(for: sender) else {
            return
        }

        let link = drop.kind == .image ? "![\(drop.filename)](\((drop.directURL ?? drop.url).absoluteString))" : "[\(drop.filename)](\(drop.url.absoluteString))"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(link, forType: .string)
    }

    @objc private func copyHTML(_ sender: NSMenuItem) {
        guard let drop = drop(for: sender) else {
            return
        }

        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(drop.clipboardHTML, forType: .string)
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
