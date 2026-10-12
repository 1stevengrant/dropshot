import Foundation

/// Languages a code snippet can be in. Mirrors web/src/shared/codeLanguages.ts, which decides how the Worker
/// classifies and highlights a drop by its file extension; keep the two lists in step.
nonisolated struct CodeLanguage: Identifiable, Hashable, Sendable {
    let id: String
    let label: String
    let extensions: [String]

    /// New snippets are saved with the language's first extension.
    var fileExtension: String { extensions[0] }

    static let all: [CodeLanguage] = [
        .init(id: "javascript", label: "JavaScript", extensions: ["js", "mjs", "cjs", "jsx"]),
        .init(id: "typescript", label: "TypeScript", extensions: ["ts", "tsx", "mts", "cts"]),
        .init(id: "xml", label: "HTML / XML", extensions: ["html", "htm", "xml"]),
        .init(id: "css", label: "CSS", extensions: ["css"]),
        .init(id: "scss", label: "SCSS", extensions: ["scss"]),
        .init(id: "json", label: "JSON", extensions: ["json"]),
        .init(id: "php", label: "PHP", extensions: ["php"]),
        .init(id: "python", label: "Python", extensions: ["py"]),
        .init(id: "ruby", label: "Ruby", extensions: ["rb"]),
        .init(id: "go", label: "Go", extensions: ["go"]),
        .init(id: "rust", label: "Rust", extensions: ["rs"]),
        .init(id: "swift", label: "Swift", extensions: ["swift"]),
        .init(id: "kotlin", label: "Kotlin", extensions: ["kt", "kts"]),
        .init(id: "java", label: "Java", extensions: ["java"]),
        .init(id: "c", label: "C", extensions: ["c", "h"]),
        .init(id: "cpp", label: "C++", extensions: ["cpp", "cc", "cxx", "hpp", "hh"]),
        .init(id: "csharp", label: "C#", extensions: ["cs"]),
        .init(id: "dart", label: "Dart", extensions: ["dart"]),
        .init(id: "elixir", label: "Elixir", extensions: ["ex", "exs"]),
        .init(id: "lua", label: "Lua", extensions: ["lua"]),
        .init(id: "perl", label: "Perl", extensions: ["pl", "pm"]),
        .init(id: "r", label: "R", extensions: ["r"]),
        .init(id: "bash", label: "Shell", extensions: ["sh", "bash", "zsh"]),
        .init(id: "sql", label: "SQL", extensions: ["sql"]),
        .init(id: "graphql", label: "GraphQL", extensions: ["graphql", "gql"]),
        .init(id: "yaml", label: "YAML", extensions: ["yaml", "yml"]),
        .init(id: "ini", label: "TOML / INI", extensions: ["toml", "ini", "conf"]),
        .init(id: "dockerfile", label: "Dockerfile", extensions: ["dockerfile"]),
        .init(id: "makefile", label: "Makefile", extensions: ["mk"]),
        .init(id: "diff", label: "Diff", extensions: ["diff", "patch"]),
    ]

    static func matching(extension pathExtension: String) -> CodeLanguage? {
        let lowered = pathExtension.lowercased()

        return all.first { $0.extensions.contains(lowered) }
    }
}
