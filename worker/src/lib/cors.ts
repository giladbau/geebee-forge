const ALLOWED_ORIGINS = [
	'https://geebee-forge.pages.dev',
	'https://geebee-forge-api-preview.gilad-bau.workers.dev',
];

function isAllowedOrigin(origin: string): boolean {
	if (ALLOWED_ORIGINS.includes(origin)) return true;
	// Preview deploy branches: pr-*.geebee-forge.pages.dev
	if (/^https:\/\/[\w-]+\.geebee-forge\.pages\.dev$/.test(origin)) return true;
	// Local dev
	if (origin.startsWith('http://localhost:')) return true;
	return false;
}

export function corsHeaders(origin: string | null): Record<string, string> {
	const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
	return {
		'Access-Control-Allow-Origin': allowedOrigin,
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400'
	};
}

export function addCorsHeaders(response: Response, origin: string | null): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(corsHeaders(origin))) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
