import { describe, expect, it } from 'vitest';
import { buildAreaHeatPoints } from './heat-points';

describe('buildAreaHeatPoints', () => {
	it('falls back to the geocoded point when no polygon is available', () => {
		const points = buildAreaHeatPoints({
			lat: 31.5,
			lng: 34.8,
			count: 120,
			geometry: null
		});

		expect(points).toEqual([[31.5, 34.8, 120]]);
	});

	it('spreads intensity across polygon samples while preserving total weight', () => {
		const points = buildAreaHeatPoints({
			lat: 31.5,
			lng: 34.8,
			count: 100,
			geometry: {
				type: 'Polygon',
				coordinates: [[
					[34.79, 31.49],
					[34.81, 31.49],
					[34.81, 31.51],
					[34.79, 31.51],
					[34.79, 31.49]
				]]
			}
		});

		expect(points.length).toBeGreaterThan(1);
		const total = points.reduce((sum, point) => sum + point[2], 0);
		expect(total).toBeCloseTo(100, 6);
		expect(points.some(([lat, lng]) => lat !== 31.5 || lng !== 34.8)).toBe(true);
	});

	it('supports multipolygon geometries', () => {
		const points = buildAreaHeatPoints({
			lat: 31.5,
			lng: 34.8,
			count: 90,
			geometry: {
				type: 'MultiPolygon',
				coordinates: [
					[[
						[34.79, 31.49],
						[34.80, 31.49],
						[34.80, 31.50],
						[34.79, 31.50],
						[34.79, 31.49]
					]],
					[[
						[34.81, 31.50],
						[34.82, 31.50],
						[34.82, 31.51],
						[34.81, 31.51],
						[34.81, 31.50]
					]]
				]
			}
		});

		expect(points.length).toBeGreaterThan(1);
		expect(points.reduce((sum, point) => sum + point[2], 0)).toBeCloseTo(90, 6);
	});
});
