import AppKit
import SwiftUI

/// A floating bar next to the recorded area with stop, pause, mute and delete. It never appears in the recording:
/// the capture filter leaves out Dropshot's windows and the panel is also hidden from screen sharing.
final class RecordingControlBar {
    private let panel: NSPanel

    init(beside frame: NSRect) {
        let hosting = NSHostingView(rootView: RecordingControls(recorder: .shared))
        let size = hosting.fittingSize

        panel = NSPanel(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.contentView = hosting
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.isReleasedWhenClosed = false
        panel.hidesOnDeactivate = false
        panel.sharingType = .none
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.setFrameOrigin(Self.origin(for: size, beside: frame))
        panel.orderFrontRegardless()
    }

    func close() {
        panel.orderOut(nil)
    }

    /// Below the area if it fits on that screen, otherwise above it, otherwise inside along its bottom edge.
    private static func origin(for size: NSSize, beside frame: NSRect) -> NSPoint {
        let gap: CGFloat = 12
        let visible = (NSScreen.screens.first { $0.frame.intersects(frame) } ?? NSScreen.main)?.visibleFrame ?? frame
        let x = min(max(frame.midX - size.width / 2, visible.minX + gap), visible.maxX - size.width - gap)

        if frame.minY - gap - size.height >= visible.minY {
            return NSPoint(x: x, y: frame.minY - gap - size.height)
        }

        if frame.maxY + gap + size.height <= visible.maxY {
            return NSPoint(x: x, y: frame.maxY + gap)
        }

        return NSPoint(x: x, y: max(frame.minY, visible.minY) + gap * 2)
    }
}

private struct RecordingControls: View {
    let recorder: ScreenRecorder

    var body: some View {
        HStack(spacing: 4) {
            TimelineView(.periodic(from: .now, by: 0.5)) { context in
                Text(ScreenRecorder.format(recorder.elapsed(at: context.date)))
                    .font(.system(.body, design: .rounded).monospacedDigit())
                    .foregroundStyle(recorder.isPaused ? .secondary : .primary)
                    .frame(minWidth: 52)
            }

            button("Stop", symbol: "stop.fill", tint: .red) { recorder.finish() }

            button(recorder.isPaused ? "Resume" : "Pause", symbol: recorder.isPaused ? "play.fill" : "pause.fill") { recorder.togglePause() }

            if recorder.hasMicrophone {
                button(recorder.isMuted ? "Unmute" : "Mute", symbol: recorder.isMuted ? "mic.slash.fill" : "mic.fill") { recorder.toggleMute() }
            }

            button("Cancel and Delete", symbol: "trash") { recorder.cancel() }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.regularMaterial, in: Capsule())
        .fixedSize()
    }

    private func button(_ title: String, symbol: String, tint: Color? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(tint ?? .primary)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(title)
        .accessibilityLabel(title)
    }
}
