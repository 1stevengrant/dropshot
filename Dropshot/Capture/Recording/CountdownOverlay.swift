import AppKit
import SwiftUI

/// Large numbers centred on the area about to be recorded, one per second.
enum CountdownOverlay {
    /// Throws `CancellationError` when the surrounding task is cancelled.
    static func run(seconds: Int, over frame: NSRect) async throws {
        let size = NSSize(width: 160, height: 160)
        let window = NSWindow(contentRect: NSRect(x: frame.midX - size.width / 2, y: frame.midY - size.height / 2, width: size.width, height: size.height), styleMask: .borderless, backing: .buffered, defer: false)
        window.level = .screenSaver
        window.isOpaque = false
        window.backgroundColor = .clear
        window.ignoresMouseEvents = true
        window.isReleasedWhenClosed = false
        window.animationBehavior = .none
        window.sharingType = .none
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        defer { window.orderOut(nil) }

        for remaining in stride(from: seconds, to: 0, by: -1) {
            window.contentView = NSHostingView(rootView: CountdownNumber(value: remaining))
            window.orderFrontRegardless()

            try await Task.sleep(for: .seconds(1))
        }
    }
}

private struct CountdownNumber: View {
    let value: Int

    var body: some View {
        Text("\(value)")
            .font(.system(size: 96, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
            .frame(width: 160, height: 160)
            .background(.black.opacity(0.6), in: RoundedRectangle(cornerRadius: 32))
    }
}
