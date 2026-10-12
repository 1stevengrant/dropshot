import AppKit
import ImageIO
import WebKit

/// Renders a web page offscreen in WebKit and snapshots its full length. The menu bar twin of the Worker's
/// Browser Rendering capture: no Screen Recording permission needed, and nothing goes through the Worker.
final class WebPageCapture: NSObject, WKNavigationDelegate {
    private static let width: CGFloat = 1440
    /// Matches the Worker's cap, so endless pages stay a sane size.
    private static let maxHeight: CGFloat = 8192
    private static let timeout: Duration = .seconds(30)

    private var navigation: CheckedContinuation<Void, Error>?

    static func capture(_ url: URL) async throws -> (image: Data, fileExtension: String, title: String) {
        try await WebPageCapture().capture(url)
    }

    private func capture(_ url: URL) async throws -> (image: Data, fileExtension: String, title: String) {
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: Self.width, height: 900))
        webView.navigationDelegate = self

        // WebKit throttles windows macOS considers hidden, which stalls scroll triggered reveals and leaves sections
        // blank. So the window sits on screen, practically transparent and click-through, for the few seconds it takes.
        let origin = NSScreen.main?.frame.origin ?? .zero
        let window = NSWindow(contentRect: CGRect(origin: origin, size: CGSize(width: Self.width, height: 900)), styleMask: .borderless, backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.alphaValue = 0.01
        window.ignoresMouseEvents = true
        window.level = .floating
        window.contentView = webView
        window.orderFrontRegardless()

        defer {
            webView.stopLoading()
            window.close()
        }

        try await load(url, in: webView)
        try await loadLazyContent(in: webView)

        let height = min(try await number(from: webView, script: "document.documentElement.scrollHeight"), Self.maxHeight)
        let title = (try await webView.evaluateJavaScript("document.title") as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        // A view as tall as the page keeps fixed headers at the top and runs scroll triggered reveals.
        window.setContentSize(CGSize(width: Self.width, height: height))
        webView.frame = CGRect(x: 0, y: 0, width: Self.width, height: height)
        try await Task.sleep(for: .seconds(1))

        let snapshot = try await webView.takeSnapshot(configuration: nil)

        if let avif = Self.avifData(snapshot) {
            return (avif, "avif", title)
        }

        guard let png = snapshot.pngData else {
            throw CaptureError.failed("Couldn't encode the capture of \(url.host() ?? url.absoluteString).")
        }

        return (png, "png", title)
    }

    /// AVIF is about a fifth of the PNG's size with no visible loss on text at 2x, and macOS encodes it natively.
    /// WebP would need a library and can't hold the tallest 2x captures (16,383px limit).
    private static func avifData(_ image: NSImage) -> Data? {
        guard let cgImage = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return nil
        }

        let data = NSMutableData()

        guard let destination = CGImageDestinationCreateWithData(data, "public.avif" as CFString, 1, nil) else {
            return nil
        }

        CGImageDestinationAddImage(destination, cgImage, [kCGImageDestinationLossyCompressionQuality: 0.6] as CFDictionary)

        return CGImageDestinationFinalize(destination) ? data as Data : nil
    }

    private func load(_ url: URL, in webView: WKWebView) async throws {
        let timeout = Task {
            try await Task.sleep(for: Self.timeout)
            finishNavigation(with: CaptureError.failed("\(url.host() ?? url.absoluteString) took too long to load."))
        }

        defer { timeout.cancel() }

        try await withCheckedThrowingContinuation { continuation in
            navigation = continuation
            webView.load(URLRequest(url: url))
        }
    }

    /// Scrolls through the page so lazily loaded images render before the capture.
    private func loadLazyContent(in webView: WKWebView) async throws {
        let script = """
            const limit = Math.min(document.documentElement.scrollHeight, \(Int(Self.maxHeight)));
            for (let y = 0; y < limit; y += window.innerHeight) {
                window.scrollTo(0, y);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            window.scrollTo(0, 0);
            """

        _ = try await webView.callAsyncJavaScript(script, contentWorld: .page)
        try await Task.sleep(for: .milliseconds(500))
    }

    private func number(from webView: WKWebView, script: String) async throws -> CGFloat {
        CGFloat((try await webView.evaluateJavaScript(script) as? NSNumber)?.doubleValue ?? 900)
    }

    private func finishNavigation(with error: Error? = nil) {
        guard let navigation else {
            return
        }

        self.navigation = nil

        if let error {
            navigation.resume(throwing: error)

            return
        }

        navigation.resume()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        finishNavigation()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finishNavigation(with: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finishNavigation(with: error)
    }
}
