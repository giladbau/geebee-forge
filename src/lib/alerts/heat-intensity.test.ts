import { describe, expect, it } from 'vitest';
import {
	buildAlertIntensityLegend,
	normalizeAlertIntensity
} from './heat-intensity';

describe('alert heat intensity helpers', () => {
	it('normalizes counts onto a 0..1 intensity scale with logarithmic weighting', () => {
		expect(normalizeAlertIntensity(0, 500)).toBe(0);
		expect(normalizeAlertIntensity(500, 500)).toBe(1);
		expect(normalizeAlertIntensity(50, 500)).toBeGreaterThan(normalizeAlertIntensity(5, 500));
		expect(normalizeAlertIntensity(50, 500)).toBeLessThan(1);
	});

	it('builds ordered legend ranges from the live count distribution', () => {
		const legend = buildAlertIntensityLegend([5, 12, 50, 50, 200, 1200]);

		expect(legend.length).toBeGreaterThanOrEqual(3);
		expect(legend[0]).toMatchObject({
			label: 'Low',
			min: 5,
			max: expect.any(Number),
			color: expect.any(String)
		});
		expect(legend.at(-1)).toMatchObject({
			label: 'Extreme',
			max: 1200,
			color: expect.any(String)
		});
		for (let i = 1; i < legend.length; i += 1) {
			expect(legend[i].min).toBeGreaterThan(legend[i - 1].max);
		}
	});
});
