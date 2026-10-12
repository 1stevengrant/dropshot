import AppKit
import AVFoundation

/// A round, mirrored camera preview that floats inside the recorded area and is recorded with it. Drag it anywhere,
/// also while recording.
final class CameraBubble {
    private let panel: NSPanel
    private let session: AVCaptureSession

    /// The window server's ID for the bubble, for letting it into the capture filter.
    var windowID: CGWindowID { CGWindowID(panel.windowNumber) }

    /// Asks for camera access the first time, then shows the bubble in the bottom left corner of `frame`.
    static func show(camera: String, size: CameraSize, in frame: NSRect) async throws -> CameraBubble {
        guard await AVCaptureDevice.requestAccess(for: .video) else {
            throw CaptureError.failed("Dropshot needs camera access for the camera bubble. Enable it in System Settings › Privacy & Security › Camera.")
        }

        guard let device = CameraChoice.device(for: camera) else {
            throw CaptureError.failed("No camera is available for the camera bubble.")
        }

        return try CameraBubble(device: device, diameter: size.diameter, in: frame)
    }

    private init(device: AVCaptureDevice, diameter: CGFloat, in frame: NSRect) throws {
        session = AVCaptureSession()
        session.sessionPreset = .high

        let input = try AVCaptureDeviceInput(device: device)

        guard session.canAddInput(input) else {
            throw CaptureError.failed("Couldn't use \(device.localizedName) for the camera bubble.")
        }

        session.addInput(input)

        let inset: CGFloat = 24
        let size = min(diameter, frame.width - inset * 2, frame.height - inset * 2)
        let origin = NSPoint(x: frame.minX + inset, y: frame.minY + inset)

        panel = NSPanel(contentRect: NSRect(origin: origin, size: NSSize(width: max(size, 60), height: max(size, 60))), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.isReleasedWhenClosed = false
        panel.hidesOnDeactivate = false
        panel.animationBehavior = .none
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.contentView = BubbleView(session: session)

        let session = session
        DispatchQueue.global(qos: .userInitiated).async { session.startRunning() }

        panel.orderFrontRegardless()
        panel.invalidateShadow()
    }

    func close() {
        panel.orderOut(nil)

        let session = session
        DispatchQueue.global(qos: .userInitiated).async { session.stopRunning() }
    }
}

private final class BubbleView: NSView {
    init(session: AVCaptureSession) {
        super.init(frame: .zero)

        wantsLayer = true

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        preview.connection?.automaticallyAdjustsVideoMirroring = false
        preview.connection?.isVideoMirrored = true

        let root = CALayer()
        root.masksToBounds = true
        root.borderColor = NSColor.white.withAlphaComponent(0.9).cgColor
        root.borderWidth = 3
        root.backgroundColor = NSColor.black.cgColor
        root.addSublayer(preview)
        layer = root
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var mouseDownCanMoveWindow: Bool { true }

    override func layout() {
        super.layout()

        layer?.cornerRadius = bounds.width / 2
        layer?.sublayers?.first?.frame = bounds
    }
}
