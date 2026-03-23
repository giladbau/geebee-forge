export function corsHeaders(origin: string | null): Record<string, string> {
	return {
		'Access-Control-Allow-Origin': origin || '*',
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
