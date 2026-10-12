import CryptoKit
import Foundation

/// AWS Signature Version 4 for S3-compatible stores (AWS S3, Cloudflare R2, MinIO, Backblaze B2).
nonisolated struct S3Signer: Sendable {
    let accessKeyId: String
    let secretAccessKey: String
    let region: String
    let service = "s3"

    func sign(_ request: inout URLRequest, payloadHash: String, date: Date = Date()) {
        let amzDate = Self.timestampFormatter.string(from: date)
        let dateStamp = String(amzDate.prefix(8))

        guard let url = request.url, let host = url.host else {
            return
        }

        let hostHeader = url.port.map { "\(host):\($0)" } ?? host

        request.setValue(hostHeader, forHTTPHeaderField: "Host")
        request.setValue(amzDate, forHTTPHeaderField: "x-amz-date")
        request.setValue(payloadHash, forHTTPHeaderField: "x-amz-content-sha256")

        let headers = (request.allHTTPHeaderFields ?? [:])
            .map { (key: $0.key.lowercased(), value: $0.value.trimmingCharacters(in: .whitespaces)) }
            .sorted { $0.key < $1.key }

        let canonicalHeaders = headers.map { "\($0.key):\($0.value)\n" }.joined()
        let signedHeaders = headers.map(\.key).joined(separator: ";")

        let canonicalRequest = [
            request.httpMethod ?? "GET",
            Self.canonicalPath(url),
            Self.canonicalQuery(url),
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].joined(separator: "\n")

        let scope = "\(dateStamp)/\(region)/\(service)/aws4_request"

        let stringToSign = [
            "AWS4-HMAC-SHA256",
            amzDate,
            scope,
            Self.sha256Hex(Data(canonicalRequest.utf8)),
        ].joined(separator: "\n")

        let signingKey = ["\(region)", service, "aws4_request"].reduce(
            Self.hmac(key: Data("AWS4\(secretAccessKey)".utf8), message: dateStamp)
        ) { Self.hmac(key: $0, message: $1) }

        let signature = Self.hmac(key: signingKey, message: stringToSign)
            .map { String(format: "%02x", $0) }
            .joined()

        request.setValue(
            "AWS4-HMAC-SHA256 Credential=\(accessKeyId)/\(scope), SignedHeaders=\(signedHeaders), Signature=\(signature)",
            forHTTPHeaderField: "Authorization"
        )
    }

    static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    static func sha256Hex(fileAt url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        var hasher = SHA256()

        while let chunk = try handle.read(upToCount: 1 << 20), !chunk.isEmpty {
            hasher.update(data: chunk)
        }

        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private static func hmac(key: Data, message: String) -> Data {
        Data(HMAC<SHA256>.authenticationCode(for: Data(message.utf8), using: SymmetricKey(data: key)))
    }

    private static func canonicalPath(_ url: URL) -> String {
        let path = url.path(percentEncoded: true)

        return path.isEmpty ? "/" : path
    }

    private static func canonicalQuery(_ url: URL) -> String {
        guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedQueryItems else {
            return ""
        }

        return items
            .map { "\($0.name)=\($0.value ?? "")" }
            .sorted()
            .joined(separator: "&")
    }

    private static let timestampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyyMMdd'T'HHmmss'Z'"

        return formatter
    }()

    /// RFC 3986 unreserved characters, as required by SigV4 path encoding.
    static func encodePathSegment(_ segment: String) -> String {
        let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

        return segment.addingPercentEncoding(withAllowedCharacters: allowed) ?? segment
    }
}
