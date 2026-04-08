export function nowIso() {
	return new Date().toISOString();
}

export function dateStamp(iso = nowIso()) {
	return iso.slice(0, 10);
}

export function compactTimestamp(iso = nowIso()) {
	return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
