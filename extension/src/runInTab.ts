/** Runs one of the self contained page functions in the tab and returns what it resolves to. */
export async function runInTab<Args extends unknown[], Result>(tabId: number, func: (...args: Args) => Result | Promise<Result>, args: Args): Promise<Result> {
    const [injection] = await chrome.scripting.executeScript({ target: { tabId }, func, args });

    return injection?.result as Result;
}
