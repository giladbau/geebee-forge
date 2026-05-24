import { readFile } from 'node:fs/promises';

const SHARED_ENV_PATH = '/home/gilad/.hermes/.env';
const LEGACY_DIGEST_ENV_PATH = '/home/gilad/work/geebee-forge-digest/.env';
const HOME_TIMELINE_BEARER = 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
const BOOKMARK_SEARCH_QUERY_ID = 'v8WqjYtOA2VZXidz0tEZgQ';

function parseEnv(text) {
	const data = {};
	for (const line of text.split(/\r?\n/)) {
		if (!line || line.startsWith('#') || !line.includes('=')) continue;
		const [key, ...rest] = line.split('=');
		data[key] = rest.join('=');
	}
	return data;
}

function encodeJson(value) {
	return encodeURIComponent(JSON.stringify(value));
}

async function readEnvFile(path) {
	try {
		return parseEnv(await readFile(path, 'utf8'));
	} catch {
		return {};
	}
}

export async function loadXAuthToken() {
	if (process.env.X_AUTH_TOKEN) return process.env.X_AUTH_TOKEN;
	const sharedEnv = await readEnvFile(SHARED_ENV_PATH);
	if (sharedEnv.X_AUTH_TOKEN) return sharedEnv.X_AUTH_TOKEN;
	const legacyEnv = await readEnvFile(LEGACY_DIGEST_ENV_PATH);
	if (legacyEnv.X_AUTH_TOKEN) return legacyEnv.X_AUTH_TOKEN;
	throw new Error(`X_AUTH_TOKEN missing from ${SHARED_ENV_PATH}`);
}

export async function primeXSession(authToken) {
	const response = await fetch('https://x.com/home', {
		headers: {
			'User-Agent': 'Mozilla/5.0',
			'Cookie': `auth_token=${authToken}`
		}
	});
	const html = await response.text();
	const ct0Match = /ct0=([^;]+)/.exec(response.headers.get('set-cookie') || '') || /ct0[^A-Za-z0-9_-]*([A-Za-z0-9_-]{20,})/.exec(html);
	if (!ct0Match) throw new Error('Unable to derive ct0 token from X session');
	return { ct0: ct0Match[1], html };
}

function sessionHeaders(authToken, ct0) {
	return {
		'User-Agent': 'Mozilla/5.0',
		'authorization': HOME_TIMELINE_BEARER,
		'x-csrf-token': ct0,
		'x-twitter-auth-type': 'OAuth2Session',
		'x-twitter-active-user': 'yes',
		'x-twitter-client-language': 'en',
		'Cookie': `auth_token=${authToken}; ct0=${ct0}`
	};
}

export async function fetchHomeTimeline(authToken, count = 40) {
	const { ct0 } = await primeXSession(authToken);
	const response = await fetch(`https://x.com/i/api/2/timeline/home.json?count=${count}&tweet_mode=extended`, {
		headers: sessionHeaders(authToken, ct0)
	});
	if (!response.ok) throw new Error(`X home timeline fetch failed: ${response.status}`);
	return response.json();
}

export async function fetchBookmarkSearchTimeline(authToken, rawQuery, count = 40) {
	const { ct0 } = await primeXSession(authToken);
	const variables = { rawQuery, count };
	const url = `https://x.com/i/api/graphql/${BOOKMARK_SEARCH_QUERY_ID}/BookmarkSearchTimeline?variables=${encodeJson(variables)}&features=${encodeJson({})}`;
	const response = await fetch(url, { headers: sessionHeaders(authToken, ct0) });
	if (!response.ok) throw new Error(`X bookmark search fetch failed: ${response.status}`);
	return response.json();
}
