import AppKit

@main
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let actions = CaptureActions()
    private var statusItemController: StatusItemController?
    private let screenshotWatcher = ScreenshotWatcher()

    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.mainMenu = Self.makeMainMenu()
        statusItemController = StatusItemController(actions: actions)

        NSApp.servicesProvider = ServicesProvider()
        NSUpdateDynamicServices()

        Hotkeys.register(actions)
        Notifier.requestAuthorization()
        observeAutoUpload()

        if Preferences.shared.storageConfiguration == nil {
            SettingsOpener.open()
        }
    }

    /// Runs the screenshot watcher only while "Automatically upload macOS screenshots" is on.
    private func observeAutoUpload() {
        withObservationTracking {
            if Preferences.shared.autoUploadScreenshots {
                screenshotWatcher.start()
            } else {
                screenshotWatcher.stop()
            }
        } onChange: { [weak self] in
            Task { @MainActor in
                self?.observeAutoUpload()
            }
        }
    }

    /// An accessory app shows no menu bar, but key equivalents like ⌘V and ⌘W still route through the main menu.
    private static func makeMainMenu() -> NSMenu {
        let mainMenu = NSMenu()

        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Dropshot", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")

        for submenu in [appMenu, editMenu, windowMenu] {
            let item = NSMenuItem()
            item.submenu = submenu
            mainMenu.addItem(item)
        }

        return mainMenu
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            handle(url)
        }
    }

    /// dropshot://screenshot, dropshot://annotate, dropshot://record (dropshot://record?camera=1 adds the camera bubble), dropshot://gif, dropshot://stop, dropshot://pause, dropshot://mute,
    /// dropshot://clipboard, dropshot://note, dropshot://code, dropshot://upload?path=/absolute/file,
    /// dropshot://capture-url (asks for a URL) or dropshot://capture-url?url=https://example.com
    private func handle(_ url: URL) {
        if url.isFileURL {
            requestExternalUpload(url)

            return
        }

        guard url.scheme == "dropshot" else {
            return
        }

        switch url.host() {
        case "screenshot":
            actions.screenshot(annotate: nil)
        case "annotate":
            actions.screenshot(annotate: true)
        case "record":
            let camera = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "camera" }?.value == "1"
            actions.startRecording(as: .video, camera: camera)
        case "gif":
            actions.startRecording(as: .gif)
        case "stop":
            actions.stopRecording()
        case "pause":
            actions.togglePause()
        case "mute":
            actions.toggleMute()
        case "clipboard":
            UploadCoordinator.shared.uploadPasteboard()
        case "note":
            actions.newNote()
        case "code":
            actions.newCodeSnippet()
        case "capture-url":
            let address = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "url" }?.value
            actions.captureWebPage(address.flatMap(WebCaptureURL.parse))
        case "upload":
            let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "path" }?.value

            if let path, path.hasPrefix("/") {
                requestExternalUpload(URL(filePath: path))
            }
        default:
            break
        }
    }

    private func requestExternalUpload(_ url: URL) {
        let file = url.standardizedFileURL.resolvingSymlinksInPath()
        let alert = NSAlert()
        alert.messageText = "Upload this file?"
        alert.informativeText = "An external request wants to share the following file or folder using your storage account. Folders include all their contents.\n\n\(file.path)"
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Cancel")
        alert.addButton(withTitle: "Upload")
        NSApp.activate()

        guard alert.runModal() == .alertSecondButtonReturn else {
            return
        }

        UploadCoordinator.shared.upload(files: [file])
    }
}

/// Backs the "Upload with Dropshot" entries in the Finder and text Services menus.
final class ServicesProvider: NSObject {
    @objc func uploadService(_ pasteboard: NSPasteboard, userData: String?, error: AutoreleasingUnsafeMutablePointer<NSString?>) {
        UploadCoordinator.shared.uploadPasteboard(pasteboard)
    }

    @objc func uploadTextService(_ pasteboard: NSPasteboard, userData: String?, error: AutoreleasingUnsafeMutablePointer<NSString?>) {
        guard let text = pasteboard.string(forType: .string) else {
            return
        }

        UploadCoordinator.shared.upload(text: text)
    }
}
