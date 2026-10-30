export function isDebugLoggingEnabled(): boolean {
	const value = process.env.DEBUG_LOGS?.trim().toLowerCase();
	return value === "1" || value === "true";
}

export function configureLogging(): void {
	if (isDebugLoggingEnabled()) return;

	console.log = () => undefined;
	console.debug = () => undefined;
	console.info = () => undefined;
}

export function debugLog(...messages: unknown[]): void {
	if (isDebugLoggingEnabled()) console.debug(...messages);
}
