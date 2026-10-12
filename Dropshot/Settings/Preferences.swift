import AVFoundation
import Foundation
import Observation

enum MicrophoneChoice {
    static let none = ""
    static let systemDefault = "default"

    /// Audio inputs as (unique ID, name); ScreenCaptureKit's `microphoneCaptureDeviceID` takes the AVCaptureDevice unique ID.
    static var devices: [(id: String, name: String)] {
        AVCaptureDevice.DiscoverySession(deviceTypes: [.microphone, .external], mediaType: .audio, position: .unspecified)
            .devices
            .map { ($0.uniqueID, $0.localizedName) }
    }

    /// The input's channel count, so the microphone track matches it. Falls back to mono.
    static func channelCount(for choice: String) -> Int {
        let device = choice == systemDefault ? AVCaptureDevice.default(for: .audio) : AVCaptureDevice(uniqueID: choice)

        guard let format = device?.activeFormat.formatDescription, let description = CMAudioFormatDescriptionGetStreamBasicDescription(format) else {
            return 1
        }

        return Int(description.pointee.mChannelsPerFrame)
    }
}

enum CameraChoice {
    static let systemDefault = ""

    static var devices: [(id: String, name: String)] {
        AVCaptureDevice.DiscoverySession(deviceTypes: [.builtInWideAngleCamera, .external, .continuityCamera], mediaType: .video, position: .unspecified)
            .devices
            .map { ($0.uniqueID, $0.localizedName) }
    }

    /// The chosen camera, falling back to the system default when it has been unplugged.
    static func device(for choice: String) -> AVCaptureDevice? {
        AVCaptureDevice(uniqueID: choice) ?? AVCaptureDevice.default(for: .video)
    }
}

enum CameraSize: String, CaseIterable, Identifiable {
    case small
    case medium
    case large

    var id: String { rawValue }

    var title: String {
        switch self {
        case .small: "Small"
        case .medium: "Medium"
        case .large: "Large"
        }
    }

    var diameter: CGFloat {
        switch self {
        case .small: 120
        case .medium: 180
        case .large: 260
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
    /// Seconds counted down before a recording starts; 0 starts straight away.
    var recordingCountdown: Int { didSet { defaults.set(recordingCountdown, forKey: Keys.recordingCountdown) } }
    /// An AVCaptureDevice unique ID, or empty for the system default camera.
    var camera: String { didSet { defaults.set(camera, forKey: Keys.camera) } }
    var cameraSize: CameraSize { didSet { defaults.set(cameraSize.rawValue, forKey: Keys.cameraSize) } }
    var autoUploadScreenshots: Bool { didSet { defaults.set(autoUploadScreenshots, forKey: Keys.autoUploadScreenshots) } }
    var playSounds: Bool { didSet { defaults.set(playSounds, forKey: Keys.playSounds) } }
    var showNotifications: Bool { didSet { defaults.set(showNotifications, forKey: Keys.showNotifications) } }
    var keepLocalCopies: Bool { didSet { defaults.set(keepLocalCopies, forKey: Keys.keepLocalCopies) } }
    var instantLinks: Bool { didSet { defaults.set(instantLinks, forKey: Keys.instantLinks) } }
    var defaultPrivacy: DropPrivacy { didSet { defaults.set(defaultPrivacy.rawValue, forKey: Keys.defaultPrivacy) } }
    var defaultSelfDestruct: SelfDestruct { didSet { defaults.set(defaultSelfDestruct.rawValue, forKey: Keys.defaultSelfDestruct) } }
    var defaultAllowDownload: Bool { didSet { defaults.set(defaultAllowDownload, forKey: Keys.defaultAllowDownload) } }
    var dropPassword: String { didSet { Keychain.write(dropPassword, for: Keys.dropPassword) } }

    private init() {
        defaults.register(defaults: [
            Keys.region: "auto",
            Keys.usePathStyle: true,
            Keys.linkStyle: LinkStyle.withFilename.rawValue,
            Keys.screenshotAction: ScreenshotAction.upload.rawValue,
            Keys.microphone: MicrophoneChoice.systemDefault,
            Keys.recordSystemAudio: true,
            Keys.showClicksInRecordings: false,
            Keys.recordingCountdown: 3,
            Keys.camera: CameraChoice.systemDefault,
            Keys.cameraSize: CameraSize.medium.rawValue,
            Keys.autoUploadScreenshots: false,
            Keys.playSounds: true,
            Keys.showNotifications: true,
            Keys.keepLocalCopies: true,
            Keys.instantLinks: true,
            Keys.defaultPrivacy: DropPrivacy.public.rawValue,
            Keys.defaultSelfDestruct: SelfDestruct.keep.rawValue,
            Keys.defaultAllowDownload: true,
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
        recordingCountdown = defaults.integer(forKey: Keys.recordingCountdown)
        camera = defaults.string(forKey: Keys.camera) ?? CameraChoice.systemDefault
        cameraSize = CameraSize(rawValue: defaults.string(forKey: Keys.cameraSize) ?? "") ?? .medium
        autoUploadScreenshots = defaults.bool(forKey: Keys.autoUploadScreenshots)
        playSounds = defaults.bool(forKey: Keys.playSounds)
        showNotifications = defaults.bool(forKey: Keys.showNotifications)
        keepLocalCopies = defaults.bool(forKey: Keys.keepLocalCopies)
        instantLinks = defaults.bool(forKey: Keys.instantLinks)
        defaultPrivacy = DropPrivacy(rawValue: defaults.string(forKey: Keys.defaultPrivacy) ?? "") ?? .public
        defaultSelfDestruct = SelfDestruct(rawValue: defaults.string(forKey: Keys.defaultSelfDestruct) ?? "") ?? .keep
        defaultAllowDownload = defaults.bool(forKey: Keys.defaultAllowDownload)
        dropPassword = Keychain.read(Keys.dropPassword) ?? ""
    }

    var dropSettings: DropSettings {
        DropSettings(privacy: defaultPrivacy, password: dropPassword, selfDestruct: defaultSelfDestruct, allowDownload: defaultAllowDownload)
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
        static let recordingCountdown = "capture.recordingCountdown"
        static let camera = "capture.camera"
        static let cameraSize = "capture.cameraSize"
        static let autoUploadScreenshots = "capture.autoUploadScreenshots"
        static let playSounds = "general.playSounds"
        static let showNotifications = "general.showNotifications"
        static let keepLocalCopies = "general.keepLocalCopies"
        static let instantLinks = "general.instantLinks"
        static let defaultPrivacy = "drops.privacy"
        static let defaultSelfDestruct = "drops.selfDestruct"
        static let defaultAllowDownload = "drops.allowDownload"
        static let dropPassword = "drops.password"
    }
}
