import Foundation
import Synchronization

/// Uploads a large file as an S3 multipart upload: the file is sent in fixed size parts, several at a time, and a
/// failed part is retried on its own instead of restarting the whole file. If a part gives up, the upload is
/// aborted so the store doesn't keep the orphaned parts.
nonisolated final class S3MultipartUpload: Sendable {
    /// R2 and S3 need every part except the last to be the same size, and at least 5 MB.
    static let partSize: Int64 = 32 * 1024 * 1024

    private static let concurrency = 4
    private static let attempts = 4

    private let objectURL: URL
    private let signer: S3Signer
    private let contentType: String
    private let contentDisposition: String
    private let progressHandler: @Sendable (Double) -> Void
    private let sentPerPart = Mutex<[Int: Int64]>([:])

    init(objectURL: URL, signer: S3Signer, contentType: String, contentDisposition: String, progress: @escaping @Sendable (Double) -> Void) {
        self.objectURL = objectURL
        self.signer = signer
        self.contentType = contentType
        self.contentDisposition = contentDisposition
        self.progressHandler = progress
    }

    func upload(fileAt fileURL: URL, size: Int64) async throws {
        let uploadId = try await create()
        let partCount = Int((size + Self.partSize - 1) / Self.partSize)

        do {
            let etags = try await uploadParts(fileAt: fileURL, size: size, count: partCount, uploadId: uploadId)
            try await complete(uploadId: uploadId, etags: etags)
        } catch {
            await abort(uploadId: uploadId)
            throw error
        }
    }

    // MARK: Steps

    private func create() async throws -> String {
        let (data, _) = try await send(method: "POST", query: "uploads", body: Data(), headers: [
            "Content-Type": contentType,
            "Content-Disposition": contentDisposition,
        ])

        guard let uploadId = Self.element("UploadId", in: data) else {
            throw UploadError.server(status: 200, body: "The storage didn't return an upload ID.")
        }

        return uploadId
    }

    private func uploadParts(fileAt fileURL: URL, size: Int64, count: Int, uploadId: String) async throws -> [Int: String] {
        try await withThrowingTaskGroup(of: (Int, String).self) { group in
            var etags: [Int: String] = [:]
            var next = 1

            func addPart(_ number: Int) {
                group.addTask {
                    (number, try await self.uploadPartWithRetry(number, fileAt: fileURL, size: size, uploadId: uploadId))
                }
            }

            while next <= min(count, Self.concurrency) {
                addPart(next)
                next += 1
            }

            while let (number, etag) = try await group.next() {
                etags[number] = etag

                if next <= count {
                    addPart(next)
                    next += 1
                }
            }

            return etags
        }
    }

    private func uploadPartWithRetry(_ number: Int, fileAt fileURL: URL, size: Int64, uploadId: String) async throws -> String {
        let offset = Int64(number - 1) * Self.partSize
        let length = Int(min(Self.partSize, size - offset))
        let body = try Self.read(fileAt: fileURL, offset: offset, length: length)
        var attempt = 1

        while true {
            do {
                let (_, response) = try await send(method: "PUT", query: "partNumber=\(number)&uploadId=\(Self.encode(uploadId))", body: body) { sent in
                    self.report(part: number, sent: sent, total: size)
                }

                guard let etag = response.value(forHTTPHeaderField: "ETag") else {
                    throw UploadError.server(status: response.statusCode, body: "Part \(number) has no ETag.")
                }

                return etag
            } catch {
                report(part: number, sent: 0, total: size)

                if attempt >= Self.attempts || error is CancellationError {
                    throw error
                }

                try await Task.sleep(for: .seconds(1 << attempt))
                attempt += 1
            }
        }
    }

    private func complete(uploadId: String, etags: [Int: String]) async throws {
        let parts = etags.keys.sorted().map { "<Part><PartNumber>\($0)</PartNumber><ETag>\(etags[$0]!)</ETag></Part>" }.joined()
        let body = Data("<CompleteMultipartUpload>\(parts)</CompleteMultipartUpload>".utf8)
        let (data, response) = try await send(method: "POST", query: "uploadId=\(Self.encode(uploadId))", body: body, headers: ["Content-Type": "application/xml"])

        // S3 can answer 200 and still report a failure in the body.
        if Self.element("Code", in: data) != nil {
            throw UploadError.server(status: response.statusCode, body: String(decoding: data, as: UTF8.self))
        }
    }

    private func abort(uploadId: String) async {
        _ = try? await send(method: "DELETE", query: "uploadId=\(Self.encode(uploadId))", body: Data())
    }

    // MARK: Helpers

    private func send(
        method: String,
        query: String,
        body: Data,
        headers: [String: String] = [:],
        progress: (@Sendable (Int64) -> Void)? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        var components = URLComponents(url: objectURL, resolvingAgainstBaseURL: false)!
        components.percentEncodedQuery = query

        var request = URLRequest(url: components.url!)
        request.httpMethod = method

        for (name, value) in headers {
            request.setValue(value, forHTTPHeaderField: name)
        }

        signer.sign(&request, payloadHash: S3Signer.sha256Hex(body))

        let delegate = progress.map { UploadProgressDelegate(onSent: $0) }
        let (data, response) = try await URLSession.shared.upload(for: request, from: body, delegate: delegate)
        let http = response as? HTTPURLResponse

        guard let http, (200..<300).contains(http.statusCode) else {
            throw UploadError.server(status: http?.statusCode ?? 0, body: String(decoding: data, as: UTF8.self))
        }

        return (data, http)
    }

    private func report(part: Int, sent: Int64, total: Int64) {
        let sum = sentPerPart.withLock { sentPerPart in
            sentPerPart[part] = sent

            return sentPerPart.values.reduce(0, +)
        }

        progressHandler(min(1, Double(sum) / Double(total)))
    }

    private static func read(fileAt url: URL, offset: Int64, length: Int) throws -> Data {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }

        try handle.seek(toOffset: UInt64(offset))

        return try handle.read(upToCount: length) ?? Data()
    }

    /// Upload IDs can contain characters that must be percent encoded in the query, and SigV4 signs the encoded form.
    private static func encode(_ value: String) -> String {
        S3Signer.encodePathSegment(value)
    }

    private static func element(_ name: String, in data: Data) -> String? {
        let xml = String(decoding: data, as: UTF8.self)

        guard let start = xml.range(of: "<\(name)>"), let end = xml.range(of: "</\(name)>", range: start.upperBound..<xml.endIndex) else {
            return nil
        }

        return String(xml[start.upperBound..<end.lowerBound])
    }
}
