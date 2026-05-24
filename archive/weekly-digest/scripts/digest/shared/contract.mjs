const TOP_LEVEL_FIELDS = ['week', 'published_at', 'hero_topics', 'notable'];
const HERO_FIELDS = ['title', 'slug', 'summary', 'insight', 'sources', 'tags'];
const NOTABLE_FIELDS = ['title', 'summary', 'sources', 'tags'];
const SOURCE_FIELDS = ['title', 'url', 'type'];

function isRecord(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireFields(target, fields, prefix, errors) {
	for (const field of fields) {
		if (!(field in target)) errors.push(`${prefix}missing field: ${field}`);
	}
}

function validateSources(value, prefix, errors) {
	if (!Array.isArray(value)) {
		errors.push(`${prefix}expected array`);
		return;
	}
	value.forEach((source, index) => {
		if (!isRecord(source)) {
			errors.push(`${prefix}[${index}] expected object`);
			return;
		}
		requireFields(source, SOURCE_FIELDS, `${prefix}[${index}].`, errors);
	});
}

function validateTags(value, prefix, errors) {
	if (!Array.isArray(value)) errors.push(`${prefix}expected array`);
}

function validateHeroes(value, errors) {
	if (!Array.isArray(value)) {
		errors.push('hero_topics must be an array');
		return;
	}
	value.forEach((hero, index) => {
		if (!isRecord(hero)) {
			errors.push(`hero_topics[${index}] expected object`);
			return;
		}
		requireFields(hero, HERO_FIELDS, `hero_topics[${index}].`, errors);
		validateSources(hero.sources, `hero_topics[${index}].sources`, errors);
		validateTags(hero.tags, `hero_topics[${index}].tags`, errors);
	});
}

function validateNotable(value, errors) {
	if (!Array.isArray(value)) {
		errors.push('notable must be an array');
		return;
	}
	value.forEach((item, index) => {
		if (!isRecord(item)) {
			errors.push(`notable[${index}] expected object`);
			return;
		}
		requireFields(item, NOTABLE_FIELDS, `notable[${index}].`, errors);
		validateSources(item.sources, `notable[${index}].sources`, errors);
		validateTags(item.tags, `notable[${index}].tags`, errors);
	});
}

export function validateDigestContract(value) {
	const errors = [];
	if (!isRecord(value)) return { ok: false, errors: ['digest must be an object'] };
	for (const field of TOP_LEVEL_FIELDS) {
		if (!(field in value)) errors.push(`missing top-level field: ${field}`);
	}
	if ('hero_topics' in value) validateHeroes(value.hero_topics, errors);
	if ('notable' in value) validateNotable(value.notable, errors);
	return { ok: errors.length === 0, errors };
}
