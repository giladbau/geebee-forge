import type { PageLoad } from './$types';

interface Source {
	title: string;
	url: string;
	type: string;
}

interface HeroTopic {
	title: string;
	slug: string;
	summary: string;
	insight: string;
	sources: Source[];
	image_url: string | null;
	tags: string[];
}

interface Notable {
	title: string;
	summary: string;
	sources: Source[];
	tags: string[];
}

export interface Digest {
	week: string;
	published_at: string;
	hero_topics: HeroTopic[];
	notable: Notable[];
	filename: string;
}

export const load: PageLoad = async () => {
	const modules = import.meta.glob('/src/lib/digest-data/*.json', { eager: true });

	const digests: Digest[] = Object.entries(modules).map(([path, mod]) => {
		const data = mod as Record<string, unknown>;
		const filename = path.split('/').pop()?.replace('.json', '') ?? '';
		return { ...data, filename } as Digest;
	});

	digests.sort((a, b) => b.published_at.localeCompare(a.published_at));

	return { digests };
};
