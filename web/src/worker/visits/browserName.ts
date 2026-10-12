export function browserName(agent: string): string | null {
    const bots = /(bot|crawler|spider|slack|discord|twitter|facebook|whatsapp|telegram|preview)/i.exec(agent);

    if (bots) {
        return `${bots[1][0].toUpperCase()}${bots[1].slice(1).toLowerCase()} preview`;
    }

    const browsers: [RegExp, string][] = [[/Edg\//, 'Edge'], [/OPR\//, 'Opera'], [/Firefox\//, 'Firefox'], [/Chrome\//, 'Chrome'], [/Safari\//, 'Safari'], [/curl\//, 'curl']];
    const browser = browsers.find(([pattern]) => pattern.test(agent))?.[1] ?? null;
    const os = /iPhone|iPad/.test(agent) ? 'iOS' : /Android/.test(agent) ? 'Android' : /Mac OS X/.test(agent) ? 'macOS' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : null;

    return [browser, os].filter(Boolean).join(' on ') || null;
}
