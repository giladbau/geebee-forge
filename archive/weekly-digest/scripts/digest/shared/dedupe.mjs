function itemKeys(item) {
	const keys = new Set();
	if (item?.id) keys.add(`id:${item.id}`);
	if (item?.url) keys.add(`url:${item.url}`);
	if (Array.isArray(item?.dedupe_keys)) {
		for (const key of item.dedupe_keys) keys.add(`dedupe:${key}`);
	}
	return keys;
}

export function dedupeItems(items) {
	const output = [];
	const seen = new Set();

	for (const item of items) {
		const keys = itemKeys(item);
		const duplicate = [...keys].some((key) => seen.has(key));
		if (duplicate) continue;
		output.push(item);
		for (const key of keys) seen.add(key);
	}

	return output;
}
