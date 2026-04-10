export interface AlertIntensityLegendItem {
	label: 'Low' | 'Moderate' | 'High' | 'Extreme';
	min: number;
	max: number;
	color: string;
}

const INTENSITY_COLORS = ['#2563eb', '#7c3aed', '#f59e0b', '#fef08a'] as const;
const LEGEND_LABELS: AlertIntensityLegendItem['label'][] = ['Low', 'Moderate', 'High', 'Extreme'];

export function normalizeAlertIntensity(count: number, maxCount: number): number {
	if (count <= 0 || maxCount <= 0) return 0;
	if (count >= maxCount) return 1;

	const normalized = Math.log(count + 1) / Math.log(maxCount + 1);
	return Math.max(0, Math.min(1, normalized));
}

export function buildAlertIntensityLegend(counts: number[]): AlertIntensityLegendItem[] {
	const sorted = counts.filter((count) => count > 0).sort((a, b) => a - b);
	if (sorted.length === 0) return [];

	const boundaries = Array.from(new Set([
		sorted[0],
		sorted[Math.floor((sorted.length - 1) * 0.33)],
		sorted[Math.floor((sorted.length - 1) * 0.66)],
		sorted[sorted.length - 1]
	]));

	const ranges = boundaries.map((upperBound, index) => {
		const lowerBound = index === 0 ? sorted[0] : boundaries[index - 1] + 1;
		return {
			label: LEGEND_LABELS[Math.min(index, LEGEND_LABELS.length - 1)],
			min: lowerBound,
			max: upperBound,
			color: INTENSITY_COLORS[Math.min(index, INTENSITY_COLORS.length - 1)]
		};
	}).filter((item) => item.min <= item.max);

	if (ranges.length === 1) {
		return [{ ...ranges[0], label: 'Extreme', color: '#fef08a' }];
	}

	const paddedRanges = ranges.map((item, index) => ({
		...item,
		label: LEGEND_LABELS[Math.max(0, LEGEND_LABELS.length - ranges.length + index)]
	}));

	return paddedRanges.map((item, index) => ({
		...item,
		color: INTENSITY_COLORS[Math.max(0, INTENSITY_COLORS.length - paddedRanges.length + index)]
	}));
}
