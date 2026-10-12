import AppKit
import ScreenCaptureKit

/// What to record: the capture filter, the part of the display it covers, and where that is on screen.
struct RecordingTarget {
    let filter: SCContentFilter
    /// Display-local points with a top-left origin, as `SCStreamConfiguration.sourceRect` expects. Nil records all of
    /// the filter's content (a whole display or one window).
    let sourceRect: CGRect?
    /// The same area in AppKit screen coordinates, for placing the countdown and control bar.
    let frame: NSRect
    let display: SCDisplay
    /// The picked window, when recording one window rather than an area of the display.
    let window: SCWindow?

    /// The same target with extra windows (the camera bubble) added to the recording. A single window filter can't
    /// take extra windows, so a window target becomes that window plus the extras, cropped to it.
    func including(_ extras: [SCWindow]) -> RecordingTarget {
        guard let window else {
            // "Excepting" only lets a window back in when its application is excluded; on its own it would leave the
            // window out. So exclude the extras' application (Dropshot) and except the extras.
            let applications = Dictionary(extras.compactMap(\.owningApplication).map { ($0.processID, $0) }, uniquingKeysWith: { first, _ in first })
            let filter = SCContentFilter(display: display, excludingApplications: Array(applications.values), exceptingWindows: extras)

            return RecordingTarget(filter: filter, sourceRect: sourceRect, frame: frame, display: display, window: nil)
        }

        let local = window.frame.offsetBy(dx: -display.frame.minX, dy: -display.frame.minY).intersection(CGRect(origin: .zero, size: display.frame.size))

        return RecordingTarget(filter: SCContentFilter(display: display, including: [window] + extras), sourceRect: local.integral, frame: frame, display: display, window: window)
    }
}

/// Full screen overlays, one per display, for choosing what to record. Dragging selects a region, a click or Space
/// picks the window under the cursor, Return records the whole display and Esc cancels.
enum RecordingRegionPicker {
    /// Returns nil when the user cancels.
    static func pick() async throws -> RecordingTarget? {
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)
        let session = PickerSession(content: content)

        return await session.run()
    }
}

private final class PickerSession {
    private let content: SCShareableContent
    private var windows: [PickerWindow] = []
    private var continuation: CheckedContinuation<RecordingTarget?, Never>?

    init(content: SCShareableContent) {
        self.content = content
    }

    func run() async -> RecordingTarget? {
        await withCheckedContinuation { continuation in
            self.continuation = continuation
            show()
        }
    }

    private func show() {
        NSApp.activate()

        let mouse = NSEvent.mouseLocation

        for screen in NSScreen.screens {
            let window = PickerWindow(screen: screen, session: self)
            windows.append(window)

            if screen.frame.contains(mouse) {
                window.makeKeyAndOrderFront(nil)
            } else {
                window.orderFrontRegardless()
            }
        }

        NSCursor.crosshair.push()
    }

    func finish(_ target: RecordingTarget?) {
        guard let continuation else {
            return
        }

        self.continuation = nil
        NSCursor.pop()
        windows.forEach { $0.orderOut(nil) }
        windows = []
        continuation.resume(returning: target)
    }

    // MARK: - Targets

    /// Dropshot has no windows on screen when this content is loaded, so ScreenCaptureKit doesn't list it and it can't
    /// be excluded by application here. Its control bar and countdown stay out of recordings with `sharingType = .none`.
    func displayFilter(for screen: NSScreen) -> SCContentFilter? {
        guard let display = display(for: screen) else {
            return nil
        }

        return SCContentFilter(display: display, excludingWindows: [])
    }

    func regionTarget(_ rect: NSRect, on screen: NSScreen) -> RecordingTarget? {
        guard let display = display(for: screen), let filter = displayFilter(for: screen) else {
            return nil
        }

        let local = CGRect(x: rect.minX - screen.frame.minX, y: screen.frame.maxY - rect.maxY, width: rect.width, height: rect.height)

        return RecordingTarget(filter: filter, sourceRect: local.integral, frame: rect, display: display, window: nil)
    }

    func displayTarget(on screen: NSScreen) -> RecordingTarget? {
        guard let display = display(for: screen), let filter = displayFilter(for: screen) else {
            return nil
        }

        return RecordingTarget(filter: filter, sourceRect: nil, frame: screen.frame, display: display, window: nil)
    }

    func windowTarget(_ window: SCWindow) -> RecordingTarget? {
        let center = CGPoint(x: window.frame.midX, y: window.frame.midY)

        guard let display = content.displays.first(where: { $0.frame.contains(center) }) ?? content.displays.first else {
            return nil
        }

        return RecordingTarget(filter: SCContentFilter(desktopIndependentWindow: window), sourceRect: nil, frame: Self.appKitRect(window.frame), display: display, window: window)
    }

    /// The frontmost normal window under a point in AppKit screen coordinates.
    func window(at point: NSPoint) -> SCWindow? {
        let candidates = Dictionary(
            content.windows
                .filter { $0.isOnScreen && $0.windowLayer == 0 && $0.owningApplication?.processID != ProcessInfo.processInfo.processIdentifier && $0.frame.width > 1 }
                .map { ($0.windowID, $0) },
            uniquingKeysWith: { first, _ in first }
        )

        // SCShareableContent doesn't promise an order, so take the front to back order from the window server.
        let ordered = (CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? [])
            .compactMap { $0[kCGWindowNumber as String] as? CGWindowID }

        return ordered.lazy.compactMap { candidates[$0] }.first { Self.appKitRect($0.frame).contains(point) }
    }

    private func display(for screen: NSScreen) -> SCDisplay? {
        let id = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID

        return content.displays.first { $0.displayID == id }
    }

    /// Converts the window server's top-left global coordinates to AppKit's bottom-left ones.
    static func appKitRect(_ rect: CGRect) -> NSRect {
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0

        return NSRect(x: rect.minX, y: primaryHeight - rect.maxY, width: rect.width, height: rect.height)
    }
}

private final class PickerWindow: NSWindow {
    init(screen: NSScreen, session: PickerSession) {
        super.init(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)

        level = .screenSaver
        isOpaque = false
        backgroundColor = .clear
        hasShadow = false
        ignoresMouseEvents = false
        acceptsMouseMovedEvents = true
        isReleasedWhenClosed = false
        animationBehavior = .none
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        setFrame(screen.frame, display: false)
        contentView = PickerView(screen: screen, session: session)
    }

    override var canBecomeKey: Bool { true }
}

private final class PickerView: NSView {
    private let screen: NSScreen
    private unowned let session: PickerSession
    private var dragStart: NSPoint?
    private var dragCurrent: NSPoint?
    private var hovered: SCWindow?

    init(screen: NSScreen, session: PickerSession) {
        self.screen = screen
        self.session = session

        super.init(frame: NSRect(origin: .zero, size: screen.frame.size))

        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseMoved, .activeAlways, .inVisibleRect, .cursorUpdate], owner: self))
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var acceptsFirstResponder: Bool { true }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func cursorUpdate(with event: NSEvent) {
        NSCursor.crosshair.set()
    }

    // MARK: - Geometry

    private var selection: NSRect? {
        guard let dragStart, let dragCurrent else {
            return nil
        }

        let rect = NSRect(x: min(dragStart.x, dragCurrent.x), y: min(dragStart.y, dragCurrent.y), width: abs(dragCurrent.x - dragStart.x), height: abs(dragCurrent.y - dragStart.y))

        return rect.width >= 4 && rect.height >= 4 ? rect : nil
    }

    private func screenPoint(_ point: NSPoint) -> NSPoint {
        NSPoint(x: point.x + screen.frame.minX, y: point.y + screen.frame.minY)
    }

    private func viewRect(_ rect: NSRect) -> NSRect {
        rect.offsetBy(dx: -screen.frame.minX, dy: -screen.frame.minY)
    }

    // MARK: - Events

    override func mouseMoved(with event: NSEvent) {
        let window = session.window(at: screenPoint(convert(event.locationInWindow, from: nil)))

        if window?.windowID != hovered?.windowID {
            hovered = window
            needsDisplay = true
        }
    }

    override func mouseDown(with event: NSEvent) {
        window?.makeKey()
        dragStart = convert(event.locationInWindow, from: nil)
        dragCurrent = dragStart
    }

    override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        dragCurrent = NSPoint(x: min(max(point.x, 0), bounds.width), y: min(max(point.y, 0), bounds.height))
        needsDisplay = true
    }

    override func mouseUp(with event: NSEvent) {
        defer {
            dragStart = nil
            dragCurrent = nil
            needsDisplay = true
        }

        if let selection {
            session.finish(session.regionTarget(selection.offsetBy(dx: screen.frame.minX, dy: screen.frame.minY), on: screen))

            return
        }

        pickHoveredWindow()
    }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 53:
            session.finish(nil)
        case 36, 76:
            session.finish(session.displayTarget(on: screen))
        case 49:
            pickHoveredWindow()
        default:
            super.keyDown(with: event)
        }
    }

    private func pickHoveredWindow() {
        let point = screenPoint(convert(window?.mouseLocationOutsideOfEventStream ?? .zero, from: nil))

        guard let target = session.window(at: point) else {
            NSSound.beep()

            return
        }

        session.finish(session.windowTarget(target))
    }

    // MARK: - Drawing

    override func draw(_ dirtyRect: NSRect) {
        NSColor.black.withAlphaComponent(0.3).setFill()
        bounds.fill()

        if let selection {
            NSColor.clear.setFill()
            selection.fill(using: .copy)
            NSColor.white.setStroke()

            let outline = NSBezierPath(rect: selection.insetBy(dx: -0.5, dy: -0.5))
            outline.lineWidth = 1
            outline.stroke()

            drawLabel("\(Int(selection.width)) × \(Int(selection.height))", below: selection)

            return
        }

        if let hovered {
            let rect = viewRect(PickerSession.appKitRect(hovered.frame)).intersection(bounds)
            NSColor.controlAccentColor.withAlphaComponent(0.25).setFill()
            rect.fill()
            NSColor.controlAccentColor.setStroke()

            let outline = NSBezierPath(rect: rect.insetBy(dx: 1, dy: 1))
            outline.lineWidth = 2
            outline.stroke()
        }

        drawHint()
    }

    private func drawHint() {
        let text = "Drag to record an area. Click or press Space to record a window. Return records the whole screen. Esc cancels."
        let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 14, weight: .medium), .foregroundColor: NSColor.white]
        let size = (text as NSString).size(withAttributes: attributes)
        let box = NSRect(x: bounds.midX - size.width / 2 - 14, y: bounds.maxY - 120, width: size.width + 28, height: size.height + 14)

        NSColor.black.withAlphaComponent(0.6).setFill()
        NSBezierPath(roundedRect: box, xRadius: 8, yRadius: 8).fill()
        (text as NSString).draw(at: NSPoint(x: box.minX + 14, y: box.minY + 7), withAttributes: attributes)
    }

    private func drawLabel(_ text: String, below rect: NSRect) {
        let attributes: [NSAttributedString.Key: Any] = [.font: NSFont.monospacedDigitSystemFont(ofSize: 12, weight: .medium), .foregroundColor: NSColor.white]
        let size = (text as NSString).size(withAttributes: attributes)
        let y = rect.minY - size.height - 12 > 0 ? rect.minY - size.height - 12 : rect.minY + 8
        let box = NSRect(x: rect.midX - size.width / 2 - 8, y: y, width: size.width + 16, height: size.height + 6)

        NSColor.black.withAlphaComponent(0.7).setFill()
        NSBezierPath(roundedRect: box, xRadius: 5, yRadius: 5).fill()
        (text as NSString).draw(at: NSPoint(x: box.minX + 8, y: box.minY + 3), withAttributes: attributes)
    }
}
