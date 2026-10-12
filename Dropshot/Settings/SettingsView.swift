import AppKit
import KeyboardShortcuts
import ServiceManagement
import SwiftUI

struct SettingsView: View {
    var body: some View {
        TabView {
            GeneralSettings()
                .tabItem { Label("General", systemImage: "gearshape") }

            StorageSettings()
                .tabItem { Label("Storage", systemImage: "externaldrive.connected.to.line.below") }

            CaptureSettings()
                .tabItem { Label("Capture", systemImage: "camera.viewfinder") }

            ShortcutSettings()
                .tabItem { Label("Shortcuts", systemImage: "keyboard") }
        }
        .frame(width: 540, height: 560)
        .scenePadding()
    }
}

private struct GeneralSettings: View {
    @Bindable private var preferences = Preferences.shared
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    var body: some View {
        Form {
            Toggle("Launch at login", isOn: $launchAtLogin)
                .onChange(of: launchAtLogin) { _, enabled in
                    try? enabled ? SMAppService.mainApp.register() : SMAppService.mainApp.unregister()
                }

            Toggle("Play sounds", isOn: $preferences.playSounds)
            Toggle("Show a notification when the link is copied", isOn: $preferences.showNotifications)
            Toggle(isOn: $preferences.keepLocalCopies) {
                Text("Keep screenshots and recordings after upload")
                Text("Off deletes Dropshot's own captures once they upload. Files you upload from elsewhere are never deleted.")
            }
        }
        .formStyle(.grouped)
    }
}

private struct StorageSettings: View {
    @Bindable private var preferences = Preferences.shared
    @State private var testResult: String?
    @State private var isTesting = false

    var body: some View {
        Form {
            Section {
                TextField("Endpoint", text: $preferences.endpoint, prompt: Text("https://<account>.r2.cloudflarestorage.com"))
                TextField("Bucket", text: $preferences.bucket)
                TextField("Region", text: $preferences.region, prompt: Text("auto"))
                TextField("Access key ID", text: $preferences.accessKeyId)
                SecureField("Secret access key", text: $preferences.secretAccessKey)
                Toggle("Path-style URLs", isOn: $preferences.usePathStyle)
            } header: {
                Text("S3-compatible storage")
            } footer: {
                Text("Works with Cloudflare R2, AWS S3, Backblaze B2 and MinIO. The secret is stored in your Keychain.")
                    .foregroundStyle(.secondary)
            }

            Section("Links") {
                TextField("Public base URL", text: $preferences.publicBaseURL, prompt: Text("https://d.example.com"))
                TextField("Key prefix", text: $preferences.keyPrefix, prompt: Text("optional, e.g. drops"))
                Picker("Link style", selection: $preferences.linkStyle) {
                    ForEach(LinkStyle.allCases) { Text($0.title).tag($0) }
                }
            }

            HStack {
                Button("Test Upload") { test() }
                    .disabled(isTesting || preferences.storageConfiguration == nil)

                if isTesting {
                    ProgressView().controlSize(.small)
                }

                if let testResult {
                    Text(testResult)
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                        .lineLimit(2)
                }
            }
        }
        .formStyle(.grouped)
    }

    private func test() {
        guard let configuration = preferences.storageConfiguration else {
            return
        }

        isTesting = true
        testResult = nil

        Task {
            defer { isTesting = false }

            let file = FileManager.default.temporaryDirectory.appending(path: "dropshot-test.txt")

            do {
                try "Dropshot test upload \(Date.now)".write(to: file, atomically: true, encoding: .utf8)
                let result = try await S3Uploader(configuration: configuration) { _ in }
                    .upload(fileAt: file, filename: "dropshot-test.txt", shortId: "_test")
                let (_, response) = try await URLSession.shared.data(from: result.directURL)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0

                testResult = status == 200
                    ? "Uploaded and publicly readable: \(result.directURL.absoluteString)"
                    : "Uploaded, but the public URL returned HTTP \(status). Check the public base URL."
            } catch {
                testResult = error.localizedDescription
            }
        }
    }
}

private struct CaptureSettings: View {
    @Bindable private var preferences = Preferences.shared

    var body: some View {
        Form {
            Picker("After taking a screenshot", selection: $preferences.screenshotAction) {
                ForEach(ScreenshotAction.allCases) { Text($0.title).tag($0) }
            }

            Toggle("Show clicks in recordings", isOn: $preferences.showClicksInRecordings)

            Section("Sound") {
                Picker("Microphone", selection: $preferences.microphone) {
                    Text("None").tag(MicrophoneChoice.none)
                    Text("Default input").tag(MicrophoneChoice.systemDefault)

                    Divider()

                    ForEach(MicrophoneChoice.devices, id: \.id) { device in
                        Text(device.name).tag(device.id)
                    }
                }

                Toggle("Record system audio", isOn: $preferences.recordSystemAudio)
            }
        }
        .formStyle(.grouped)
    }
}

private struct ShortcutSettings: View {
    var body: some View {
        Form {
            KeyboardShortcuts.Recorder("Upload clipboard:", name: .uploadClipboard)
            KeyboardShortcuts.Recorder("Screenshot:", name: .captureScreenshot)
            KeyboardShortcuts.Recorder("Screenshot and annotate:", name: .captureAndAnnotate)
            KeyboardShortcuts.Recorder("Record video:", name: .recordVideo)
            KeyboardShortcuts.Recorder("Record GIF:", name: .recordGIF)
            KeyboardShortcuts.Recorder("Finish recording:", name: .finishRecording)
            KeyboardShortcuts.Recorder("Upload file:", name: .uploadFile)
            KeyboardShortcuts.Recorder("New note:", name: .newNote)
            KeyboardShortcuts.Recorder("New code snippet:", name: .newCodeSnippet)
        }
        .formStyle(.grouped)
    }
}

/// Hosts the settings view in a regular window; Dropshot is an AppKit menu bar app with no SwiftUI scenes.
enum SettingsOpener {
    private static var window: NSWindow?

    static func open() {
        NSApp.activate()

        if let window {
            window.makeKeyAndOrderFront(nil)

            return
        }

        let window = NSWindow(contentViewController: NSHostingController(rootView: SettingsView()))
        window.title = "Dropshot Settings"
        window.styleMask = [.titled, .closable]
        window.isReleasedWhenClosed = false
        window.center()
        window.makeKeyAndOrderFront(nil)

        self.window = window
    }
}
