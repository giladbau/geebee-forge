/** Gradient stops for choropleth intensity mapping (blue → purple → amber → red → yellow) */
export const GRADIENT_STOPS: [number, string][] = [
	[0.0, '#2563eb'],
	[0.25, '#7c3aed'],
	[0.5, '#f59e0b'],
	[0.75, '#ef4444'],
	[1.0, '#fef08a'],
];

/** Linear RGB interpolation between two hex colors */
export function lerpColor(hex1: string, hex2: string, t: number): string {
	const r1 = parseInt(hex1.slice(1, 3), 16);
	const g1 = parseInt(hex1.slice(3, 5), 16);
	const b1 = parseInt(hex1.slice(5, 7), 16);
	const r2 = parseInt(hex2.slice(1, 3), 16);
	const g2 = parseInt(hex2.slice(3, 5), 16);
	const b2 = parseInt(hex2.slice(5, 7), 16);
	const r = Math.round(r1 + (r2 - r1) * t);
	const g = Math.round(g1 + (g2 - g1) * t);
	const b = Math.round(b1 + (b2 - b1) * t);
	return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** Map a 0..1 normalized value to a gradient color */
export function intensityColor(normalizedValue: number): string {
	const t = Math.max(0, Math.min(1, normalizedValue));
	for (let i = 1; i < GRADIENT_STOPS.length; i++) {
		const [stopLo, colorLo] = GRADIENT_STOPS[i - 1];
		const [stopHi, colorHi] = GRADIENT_STOPS[i];
		if (t <= stopHi) {
			const ratio = (t - stopLo) / (stopHi - stopLo);
			return lerpColor(colorLo, colorHi, ratio);
		}
	}
	return GRADIENT_STOPS[GRADIENT_STOPS.length - 1][1];
}
