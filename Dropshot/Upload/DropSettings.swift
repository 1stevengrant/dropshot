import Foundation

nonisolated enum DropPrivacy: String, CaseIterable, Identifiable, Sendable {
    case `public`
    case password
    case `private`

    var id: String { rawValue }

    var title: String {
        switch self {
        case .public: "Public"
        case .password: "Password"
        case .private: "Private"
        }
    }
}

nonisolated enum SelfDestruct: String, CaseIterable, Identifiable, Sendable {
    case keep
    case oneHour
    case oneDay
    case oneWeek
    case oneMonth
    case threeMonths
    case sixMonths

    var id: String { rawValue }

    var title: String {
        switch self {
        case .keep: "Keep"
        case .oneHour: "1 Hour"
        case .oneDay: "1 Day"
        case .oneWeek: "1 Week"
        case .oneMonth: "1 Month"
        case .threeMonths: "3 Months"
        case .sixMonths: "6 Months"
        }
    }

    func expiry(from now: Date) -> Date? {
        let calendar = Calendar(identifier: .gregorian)

        return switch self {
        case .keep: nil
        case .oneHour: now.addingTimeInterval(3_600)
        case .oneDay: now.addingTimeInterval(86_400)
        case .oneWeek: now.addingTimeInterval(7 * 86_400)
        case .oneMonth: calendar.date(byAdding: .month, value: 1, to: now)
        case .threeMonths: calendar.date(byAdding: .month, value: 3, to: now)
        case .sixMonths: calendar.date(byAdding: .month, value: 6, to: now)
        }
    }
}

/// Privacy, expiry and download permission for new drops. They travel as S3 object metadata, which the Worker's
/// bucket sync applies, so the app still never talks to the Worker.
nonisolated struct DropSettings: Sendable, Equatable {
    var privacy: DropPrivacy
    var password: String
    var selfDestruct: SelfDestruct
    var allowDownload: Bool

    static func isValidPassword(_ password: String) -> Bool {
        (4...32).contains(password.count)
    }

    /// A password drop without a usable password is uploaded as public, as the settings screen warns.
    var effectivePrivacy: DropPrivacy {
        privacy == .password && !Self.isValidPassword(password) ? .public : privacy
    }

    func metadata(now: Date = .now) -> [String: String] {
        var metadata = [
            "privacy": effectivePrivacy.rawValue,
            "allow-download": allowDownload ? "1" : "0",
        ]

        if effectivePrivacy == .password {
            metadata["password-hash"] = PasswordHash.make(password)
        }

        if let expiry = selfDestruct.expiry(from: now) {
            metadata["expires-at"] = String(Int64(expiry.timeIntervalSince1970 * 1000))
        }

        return metadata
    }
}
