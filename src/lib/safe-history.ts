/** Update the URL without breaking when extensions block the History API. */
export function safePushState(state: unknown, url: string | URL): void {
	try {
		const href = typeof url === 'string' ? url : url.href;
		window.history.pushState(state, '', href);
	} catch {
		// Some privacy extensions throw on pushState; app state still updates.
	}
}

export function safeReplaceState(state: unknown, url: string | URL): void {
	try {
		const href = typeof url === 'string' ? url : url.href;
		window.history.replaceState(state, '', href);
	} catch {
		// Same as safePushState — non-fatal.
	}
}
