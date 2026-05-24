export function withinWindow(publishedAt, fetchedAt, windowDays) {
	if (!windowDays) return true;
	const published = new Date(publishedAt).getTime();
	const fetched = new Date(fetchedAt).getTime();
	if (!Number.isFinite(published) || !Number.isFinite(fetched)) return true;
	const ageMs = fetched - published;
	return ageMs <= windowDays * 24 * 60 * 60 * 1000;
}
