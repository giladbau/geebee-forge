/**
 * Strip neighborhood/area suffixes: "באר שבע - מזרח" → "באר שבע", "עמיעוז, עמיעוז" → "עמיעוז"
 * NOTE: Duplicated from src/lib/utils/city-names.ts (used by AlertsMap.svelte on the frontend).
 */
export function normalizeCity(name: string): string {
	let base = name.split(' - ')[0].trim();
	base = base.split(', ')[0].trim();
	return base;
}
