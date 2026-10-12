import AppKit
import ImageIO
import WebKit

/// Renders a web page offscreen in WebKit and snapshots its full length. The menu bar twin of the Worker's
/// Browser Rendering capture: no Screen Recording permission needed, and nothing goes through the Worker.
final class WebPageCapture: NSObject, WKNavigationDelegate {
    private static let width: CGFloat = 1440
    private static let viewportHeight: CGFloat = 900
    /// Matches the Worker's cap, so endless pages stay a sane size.
    private static let maxHeight: CGFloat = 8192
    private static let timeout: Duration = .seconds(30)

    private var navigation: CheckedContinuation<Void, Error>?

    static func capture(_ url: URL) async throws -> (image: Data, fileExtension: String, title: String) {
        try await WebPageCapture().capture(url)
    }

    private func capture(_ url: URL) async throws -> (image: Data, fileExtension: String, title: String) {
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: Self.width, height: Self.viewportHeight))
        webView.navigationDelegate = self

        // WebKit throttles windows macOS considers hidden, which stalls scroll triggered reveals and leaves sections
        // blank. So the window sits on screen, practically transparent and click-through, for the few seconds it takes.
        let origin = NSScreen.main?.frame.origin ?? .zero
        let window = NSWindow(contentRect: CGRect(origin: origin, size: CGSize(width: Self.width, height: Self.viewportHeight)), styleMask: .borderless, backing: .buffered, defer: false)
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

        let title = (try await webView.evaluateJavaScript("document.title") as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let image = try await stitchedSnapshot(of: webView)

        if let avif = Self.avifData(image) {
            return (avif, "avif", title)
        }

        guard let png = NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:]) else {
            throw CaptureError.failed("Couldn't encode the capture of \(url.host() ?? url.absoluteString).")
        }

        return (png, "png", title)
    }

    /// Scrolls one viewport at a time and stitches the snapshots, the way GoFullPage does. Growing the viewport to the
    /// page's height instead stretches anything sized in viewport units, such as a 100vh hero, over the whole capture.
    private func stitchedSnapshot(of webView: WKWebView) async throws -> CGImage {
        let prepare = """
            document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
            const style = document.createElement('style');
            style.textContent = '::-webkit-scrollbar { display: none !important; }';
            document.head.append(style);
            return Math.min(document.documentElement.scrollHeight, \(Int(Self.maxHeight)));
            """
        let height = CGFloat((try await webView.callAsyncJavaScript(prepare, contentWorld: .page) as? NSNumber)?.doubleValue ?? Self.viewportHeight)

        var context: CGContext?
        var scale: CGFloat = 1
        var offset: CGFloat = 0

        while offset < height {
            let scrolled = try await scroll(webView, to: offset)

            guard let tile = try await webView.takeSnapshot(configuration: nil).cgImage(forProposedRect: nil, context: nil, hints: nil) else {
                throw CaptureError.failed("Couldn't snapshot the page.")
            }

            if context == nil {
                scale = CGFloat(tile.width) / Self.width
                context = CGContext(data: nil, width: Int(Self.width * scale), height: Int(height * scale), bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)

                // Fixed and sticky headers, banners and chat buttons belong in the first tile only. Pinned elements
                // as tall as the viewport are backgrounds (a hero's video, say), and hiding those leaves holes.
                _ = try await webView.callAsyncJavaScript("""
                    for (const element of document.querySelectorAll('*')) {
                        const pinned = ['fixed', 'sticky'].includes(getComputedStyle(element).position);

                        if (pinned && element.getBoundingClientRect().height < window.innerHeight / 2) {
                            element.style.setProperty('visibility', 'hidden', 'important');
                        }
                    }
                    """, contentWorld: .page)
            }

            // Core Graphics counts from the bottom, so a tile scrolled to `scrolled` sits that far below the top.
            let tileHeight = CGFloat(tile.height)
            context?.draw(tile, in: CGRect(x: 0, y: height * scale - scrolled * scale - tileHeight, width: CGFloat(tile.width), height: tileHeight))
            offset += Self.viewportHeight
        }

        guard let image = context?.makeImage() else {
            throw CaptureError.failed("Couldn't stitch the page together.")
        }

        return image
    }

    /// Scrolls and waits for scroll triggered reveals and lazy images, returning where the page actually stopped,
    /// which is short of `offset` on the last tile.
    private func scroll(_ webView: WKWebView, to offset: CGFloat) async throws -> CGFloat {
        let script = """
            window.scrollTo(0, offset);
            await new Promise((resolve) => setTimeout(resolve, 150));
            return window.scrollY;
            """

        return CGFloat((try await webView.callAsyncJavaScript(script, arguments: ["offset": offset], contentWorld: .page) as? NSNumber)?.doubleValue ?? offset)
    }

    /// AVIF is about a fifth of the PNG's size with no visible loss on text at 2x, and macOS encodes it natively.
    /// WebP would need a library and can't hold the tallest 2x captures (16,383px limit).
    private static func avifData(_ cgImage: CGImage) -> Data? {
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
