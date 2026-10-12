import XCTest
@testable import Dropshot

final class S3SignerTests: XCTestCase {
    /// "GET Object" example from the AWS Signature Version 4 documentation for S3.
    func testMatchesAwsDocumentedGetObjectSignature() {
        var request = URLRequest(url: URL(string: "https://examplebucket.s3.amazonaws.com/test.txt")!)
        request.httpMethod = "GET"
        request.setValue("bytes=0-9", forHTTPHeaderField: "Range")

        let signer = S3Signer(
            accessKeyId: "AKIAIOSFODNN7EXAMPLE",
            secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
            region: "us-east-1"
        )

        signer.sign(
            &request,
            payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            date: Date(timeIntervalSince1970: 1_369_353_600)
        )

        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Authorization"),
            "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"
        )
    }

    func testPathSegmentEncodingFollowsRfc3986() {
        XCTAssertEqual(S3Signer.encodePathSegment("Screenshot 2026 at 10.00.png"), "Screenshot%202026%20at%2010.00.png")
        XCTAssertEqual(S3Signer.encodePathSegment("café~_-.txt"), "caf%C3%A9~_-.txt")
    }
}

final class S3UploaderTests: XCTestCase {
    func testObjectKeySkipsEmptyParts() {
        XCTAssertEqual(S3Uploader.objectKey(prefix: "", shortId: "abc", filename: "a.png"), "abc/a.png")
        XCTAssertEqual(S3Uploader.objectKey(prefix: "drops", shortId: "", filename: "abc.png"), "drops/abc.png")
    }

    func testImagesRenderInlineAndArchivesDownload() {
        XCTAssertTrue(S3Uploader.contentDisposition(for: "shot.png").hasPrefix("inline"))
        XCTAssertTrue(S3Uploader.contentDisposition(for: "bundle.zip").hasPrefix("attachment"))
        XCTAssertEqual(S3Uploader.contentType(for: "clip.mp4"), "video/mp4")
    }

    func testConfigurationRequiresCredentialsAndUrls() {
        XCTAssertNil(StorageConfiguration(endpoint: "", bucket: "b", region: "", accessKeyId: "a", secretAccessKey: "s", publicBaseURL: "https://x", keyPrefix: "", usePathStyle: true, linkStyle: .withFilename))

        let configuration = StorageConfiguration(endpoint: "https://r2.example.com", bucket: "b", region: "", accessKeyId: "a", secretAccessKey: "s", publicBaseURL: "https://d.example.com", keyPrefix: "/drops/", usePathStyle: true, linkStyle: .withFilename)
        XCTAssertEqual(configuration?.region, "auto")
        XCTAssertEqual(configuration?.keyPrefix, "drops")
    }
}
