/** Strip neighborhood/area suffixes: "באר שבע - מזרח" → "באר שבע", "עמיעוז, עמיעוז" → "עמיעוז" */
export function normalizeCity(name: string): string {
	let base = name.split(' - ')[0].trim();
	base = base.split(', ')[0].trim();
	return base;
}
