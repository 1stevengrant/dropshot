/** Languages a code drop can be in. `id` is the highlight.js language, the first extension is used for new snippets. */
export const codeLanguages = [
    { id: 'javascript', label: 'JavaScript', extensions: ['js', 'mjs', 'cjs', 'jsx'] },
    { id: 'typescript', label: 'TypeScript', extensions: ['ts', 'tsx', 'mts', 'cts'] },
    { id: 'xml', label: 'HTML / XML', extensions: ['html', 'htm', 'xml'] },
    { id: 'css', label: 'CSS', extensions: ['css'] },
    { id: 'scss', label: 'SCSS', extensions: ['scss'] },
    { id: 'json', label: 'JSON', extensions: ['json'] },
    { id: 'php', label: 'PHP', extensions: ['php'] },
    { id: 'python', label: 'Python', extensions: ['py'] },
    { id: 'ruby', label: 'Ruby', extensions: ['rb'] },
    { id: 'go', label: 'Go', extensions: ['go'] },
    { id: 'rust', label: 'Rust', extensions: ['rs'] },
    { id: 'swift', label: 'Swift', extensions: ['swift'] },
    { id: 'kotlin', label: 'Kotlin', extensions: ['kt', 'kts'] },
    { id: 'java', label: 'Java', extensions: ['java'] },
    { id: 'c', label: 'C', extensions: ['c', 'h'] },
    { id: 'cpp', label: 'C++', extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh'] },
    { id: 'csharp', label: 'C#', extensions: ['cs'] },
    { id: 'dart', label: 'Dart', extensions: ['dart'] },
    { id: 'elixir', label: 'Elixir', extensions: ['ex', 'exs'] },
    { id: 'lua', label: 'Lua', extensions: ['lua'] },
    { id: 'perl', label: 'Perl', extensions: ['pl', 'pm'] },
    { id: 'r', label: 'R', extensions: ['r'] },
    { id: 'bash', label: 'Shell', extensions: ['sh', 'bash', 'zsh'] },
    { id: 'sql', label: 'SQL', extensions: ['sql'] },
    { id: 'graphql', label: 'GraphQL', extensions: ['graphql', 'gql'] },
    { id: 'yaml', label: 'YAML', extensions: ['yaml', 'yml'] },
    { id: 'ini', label: 'TOML / INI', extensions: ['toml', 'ini', 'conf'] },
    { id: 'dockerfile', label: 'Dockerfile', extensions: ['dockerfile'] },
    { id: 'makefile', label: 'Makefile', extensions: ['mk'] },
    { id: 'diff', label: 'Diff', extensions: ['diff', 'patch'] },
] as const;

export type CodeLanguage = (typeof codeLanguages)[number];

export function codeLanguageFor(filename: string): CodeLanguage | null {
    const dot = filename.lastIndexOf('.');
    const extension = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();

    return codeLanguages.find((language) => (language.extensions as readonly string[]).includes(extension)) ?? null;
}
