export function areIndicatorsEnabled(): boolean {
	const value = process.env.ADD_INDICATORS?.trim().toLowerCase();
	return value === "1" || value === "true";
}
