import Foundation

/// Turns what someone types or copies into a page URL: `example.com` becomes `https://example.com`.
nonisolated enum WebCaptureURL {
    static func parse(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)

        if trimmed.isEmpty || trimmed.contains(" ") {
            return nil
        }

        let candidate = trimmed.contains("://") ? trimmed : "https://\(trimmed)"

        guard let url = URL(string: candidate), let scheme = url.scheme?.lowercased(), let host = url.host(), !host.isEmpty else {
            return nil
        }

        if scheme != "https" && scheme != "http" {
            return nil
        }

        return host.contains(".") || host == "localhost" ? url : nil
    }
}
