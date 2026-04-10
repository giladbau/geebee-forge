type Ring = [number, number][];

type PolygonGeometry = {
	type: 'Polygon';
	coordinates: Ring[];
};

type MultiPolygonGeometry = {
	type: 'MultiPolygon';
	coordinates: Ring[][];
};

export type HeatGeometry = PolygonGeometry | MultiPolygonGeometry | null;

interface BuildAreaHeatPointsInput {
	lat: number;
	lng: number;
	count: number;
	geometry: HeatGeometry;
}

function getOuterRings(geometry: HeatGeometry): Ring[] {
	if (!geometry) return [];
	return geometry.type === 'Polygon'
		? [geometry.coordinates[0] ?? []]
		: geometry.coordinates.map((polygon) => polygon[0] ?? []);
}

function getBounds(ring: Ring) {
	const lngs = ring.map(([lng]) => lng);
	const lats = ring.map(([, lat]) => lat);
	return {
		minLng: Math.min(...lngs),
		maxLng: Math.max(...lngs),
		minLat: Math.min(...lats),
		maxLat: Math.max(...lats)
	};
}

function pointInRing(lat: number, lng: number, ring: Ring): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		const intersects = ((yi > lat) !== (yj > lat))
			&& (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
		if (intersects) inside = !inside;
	}
	return inside;
}

function buildSamplesForRing(ring: Ring, fallbackLat: number, fallbackLng: number): [number, number][] {
	if (ring.length < 4) return [[fallbackLat, fallbackLng]];

	const bounds = getBounds(ring);
	const centerLat = (bounds.minLat + bounds.maxLat) / 2;
	const centerLng = (bounds.minLng + bounds.maxLng) / 2;
	const latInset = (bounds.maxLat - bounds.minLat) * 0.22;
	const lngInset = (bounds.maxLng - bounds.minLng) * 0.22;

	const candidates: [number, number][] = [
		[centerLat, centerLng],
		[centerLat + latInset, centerLng],
		[centerLat - latInset, centerLng],
		[centerLat, centerLng + lngInset],
		[centerLat, centerLng - lngInset]
	];

	const inside = candidates.filter(([lat, lng]) => pointInRing(lat, lng, ring));
	if (inside.length > 0) return inside;
	return [[fallbackLat, fallbackLng]];
}

export function buildAreaHeatPoints(input: BuildAreaHeatPointsInput): [number, number, number][] {
	const { lat, lng, count, geometry } = input;
	if (!geometry) return [[lat, lng, count]];

	const rings = getOuterRings(geometry).filter((ring) => ring.length >= 4);
	if (rings.length === 0) return [[lat, lng, count]];

	const samples = rings.flatMap((ring) => buildSamplesForRing(ring, lat, lng));
	if (samples.length === 0) return [[lat, lng, count]];

	const weight = count / samples.length;
	return samples.map(([sampleLat, sampleLng]) => [sampleLat, sampleLng, weight]);
}
