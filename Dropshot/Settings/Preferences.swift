import AVFoundation
import Foundation
import Observation

enum MicrophoneChoice {
    static let none = ""
    static let systemDefault = "default"

    /// Audio inputs as (unique ID, name); screencapture's -G accepts the AVCaptureDevice unique ID.
    static var devices: [(id: String, name: String)] {
        AVCaptureDevice.DiscoverySession(deviceTypes: [.microphone, .external], mediaType: .audio, position: .unspecified)
            .devices
            .map { ($0.uniqueID, $0.localizedName) }
    }

    static func arguments(for choice: String) -> [String] {
        switch choice {
        case none: []
        case systemDefault: ["-g"]
        default: ["-G\(choice)"]
        }
    }
}

enum ScreenshotAction: String, CaseIterable, Identifiable {
    case upload
    case annotate

    var id: String { rawValue }

    var title: String {
        switch self {
        case .upload: "Upload immediately"
        case .annotate: "Open in editor first"
        }
    }
}

enum RecordingFormat: String, CaseIterable, Identifiable {
    case video
    case gif

    var id: String { rawValue }

    var title: String {
        switch self {
        case .video: "Video (MOV)"
        case .gif: "Animated GIF"
        }
    }
}

nonisolated enum LinkStyle: String, CaseIterable, Identifiable {
    case withFilename
    case shortId

    var id: String { rawValue }

    var title: String {
        switch self {
        case .withFilename: "Short ID + filename"
        case .shortId: "Short ID only"
        }
    }
}

/// User preferences backed by UserDefaults. The S3 secret key lives in the Keychain.
@Observable
final class Preferences {
    static let shared = Preferences()

    @ObservationIgnored private let defaults = UserDefaults.standard

    var endpoint: String { didSet { defaults.set(endpoint, forKey: Keys.endpoint) } }
    var bucket: String { didSet { defaults.set(bucket, forKey: Keys.bucket) } }
    var region: String { didSet { defaults.set(region, forKey: Keys.region) } }
    var accessKeyId: String { didSet { defaults.set(accessKeyId, forKey: Keys.accessKeyId) } }
    var publicBaseURL: String { didSet { defaults.set(publicBaseURL, forKey: Keys.publicBaseURL) } }
    var keyPrefix: String { didSet { defaults.set(keyPrefix, forKey: Keys.keyPrefix) } }
    var usePathStyle: Bool { didSet { defaults.set(usePathStyle, forKey: Keys.usePathStyle) } }
    var linkStyle: LinkStyle { didSet { defaults.set(linkStyle.rawValue, forKey: Keys.linkStyle) } }

    var secretAccessKey: String { didSet { Keychain.write(secretAccessKey, for: Keys.secretAccessKey) } }

    var screenshotAction: ScreenshotAction { didSet { defaults.set(screenshotAction.rawValue, forKey: Keys.screenshotAction) } }
    /// Empty for no microphone, "default" for the system default input, otherwise an AVCaptureDevice unique ID.
    var microphone: String { didSet { defaults.set(microphone, forKey: Keys.microphone) } }
    var recordSystemAudio: Bool { didSet { defaults.set(recordSystemAudio, forKey: Keys.recordSystemAudio) } }
    var showClicksInRecordings: Bool { didSet { defaults.set(showClicksInRecordings, forKey: Keys.showClicksInRecordings) } }
    var playSounds: Bool { didSet { defaults.set(playSounds, forKey: Keys.playSounds) } }
    var showNotifications: Bool { didSet { defaults.set(showNotifications, forKey: Keys.showNotifications) } }
    var keepLocalCopies: Bool { didSet { defaults.set(keepLocalCopies, forKey: Keys.keepLocalCopies) } }

    private init() {
        defaults.register(defaults: [
            Keys.region: "auto",
            Keys.usePathStyle: true,
            Keys.linkStyle: LinkStyle.withFilename.rawValue,
            Keys.screenshotAction: ScreenshotAction.upload.rawValue,
            Keys.microphone: MicrophoneChoice.systemDefault,
            Keys.recordSystemAudio: true,
            Keys.showClicksInRecordings: false,
            Keys.playSounds: true,
            Keys.showNotifications: true,
            Keys.keepLocalCopies: true,
        ])

        endpoint = defaults.string(forKey: Keys.endpoint) ?? ""
        bucket = defaults.string(forKey: Keys.bucket) ?? ""
        region = defaults.string(forKey: Keys.region) ?? "auto"
        accessKeyId = defaults.string(forKey: Keys.accessKeyId) ?? ""
        publicBaseURL = defaults.string(forKey: Keys.publicBaseURL) ?? ""
        keyPrefix = defaults.string(forKey: Keys.keyPrefix) ?? ""
        usePathStyle = defaults.bool(forKey: Keys.usePathStyle)
        linkStyle = LinkStyle(rawValue: defaults.string(forKey: Keys.linkStyle) ?? "") ?? .withFilename
        secretAccessKey = Keychain.read(Keys.secretAccessKey) ?? ""
        screenshotAction = ScreenshotAction(rawValue: defaults.string(forKey: Keys.screenshotAction) ?? "") ?? .upload
        microphone = defaults.string(forKey: Keys.microphone) ?? MicrophoneChoice.systemDefault
        recordSystemAudio = defaults.bool(forKey: Keys.recordSystemAudio)
        showClicksInRecordings = defaults.bool(forKey: Keys.showClicksInRecordings)
        playSounds = defaults.bool(forKey: Keys.playSounds)
        showNotifications = defaults.bool(forKey: Keys.showNotifications)
        keepLocalCopies = defaults.bool(forKey: Keys.keepLocalCopies)
    }

    var storageConfiguration: StorageConfiguration? {
        StorageConfiguration(
            endpoint: endpoint,
            bucket: bucket,
            region: region,
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            publicBaseURL: publicBaseURL,
            keyPrefix: keyPrefix,
            usePathStyle: usePathStyle,
            linkStyle: linkStyle
        )
    }

    private enum Keys {
        static let endpoint = "storage.endpoint"
        static let bucket = "storage.bucket"
        static let region = "storage.region"
        static let accessKeyId = "storage.accessKeyId"
        static let secretAccessKey = "storage.secretAccessKey"
        static let publicBaseURL = "storage.publicBaseURL"
        static let keyPrefix = "storage.keyPrefix"
        static let usePathStyle = "storage.usePathStyle"
        static let linkStyle = "storage.linkStyle"
        static let screenshotAction = "capture.screenshotAction"
        static let microphone = "capture.microphone"
        static let recordSystemAudio = "capture.recordSystemAudio"
        static let showClicksInRecordings = "capture.showClicks"
        static let playSounds = "general.playSounds"
        static let showNotifications = "general.showNotifications"
        static let keepLocalCopies = "general.keepLocalCopies"
    }
}
