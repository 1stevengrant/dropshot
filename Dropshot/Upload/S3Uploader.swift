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
    /// The raw file. With the Dropshot Worker in front of the bucket, the shareable link is the drop page instead.
    let directURL: URL
}

/// Uploads one file and reports byte progress: a single signed PUT for small files, a multipart upload for large ones.
nonisolated final class S3Uploader: NSObject, URLSessionTaskDelegate, Sendable {
    /// Files above this go up in parts. Below it, one request is quicker and a retry costs little.
    static let multipartThreshold: Int64 = 2 * S3MultipartUpload.partSize

    private let configuration: StorageConfiguration
    private let progressHandler: @Sendable (Double) -> Void

    init(configuration: StorageConfiguration, progress: @escaping @Sendable (Double) -> Void) {
        self.configuration = configuration
        self.progressHandler = progress
    }

    func upload(fileAt fileURL: URL, filename: String, shortId: String, metadata: [String: String] = [:]) async throws -> UploadResult {
        let objectKey = Self.objectKey(prefix: configuration.keyPrefix, shortId: shortId, filename: filename)
        let encodedKey = Self.encodedKey(objectKey)

        let signer = S3Signer(accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey, region: configuration.region)
        let size = Int64((try fileURL.resourceValues(forKeys: [.fileSizeKey])).fileSize ?? 0)
        let metadataHeaders = Self.metadataHeaders(metadata)

        if size > Self.multipartThreshold {
            try await S3MultipartUpload(
                objectURL: objectURL(encodedKey: encodedKey),
                signer: signer,
                contentType: Self.contentType(for: filename),
                contentDisposition: Self.contentDisposition(for: filename),
                metadataHeaders: metadataHeaders,
                progress: progressHandler
            ).upload(fileAt: fileURL, size: size)

            return UploadResult(objectKey: objectKey, directURL: publicURL(objectKey: objectKey, encodedKey: encodedKey))
        }

        var request = URLRequest(url: objectURL(encodedKey: encodedKey))
        request.httpMethod = "PUT"
        request.setValue(Self.contentType(for: filename), forHTTPHeaderField: "Content-Type")
        request.setValue(Self.contentDisposition(for: filename), forHTTPHeaderField: "Content-Disposition")

        for (name, value) in metadataHeaders {
            request.setValue(value, forHTTPHeaderField: name)
        }

        signer.sign(&request, payloadHash: try S3Signer.sha256Hex(fileAt: fileURL))

        let (data, response) = try await URLSession.shared.upload(for: request, fromFile: fileURL, delegate: self)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(status) else {
            throw UploadError.server(status: status, body: String(decoding: data, as: UTF8.self))
        }

        return UploadResult(objectKey: objectKey, directURL: publicURL(objectKey: objectKey, encodedKey: encodedKey))
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

    /// Library thumbnails sit at `<prefix>/_thumbs/<id>`; the Worker's bucket sync ignores keys starting with `_`.
    func uploadThumbnail(_ data: Data, contentType: String, dropId: String) async throws {
        try await put(data, contentType: contentType, objectKey: Self.objectKey(prefix: configuration.keyPrefix, shortId: "_thumbs", filename: dropId))
    }

    /// While an instant link's upload runs, `<prefix>/_pending/<id>` tells the Worker to show "Still uploading…".
    func uploadPendingMarker(dropId: String, filename: String) async throws {
        let marker = try JSONSerialization.data(withJSONObject: ["filename": filename, "startedAt": Int64(Date.now.timeIntervalSince1970 * 1000)])

        try await put(marker, contentType: "application/json", objectKey: Self.pendingMarkerKey(prefix: configuration.keyPrefix, dropId: dropId))
    }

    func deletePendingMarker(dropId: String) async throws {
        try await delete(key: Self.pendingMarkerKey(prefix: configuration.keyPrefix, dropId: dropId))
    }

    func delete(key objectKey: String) async throws {
        let signer = S3Signer(accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey, region: configuration.region)

        var request = URLRequest(url: objectURL(encodedKey: Self.encodedKey(objectKey)))
        request.httpMethod = "DELETE"

        signer.sign(&request, payloadHash: S3Signer.sha256Hex(Data()))

        let (body, response) = try await URLSession.shared.data(for: request)
        try Self.requireSuccess(response, body: body)
    }

    private func put(_ data: Data, contentType: String, objectKey: String) async throws {
        let signer = S3Signer(accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey, region: configuration.region)

        var request = URLRequest(url: objectURL(encodedKey: Self.encodedKey(objectKey)))
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")

        signer.sign(&request, payloadHash: S3Signer.sha256Hex(data))

        let (body, response) = try await URLSession.shared.upload(for: request, from: data)
        try Self.requireSuccess(response, body: body)
    }

    private static func requireSuccess(_ response: URLResponse, body: Data) throws {
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard (200..<300).contains(status) else {
            throw UploadError.server(status: status, body: String(decoding: body, as: UTF8.self))
        }
    }

    private static func encodedKey(_ objectKey: String) -> String {
        objectKey.split(separator: "/").map { S3Signer.encodePathSegment(String($0)) }.joined(separator: "/")
    }

    static func pendingMarkerKey(prefix: String, dropId: String) -> String {
        objectKey(prefix: prefix, shortId: "_pending", filename: dropId)
    }

    static func metadataHeaders(_ metadata: [String: String]) -> [String: String] {
        Dictionary(uniqueKeysWithValues: metadata.map { ("x-amz-meta-\($0.key)", metadataValue($0.value)) })
    }

    /// S3 metadata travels as headers, which must be ASCII, so values are percent-encoded.
    static func metadataValue(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "%"))) ?? ""
    }

    static func objectKey(prefix: String, shortId: String, filename: String) -> String {
        [prefix, shortId, filename].filter { !$0.isEmpty }.joined(separator: "/")
    }

    static func contentType(for filename: String) -> String {
        let ext = (filename as NSString).pathExtension

        // Source files are shown as text; some extensions (.ts) would otherwise be typed as video.
        if CodeLanguage.matching(extension: ext) != nil {
            return "text/plain; charset=utf-8"
        }

        return UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
    }

    /// Images, video, PDFs and text render in the browser; everything else downloads.
    static func contentDisposition(for filename: String) -> String {
        let ext = (filename as NSString).pathExtension
        let type = UTType(filenameExtension: ext)
        let inline = CodeLanguage.matching(extension: ext) != nil || [UTType.image, .movie, .pdf, .text, .audio].contains { type?.conforms(to: $0) == true }
        let ascii = filename.replacingOccurrences(of: "\"", with: "").unicodeScalars.map { $0.isASCII ? String($0) : "_" }.joined()
        let encoded = S3Signer.encodePathSegment(filename)

        return "\(inline ? "inline" : "attachment"); filename=\"\(ascii)\"; filename*=UTF-8''\(encoded)"
    }

    static func makeShortId(length: Int = 8) -> String {
        let alphabet = Array("abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789")

        return String((0..<length).map { _ in alphabet.randomElement()! })
    }
}
