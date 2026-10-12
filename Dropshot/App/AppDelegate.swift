import AppKit

@main
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let actions = CaptureActions()
    private var statusItemController: StatusItemController?

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

        if Preferences.shared.storageConfiguration == nil {
            SettingsOpener.open()
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

    /// dropshot://screenshot, dropshot://annotate, dropshot://record, dropshot://gif, dropshot://stop,
    /// dropshot://clipboard, dropshot://note, dropshot://code, dropshot://upload?path=/absolute/file
    private func handle(_ url: URL) {
        if url.isFileURL {
            UploadCoordinator.shared.upload(files: [url])

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
            actions.startRecording(as: .video)
        case "gif":
            actions.startRecording(as: .gif)
        case "stop":
            actions.stopRecording()
        case "clipboard":
            UploadCoordinator.shared.uploadPasteboard()
        case "note":
            actions.newNote()
        case "code":
            actions.newCodeSnippet()
        case "upload":
            let path = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first { $0.name == "path" }?.value

            if let path {
                UploadCoordinator.shared.upload(files: [URL(filePath: path)])
            }
        default:
            break
        }
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
