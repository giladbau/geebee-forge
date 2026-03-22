declare module 'leaflet.heat' {
	// Side-effect import — attaches L.heatLayer to Leaflet namespace
}

declare namespace L {
	function heatLayer(
		latlngs: Array<[number, number] | [number, number, number]>,
		options?: {
			minOpacity?: number;
			maxZoom?: number;
			max?: number;
			radius?: number;
			blur?: number;
			gradient?: Record<number, string>;
		}
	): any;
}
