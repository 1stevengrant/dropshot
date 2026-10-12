import Foundation
import UniformTypeIdentifiers

nonisolated struct StorageConfiguration: Sendable, Equatable {
    let endpoint: URL
    let bucket: String
    let region: String
    let accessKeyId: String
    let secretAccessKey: String
    let publicBaseURL: URL
    let keyPrefix: String
    let usePathStyle: Bool
    let linkStyle: LinkStyle

    init?(
        endpoint: String,
        bucket: String,
        region: String,
        accessKeyId: String,
        secretAccessKey: String,
        publicBaseURL: String,
        keyPrefix: String,
        usePathStyle: Bool,
        linkStyle: LinkStyle
    ) {
        guard let endpointURL = URL(string: endpoint.trimmingCharacters(in: .whitespaces)), endpointURL.host != nil else {
            return nil
        }

        guard let publicURL = URL(string: publicBaseURL.trimmingCharacters(in: .whitespaces)), publicURL.host != nil else {
            return nil
        }

        if bucket.isEmpty || accessKeyId.isEmpty || secretAccessKey.isEmpty {
            return nil
        }

        self.endpoint = endpointURL
        self.bucket = bucket
        self.region = region.isEmpty ? "auto" : region
        self.accessKeyId = accessKeyId
        self.secretAccessKey = secretAccessKey
        self.publicBaseURL = publicURL
        self.keyPrefix = keyPrefix.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        self.usePathStyle = usePathStyle
        self.linkStyle = linkStyle
    }
}

nonisolated enum UploadError: LocalizedError {
    case notConfigured
    case server(status: Int, body: String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            "Storage isn't configured. Open Settings › Storage."
        case let .server(status, body):
            "Upload failed (HTTP \(status)). \(body.prefix(300))"
        }
    }
}

nonisolated struct UploadResult: Sendable {
    let objectKey: String
    let publicURL: URL
}

/// Uploads one file with a single signed PUT and reports byte progress.
nonisolated final class S3Uploader: NSObject, URLSessionTaskDelegate, Sendable {
    private let configuration: StorageConfiguration
    private let progressHandler: @Sendable (Double) -> Void

    init(configuration: StorageConfiguration, progress: @escaping @Sendable (Double) -> Void) {
        self.configuration = configuration
        self.progressHandler = progress
    }

    func upload(fileAt fileURL: URL, filename: String, shortId: String) async throws -> UploadResult {
        let objectKey = Self.objectKey(prefix: configuration.keyPrefix, shortId: shortId, filename: filename)
        let encodedKey = objectKey.split(separator: "/").map { S3Signer.encodePathSegment(String($0)) }.joined(separator: "/")

        var request = URLRequest(url: objectURL(encodedKey: encodedKey))
        request.httpMethod = "PUT"
        request.setValue(Self.contentType(for: filename), forHTTPHeaderField: "Content-Type")
        request.setValue(Self.contentDisposition(for: filename), forHTTPHeaderField: "Content-Disposition")

        let payloadHash = try S3Signer.sha256Hex(fileAt: fileURL)

        S3Signer(
            accessKeyId: configuration.accessKeyId,
            secretAccessKey: configuration.secretAccessKey,
            region: configuration.region
        ).sign(&request, payloadHash: payloadHash)

        let (data, response) = try await URLSession.shared.upload(for: request, fromFile: fileURL, delegate: self)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(status) else {
            throw UploadError.server(status: status, body: String(decoding: data, as: UTF8.self))
        }

        return UploadResult(objectKey: objectKey, publicURL: publicURL(objectKey: objectKey, encodedKey: encodedKey))
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        guard totalBytesExpectedToSend > 0 else {
            return
        }

        progressHandler(Double(totalBytesSent) / Double(totalBytesExpectedToSend))
    }

    private func objectURL(encodedKey: String) -> URL {
        let base = configuration.endpoint.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        if configuration.usePathStyle {
            return URL(string: "\(base)/\(configuration.bucket)/\(encodedKey)")!
        }

        var components = URLComponents(url: configuration.endpoint, resolvingAgainstBaseURL: false)!
        components.host = "\(configuration.bucket).\(components.host ?? "")"
        components.percentEncodedPath = "/\(encodedKey)"

        return components.url!
    }

    private func publicURL(objectKey: String, encodedKey: String) -> URL {
        let base = configuration.publicBaseURL.absoluteString.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        return URL(string: "\(base)/\(encodedKey)")!
    }

    static func objectKey(prefix: String, shortId: String, filename: String) -> String {
        [prefix, shortId, filename].filter { !$0.isEmpty }.joined(separator: "/")
    }

    static func contentType(for filename: String) -> String {
        let ext = (filename as NSString).pathExtension

        return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
    }

    /// Images, video, PDFs and text render in the browser; everything else downloads.
    static func contentDisposition(for filename: String) -> String {
        let ext = (filename as NSString).pathExtension
        let type = UTType(filenameExtension: ext)
        let inline = [UTType.image, .movie, .pdf, .text, .audio].contains { type?.conforms(to: $0) == true }
        let ascii = filename.replacingOccurrences(of: "\"", with: "").unicodeScalars.map { $0.isASCII ? String($0) : "_" }.joined()
        let encoded = S3Signer.encodePathSegment(filename)

        return "\(inline ? "inline" : "attachment"); filename=\"\(ascii)\"; filename*=UTF-8''\(encoded)"
    }

    static func makeShortId(length: Int = 8) -> String {
        let alphabet = Array("abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789")

        return String((0..<length).map { _ in alphabet.randomElement()! })
    }
}
