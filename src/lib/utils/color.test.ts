import { describe, expect, it } from 'vitest';
import { lerpColor, intensityColor, GRADIENT_STOPS } from './color';

describe('lerpColor', () => {
	it('returns the first color at t=0', () => {
		expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000');
	});

	it('returns the second color at t=1', () => {
		expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff');
	});

	it('returns the midpoint at t=0.5', () => {
		expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
	});

	it('interpolates non-trivial colors', () => {
		// #ff0000 → #0000ff at t=0.5 → #800080
		expect(lerpColor('#ff0000', '#0000ff', 0.5)).toBe('#800080');
	});
});

describe('intensityColor', () => {
	it('returns the first gradient color at t=0', () => {
		expect(intensityColor(0)).toBe(GRADIENT_STOPS[0][1]);
	});

	it('returns the last gradient color at t=1', () => {
		expect(intensityColor(1)).toBe(GRADIENT_STOPS[GRADIENT_STOPS.length - 1][1]);
	});

	it('clamps values below 0', () => {
		expect(intensityColor(-0.5)).toBe(intensityColor(0));
	});

	it('clamps values above 1', () => {
		expect(intensityColor(1.5)).toBe(intensityColor(1));
	});

	it('returns distinct colors for low, mid, and high values', () => {
		const low = intensityColor(0.1);
		const mid = intensityColor(0.5);
		const high = intensityColor(0.9);
		expect(low).not.toBe(mid);
		expect(mid).not.toBe(high);
		expect(low).not.toBe(high);
	});

	it('produces the exact stop color at each gradient stop', () => {
		for (const [stop, color] of GRADIENT_STOPS) {
			expect(intensityColor(stop)).toBe(color);
		}
	});

	it('returns a valid hex color string', () => {
		for (const t of [0, 0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1]) {
			expect(intensityColor(t)).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
