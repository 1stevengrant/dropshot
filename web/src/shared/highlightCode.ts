import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import dart from 'highlight.js/lib/languages/dart';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import elixir from 'highlight.js/lib/languages/elixir';
import go from 'highlight.js/lib/languages/go';
import graphql from 'highlight.js/lib/languages/graphql';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import perl from 'highlight.js/lib/languages/perl';
import php from 'highlight.js/lib/languages/php';
import plaintext from 'highlight.js/lib/languages/plaintext';
import python from 'highlight.js/lib/languages/python';
import r from 'highlight.js/lib/languages/r';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import scss from 'highlight.js/lib/languages/scss';
import sql from 'highlight.js/lib/languages/sql';
import swift from 'highlight.js/lib/languages/swift';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { codeLanguageFor } from './codeLanguages';

const languages = { bash, c, cpp, csharp, css, dart, diff, dockerfile, elixir, go, graphql, ini, java, javascript, json, kotlin, lua, makefile, perl, php, plaintext, python, r, ruby, rust, scss, sql, swift, typescript, xml, yaml };

for (const [name, language] of Object.entries(languages)) {
    hljs.registerLanguage(name, language);
}

/** Highlighting very large files is slow and unreadable anyway; above this they're shown as plain text. */
const highlightLimit = 200_000;

/**
 * Detection only picks between common languages: with all of them, grammars like Dart and Swift claim logs and config
 * files. Below the confidence threshold the snippet is shown unhighlighted.
 */
const detectable = ['javascript', 'typescript', 'xml', 'css', 'scss', 'json', 'php', 'python', 'ruby', 'bash', 'sql', 'yaml', 'ini', 'diff'];
const minimumRelevance = 10;

/**
 * Returns escaped HTML for the code, with highlight.js token spans, its line count and the language's name.
 * The language comes from the file extension; snippets without one (such as Droplr imports saved as .txt) are detected.
 */
export function highlightCode(text: string, filename: string): { html: string; lines: number; label: string } {
    const code = text.replace(/\n$/, '');
    const lines = code.split('\n').length;

    if (text.length > highlightLimit) {
        return { html: hljs.highlight(code, { language: 'plaintext' }).value, lines, label: 'Code' };
    }

    const known = codeLanguageFor(filename);

    if (known) {
        return { html: hljs.highlight(code, { language: known.id, ignoreIllegals: true }).value, lines, label: known.label };
    }

    // A guessed language is often only close (templates, logs), so it colours the code but isn't named.
    const detected = hljs.highlightAuto(code, detectable);
    const html = detected.relevance >= minimumRelevance ? detected.value : hljs.highlight(code, { language: 'plaintext' }).value;

    return { html, lines, label: 'Code' };
}
