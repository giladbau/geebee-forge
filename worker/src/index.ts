import { handleSummary } from './routes/summary';
import { handleHistory } from './routes/history';
import { handleDistribution } from './routes/distribution';
import { handleCities } from './routes/cities';
import { handleStatsCities } from './routes/stats-cities';
import { handleGeocode } from './routes/geocode';
import { handleZoneSummary } from './routes/zone-summary';
import { handleZoneDistribution } from './routes/zone-distribution';
import { corsHeaders, addCorsHeaders } from './lib/cors';

export interface Env {
	REDALERT_API_KEY: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin');

		// CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders(origin) });
		}

		try {
			let response: Response;

			switch (url.pathname) {
				case '/api/alerts/summary':
					response = await handleSummary(request, env);
					break;
				case '/api/alerts/history':
					response = await handleHistory(request, env);
					break;
				case '/api/alerts/distribution':
					response = await handleDistribution(request, env);
					break;
				case '/api/alerts/cities':
					response = await handleCities(request, env);
					break;
				case '/api/alerts/stats-cities':
					response = await handleStatsCities(request, env);
					break;
				case '/api/alerts/geocode':
					response = await handleGeocode(request);
					break;
				case '/api/alerts/zone-summary':
					response = await handleZoneSummary(request, env);
					break;
				case '/api/alerts/zone-distribution':
					response = await handleZoneDistribution(request, env);
					break;
				default:
					response = new Response(JSON.stringify({ error: 'Not found' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' }
					});
			}

			return addCorsHeaders(response, origin);
		} catch (err) {
			console.error('Worker error:', err);
			return addCorsHeaders(
				new Response(JSON.stringify({ error: 'Internal server error' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}),
				origin
			);
		}
	}
};
