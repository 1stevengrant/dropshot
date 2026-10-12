import CommonCrypto
import Foundation

/// Hashes drop passwords on the Mac so the plaintext never leaves it. The format matches the Worker's
/// `hashPassword` (`web/src/worker/password.ts`): `pbkdf2$<iterations>$<base64 salt>$<base64 hash>`.
nonisolated enum PasswordHash {
    static let iterations = 100_000

    static func make(_ password: String, salt: Data = randomSalt()) -> String {
        "pbkdf2$\(iterations)$\(salt.base64EncodedString())$\(derive(password, salt: salt).base64EncodedString())"
    }

    static func randomSalt() -> Data {
        var bytes = [UInt8](repeating: 0, count: 16)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)

        return Data(bytes)
    }

    private static func derive(_ password: String, salt: Data) -> Data {
        let passwordBytes = Array(password.utf8).map { CChar(bitPattern: $0) }
        let saltBytes = [UInt8](salt)
        var derived = [UInt8](repeating: 0, count: 32)

        CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2),
            passwordBytes,
            passwordBytes.count,
            saltBytes,
            saltBytes.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
            UInt32(iterations),
            &derived,
            derived.count
        )

        return Data(derived)
    }
}
