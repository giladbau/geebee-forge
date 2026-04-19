<script lang="ts">
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

	interface Digest {
		week: string;
		published_at: string;
		hero_topics: HeroTopic[];
		notable: Notable[];
		filename: string;
	}

	interface Props {
		digests: Digest[];
	}

	let { digests }: Props = $props();

	let activeTag = $state<string | null>(null);
	let showFavorites = $state(false);
	let expandedText = $state<Set<string>>(new Set());

	const HERO_SUMMARY_LIMIT = 360;
	const HERO_INSIGHT_LIMIT = 300;
	const NOTABLE_SUMMARY_LIMIT = 260;

	// --- Favorites (localStorage-backed) ---
	function slugify(text: string): string {
		return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
	}

	function heroId(topic: HeroTopic): string {
		return topic.slug;
	}

	function notableId(item: Notable): string {
		return slugify(item.title);
	}

	function loadFavorites(): Set<string> {
		try {
			const raw = localStorage.getItem('digest-favorites');
			if (raw) return new Set(JSON.parse(raw));
		} catch {}
		return new Set();
	}

	function saveFavorites() {
		try {
			localStorage.setItem('digest-favorites', JSON.stringify([...favorites]));
		} catch {}
	}

	let favorites = $state<Set<string>>(new Set());

	// Load from localStorage on mount
	$effect(() => {
		favorites = loadFavorites();
	});

	function toggleFavorite(id: string) {
		if (favorites.has(id)) {
			favorites.delete(id);
		} else {
			favorites.add(id);
		}
		favorites = new Set(favorites); // trigger reactivity
		saveFavorites();
	}

	function isFavorited(id: string): boolean {
		return favorites.has(id);
	}

	function textKey(digest: Digest, kind: string, itemId: string): string {
		return `${digest.filename}:${kind}:${itemId}`;
	}

	function isExpanded(key: string): boolean {
		return expandedText.has(key);
	}

	function toggleExpanded(key: string) {
		if (expandedText.has(key)) {
			expandedText.delete(key);
		} else {
			expandedText.add(key);
		}
		expandedText = new Set(expandedText);
	}

	function needsExpansion(text: string, limit: number): boolean {
		return text.length > limit;
	}

	function displayText(text: string, key: string, limit: number): string {
		if (!needsExpansion(text, limit) || isExpanded(key)) return text;
		const clipped = text.slice(0, limit);
		const lastSpace = clipped.lastIndexOf(' ');
		const cutAt = lastSpace > limit * 0.7 ? lastSpace : limit;
		return `${text.slice(0, cutAt).trimEnd()}...`;
	}

	const latest = $derived(digests[0]);
	const archive = $derived(digests);

	// Collect all unique tags across all digests
	const allTags = $derived(() => {
		const tags = new Set<string>();
		for (const d of digests) {
			for (const t of d.hero_topics) t.tags.forEach((tag: string) => tags.add(tag));
			for (const n of d.notable) n.tags.forEach((tag: string) => tags.add(tag));
		}
		return [...tags].sort();
	});

	// Filter entries by active tag AND favorites
	function heroMatchesTag(topic: any): boolean {
		const tagOk = !activeTag || topic.tags.includes(activeTag);
		const favOk = !showFavorites || favorites.has(heroId(topic));
		return tagOk && favOk;
	}
	function notableMatchesTag(item: any): boolean {
		const tagOk = !activeTag || item.tags.includes(activeTag);
		const favOk = !showFavorites || favorites.has(notableId(item));
		return tagOk && favOk;
	}
	function digestHasMatches(digest: any): boolean {
		return digest.hero_topics.some(heroMatchesTag) || digest.notable.some(notableMatchesTag);
	}

	const favoritesEmpty = $derived(showFavorites && !digests.some(digestHasMatches));

	function toggleTag(tag: string) {
		activeTag = activeTag === tag ? null : tag;
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function badgeColor(type: string): string {
		switch (type) {
			case 'paper': return '#c084fc';
			case 'twitter': return '#38bdf8';
			case 'reddit': return '#f97316';
			case 'blog': return '#4ade80';
			default: return '#94a3b8';
		}
	}
</script>

<div class="digest-page">
	<header class="page-header">
		<h1>Digest</h1>
		<p class="tagline">Weekly signal from the noise — AI, 3D, and the tools that matter.</p>
	</header>

	<div class="filter-actions">
		<button
			class="fav-toggle"
			class:active={showFavorites}
			onclick={() => showFavorites = !showFavorites}
			aria-label={showFavorites ? 'Hide favorites' : 'Show favorites'}
		>★ Favorites</button>
	</div>

	{#if activeTag || showFavorites}
		<div class="tag-filter-bar">
			{#if showFavorites}
				<button class="fav-filter-pill active" onclick={() => showFavorites = false}>★ Favorites ✕</button>
			{/if}
			{#if activeTag}
				<span class="filter-label">Filtered by:</span>
				<button class="tag-pill active" onclick={() => toggleTag(activeTag!)}>{activeTag} ✕</button>
			{/if}
		</div>
	{/if}

	{#if favoritesEmpty}
		<div class="empty-state">
			<p>No favorites yet — tap the ★ on any topic to save it here.</p>
		</div>
	{/if}

	{#if latest}
		<article class="digest-post" id="digest-{latest.filename}">
			<div class="post-header">
				<span class="week-label">Week of {latest.week}</span>
				<time datetime={latest.published_at}>{formatDate(latest.published_at)}</time>
			</div>

			<!-- Hero Topics -->
			<section class="heroes">
				{#each latest.hero_topics as topic}
					{@const summaryKey = textKey(latest, 'hero-summary', heroId(topic))}
					{@const insightKey = textKey(latest, 'hero-insight', heroId(topic))}
					<div class="hero-card" id={topic.slug} class:hidden-by-filter={!heroMatchesTag(topic)}>
						<button
							class="star-btn"
							class:favorited={isFavorited(heroId(topic))}
							onclick={() => toggleFavorite(heroId(topic))}
							aria-label={isFavorited(heroId(topic)) ? `Remove ${topic.title} from favorites` : `Add ${topic.title} to favorites`}
						>★</button>
						<h2 class="hero-title">{topic.title}</h2>
						{#if topic.image_url}
							<div class="hero-image">
								<a href={topic.image_url} target="_blank" rel="noopener noreferrer">
									<img src={topic.image_url} alt={topic.title} loading="lazy" />
								</a>
							</div>
						{/if}
						<p class="hero-summary">{displayText(topic.summary, summaryKey, HERO_SUMMARY_LIMIT)}</p>
						{#if needsExpansion(topic.summary, HERO_SUMMARY_LIMIT)}
							<button
								type="button"
								class="expand-toggle"
								aria-expanded={isExpanded(summaryKey)}
								onclick={() => toggleExpanded(summaryKey)}
							>{isExpanded(summaryKey) ? 'Show less' : 'Read full summary'}</button>
						{/if}

						<div class="insight-box">
							<span class="insight-label">Analyst Note</span>
							<p>{displayText(topic.insight, insightKey, HERO_INSIGHT_LIMIT)}</p>
							{#if needsExpansion(topic.insight, HERO_INSIGHT_LIMIT)}
								<button
									type="button"
									class="expand-toggle in-box"
									aria-expanded={isExpanded(insightKey)}
									onclick={() => toggleExpanded(insightKey)}
								>{isExpanded(insightKey) ? 'Show less' : 'Read full analysis'}</button>
							{/if}
						</div>

						<div class="meta-row">
							<div class="sources">
								{#each topic.sources as source}
									<a
										href={source.url}
										target="_blank"
										rel="noopener noreferrer"
										class="source-link"
									>
										<span class="source-badge" style="background: {badgeColor(source.type)}">{source.type}</span>
										{source.title}
									</a>
								{/each}
							</div>
							<div class="tags">
								{#each topic.tags as tag}
									<button class="tag-pill" class:active={activeTag === tag} onclick={() => toggleTag(tag)}>{tag}</button>
								{/each}
							</div>
						</div>
					</div>
				{/each}
			</section>

			<!-- Also Notable -->
			{#if latest.notable.length > 0}
				<section class="notable-section">
					<h3 class="section-heading">Also Notable</h3>
					<div class="notable-list">
						{#each latest.notable as item}
							{@const notableSummaryKey = textKey(latest, 'notable-summary', notableId(item))}
							<div class="notable-item" class:hidden-by-filter={!notableMatchesTag(item)}>
								<div class="notable-main">
									<div class="notable-title-row">
										<h4 class="notable-title">{item.title}</h4>
										<button
											class="star-btn inline"
											class:favorited={isFavorited(notableId(item))}
											onclick={() => toggleFavorite(notableId(item))}
											aria-label={isFavorited(notableId(item)) ? `Remove ${item.title} from favorites` : `Add ${item.title} to favorites`}
										>★</button>
									</div>
									<p class="notable-summary">{displayText(item.summary, notableSummaryKey, NOTABLE_SUMMARY_LIMIT)}</p>
									{#if needsExpansion(item.summary, NOTABLE_SUMMARY_LIMIT)}
										<button
											type="button"
											class="expand-toggle compact"
											aria-expanded={isExpanded(notableSummaryKey)}
											onclick={() => toggleExpanded(notableSummaryKey)}
										>{isExpanded(notableSummaryKey) ? 'Show less' : 'Read more'}</button>
									{/if}
								</div>
								<div class="notable-meta">
									<div class="sources">
										{#each item.sources as source}
											<a
												href={source.url}
												target="_blank"
												rel="noopener noreferrer"
												class="source-link compact"
											>
												<span class="source-badge" style="background: {badgeColor(source.type)}">{source.type}</span>
												{source.title}
											</a>
										{/each}
									</div>
									<div class="tags">
										{#each item.tags as tag}
											<button class="tag-pill" class:active={activeTag === tag} onclick={() => toggleTag(tag)}>{tag}</button>
										{/each}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</article>

		<!-- Remaining digests (archive posts) -->
		{#each digests.slice(1) as digest}
			{#if (!activeTag && !showFavorites) || digestHasMatches(digest)}
			<article class="digest-post" id="digest-{digest.filename}">
				<div class="post-header">
					<span class="week-label">Week of {digest.week}</span>
					<time datetime={digest.published_at}>{formatDate(digest.published_at)}</time>
				</div>

				<section class="heroes">
					{#each digest.hero_topics as topic}
						{@const summaryKey = textKey(digest, 'hero-summary', heroId(topic))}
						{@const insightKey = textKey(digest, 'hero-insight', heroId(topic))}
						<div class="hero-card" id={topic.slug} class:hidden-by-filter={!heroMatchesTag(topic)}>
							<button
								class="star-btn"
								class:favorited={isFavorited(heroId(topic))}
								onclick={() => toggleFavorite(heroId(topic))}
								aria-label={isFavorited(heroId(topic)) ? `Remove ${topic.title} from favorites` : `Add ${topic.title} to favorites`}
							>★</button>
							<h2 class="hero-title">{topic.title}</h2>
							{#if topic.image_url}
								<div class="hero-image">
									<a href={topic.image_url} target="_blank" rel="noopener noreferrer">
										<img src={topic.image_url} alt={topic.title} loading="lazy" />
									</a>
								</div>
							{/if}
							<p class="hero-summary">{displayText(topic.summary, summaryKey, HERO_SUMMARY_LIMIT)}</p>
							{#if needsExpansion(topic.summary, HERO_SUMMARY_LIMIT)}
								<button
									type="button"
									class="expand-toggle"
									aria-expanded={isExpanded(summaryKey)}
									onclick={() => toggleExpanded(summaryKey)}
								>{isExpanded(summaryKey) ? 'Show less' : 'Read full summary'}</button>
							{/if}

							<div class="insight-box">
								<span class="insight-label">Analyst Note</span>
								<p>{displayText(topic.insight, insightKey, HERO_INSIGHT_LIMIT)}</p>
								{#if needsExpansion(topic.insight, HERO_INSIGHT_LIMIT)}
									<button
										type="button"
										class="expand-toggle in-box"
										aria-expanded={isExpanded(insightKey)}
										onclick={() => toggleExpanded(insightKey)}
									>{isExpanded(insightKey) ? 'Show less' : 'Read full analysis'}</button>
								{/if}
							</div>

							<div class="meta-row">
								<div class="sources">
									{#each topic.sources as source}
										<a
											href={source.url}
											target="_blank"
											rel="noopener noreferrer"
											class="source-link"
										>
											<span class="source-badge" style="background: {badgeColor(source.type)}">{source.type}</span>
											{source.title}
										</a>
									{/each}
								</div>
								<div class="tags">
									{#each topic.tags as tag}
										<button class="tag-pill" class:active={activeTag === tag} onclick={() => toggleTag(tag)}>{tag}</button>
									{/each}
								</div>
							</div>
						</div>
					{/each}
				</section>

				{#if digest.notable.length > 0}
					<section class="notable-section">
						<h3 class="section-heading">Also Notable</h3>
						<div class="notable-list">
							{#each digest.notable as item}
								{@const notableSummaryKey = textKey(digest, 'notable-summary', notableId(item))}
								<div class="notable-item" class:hidden-by-filter={!notableMatchesTag(item)}>
									<div class="notable-main">
										<div class="notable-title-row">
											<h4 class="notable-title">{item.title}</h4>
											<button
												class="star-btn inline"
												class:favorited={isFavorited(notableId(item))}
												onclick={() => toggleFavorite(notableId(item))}
												aria-label={isFavorited(notableId(item)) ? `Remove ${item.title} from favorites` : `Add ${item.title} to favorites`}
											>★</button>
										</div>
										<p class="notable-summary">{displayText(item.summary, notableSummaryKey, NOTABLE_SUMMARY_LIMIT)}</p>
										{#if needsExpansion(item.summary, NOTABLE_SUMMARY_LIMIT)}
											<button
												type="button"
												class="expand-toggle compact"
												aria-expanded={isExpanded(notableSummaryKey)}
												onclick={() => toggleExpanded(notableSummaryKey)}
											>{isExpanded(notableSummaryKey) ? 'Show less' : 'Read more'}</button>
										{/if}
									</div>
									<div class="notable-meta">
										<div class="sources">
											{#each item.sources as source}
												<a
													href={source.url}
													target="_blank"
													rel="noopener noreferrer"
													class="source-link compact"
												>
													<span class="source-badge" style="background: {badgeColor(source.type)}">{source.type}</span>
													{source.title}
												</a>
											{/each}
										</div>
										<div class="tags">
											{#each item.tags as tag}
												<button class="tag-pill" class:active={activeTag === tag} onclick={() => toggleTag(tag)}>{tag}</button>
											{/each}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</article>
			{/if}
		{/each}
	{/if}

	<!-- Archive Index -->
	{#if archive.length > 0}
		<section class="archive-section">
			<h3 class="section-heading">Archive</h3>
			<ul class="archive-list">
				{#each archive as digest}
					<li>
						<a href="#digest-{digest.filename}" class="archive-link">
							<time datetime={digest.published_at}>{formatDate(digest.published_at)}</time>
							<span class="archive-week">{digest.week}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<style>
	.digest-page {
		max-width: 780px;
		margin: 0 auto;
		padding: 4rem 1.5rem 4rem;
		min-height: 100vh;
	}

	/* Header */
	.page-header {
		margin-bottom: 3rem;
	}

	.page-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0;
		letter-spacing: -0.02em;
		background: linear-gradient(135deg, #e0e0e0, #6ba3ff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.tagline {
		color: #888;
		font-size: 0.95rem;
		margin: 0.5rem 0 0;
		letter-spacing: 0.02em;
	}

	/* Filter Actions */
	.filter-actions {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.fav-toggle {
		font-size: 0.78rem;
		color: #666;
		padding: 0.3rem 0.75rem;
		border: 1px solid #222;
		border-radius: 16px;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.fav-toggle:hover {
		color: #f59e0b;
		border-color: #f59e0b44;
	}

	.fav-toggle.active {
		color: #f59e0b;
		border-color: #f59e0b;
		background: rgba(245, 158, 11, 0.1);
	}

	.fav-filter-pill {
		font-size: 0.7rem;
		color: #f59e0b;
		padding: 0.15rem 0.5rem;
		border: 1px solid #f59e0b;
		border-radius: 12px;
		background: rgba(245, 158, 11, 0.1);
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.fav-filter-pill:hover {
		background: rgba(245, 158, 11, 0.2);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: 2.5rem 1rem;
		color: #555;
		font-size: 0.9rem;
	}

	.empty-state p {
		margin: 0;
	}

	/* Star Button */
	.star-btn {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		background: none;
		border: none;
		font-size: 1.2rem;
		color: #333;
		cursor: pointer;
		padding: 0.25rem;
		line-height: 1;
		transition: color 0.15s, transform 0.15s;
		z-index: 1;
	}

	.star-btn:hover {
		color: #f59e0b88;
		transform: scale(1.15);
	}

	.star-btn.favorited {
		color: #f59e0b;
	}

	.star-btn.favorited:hover {
		color: #f59e0bcc;
	}

	.star-btn.inline {
		position: static;
		font-size: 0.95rem;
		flex-shrink: 0;
	}

	/* Notable Title Row */
	.notable-title-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	/* Digest Post */
	.digest-post {
		margin-bottom: 4rem;
		padding-bottom: 3rem;
		border-bottom: 1px solid #1a1a1a;
	}

	.digest-post:last-of-type {
		border-bottom: none;
	}

	.post-header {
		display: flex;
		align-items: baseline;
		gap: 1rem;
		margin-bottom: 2rem;
		flex-wrap: wrap;
	}

	.week-label {
		font-size: 0.8rem;
		color: #6ba3ff;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}

	.post-header time {
		font-size: 0.8rem;
		color: #555;
	}

	/* Hero Cards */
	.heroes {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.hero-card {
		position: relative;
		background: #111;
		border: 1px solid #1e1e1e;
		border-radius: 10px;
		padding: 1.75rem;
		transition: border-color 0.2s;
	}

	.hero-card:hover {
		border-color: #2a2a2a;
	}

	.hero-title {
		font-size: 1.3rem;
		font-weight: 600;
		margin: 0 0 0.75rem;
		color: #e8e8e8;
		line-height: 1.3;
		padding-right: 2rem;
	}

	.hero-summary {
		color: #b0b0b0;
		font-size: 0.9rem;
		line-height: 1.65;
		margin: 0 0 1.25rem;
	}

	.expand-toggle {
		display: inline-flex;
		align-items: center;
		color: #6ba3ff;
		background: transparent;
		border: 1px solid #24344f;
		border-radius: 6px;
		padding: 0.25rem 0.55rem;
		margin: -0.55rem 0 1.25rem;
		font-family: inherit;
		font-size: 0.74rem;
		line-height: 1.2;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s, background 0.15s;
	}

	.expand-toggle:hover {
		color: #c8dcff;
		border-color: #3b5f96;
		background: rgba(107, 163, 255, 0.08);
	}

	.expand-toggle.in-box {
		margin: 0.7rem 0 0;
	}

	.expand-toggle.compact {
		margin: -0.25rem 0 0.6rem;
		font-size: 0.7rem;
	}

	/* Insight Box */
	.insight-box {
		background: #0d1117;
		border-left: 3px solid #6ba3ff;
		border-radius: 0 6px 6px 0;
		padding: 1rem 1.25rem;
		margin-bottom: 1.25rem;
	}

	.insight-label {
		display: inline-block;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #6ba3ff;
		margin-bottom: 0.4rem;
	}

	.insight-box p {
		color: #9ab;
		font-size: 0.85rem;
		line-height: 1.6;
		margin: 0;
		font-style: italic;
	}

	/* Hero Image */
	.hero-image {
		margin: 0.75rem 0 1rem;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid #1e1e1e;
	}

	.hero-image img {
		width: 100%;
		height: auto;
		display: block;
		max-height: 400px;
		object-fit: cover;
	}

	/* Meta Row */
	.meta-row {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* Sources */
	.sources {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.source-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		color: #8a8a8a;
		text-decoration: none;
		font-size: 0.78rem;
		padding: 0.25rem 0.5rem;
		background: #0a0a0a;
		border: 1px solid #1a1a1a;
		border-radius: 4px;
		transition: color 0.2s, border-color 0.2s;
		line-height: 1.3;
	}

	.source-link:hover {
		color: #c0c0c0;
		border-color: #333;
	}

	.source-link.compact {
		font-size: 0.75rem;
		padding: 0.2rem 0.4rem;
	}

	.source-badge {
		display: inline-block;
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: #0a0a0a;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		line-height: 1.2;
		flex-shrink: 0;
	}

	/* Tags */
	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.tag-pill {
		font-size: 0.7rem;
		color: #666;
		padding: 0.15rem 0.5rem;
		border: 1px solid #222;
		border-radius: 12px;
		white-space: nowrap;
		background: transparent;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.tag-pill:hover {
		color: #aaa;
		border-color: #444;
	}

	.tag-pill.active {
		color: #6ba3ff;
		border-color: #6ba3ff;
		background: rgba(107, 163, 255, 0.1);
	}

	/* Tag Filter Bar */
	.tag-filter-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1.5rem;
		padding: 0.6rem 1rem;
		background: #111;
		border: 1px solid #1e1e1e;
		border-radius: 8px;
	}

	.filter-label {
		font-size: 0.75rem;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Hidden by filter */
	.hidden-by-filter {
		display: none !important;
	}

	/* Section Heading */
	.section-heading {
		font-size: 0.85rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: #555;
		margin: 2.5rem 0 1.25rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #1a1a1a;
	}

	/* Notable Section */
	.notable-list {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.notable-item {
		padding: 1rem 0;
		border-bottom: 1px solid #141414;
	}

	.notable-item:last-child {
		border-bottom: none;
	}

	.notable-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: #d0d0d0;
		margin: 0 0 0.3rem;
	}

	.notable-summary {
		color: #888;
		font-size: 0.85rem;
		line-height: 1.5;
		margin: 0 0 0.6rem;
	}

	.notable-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	/* Archive */
	.archive-section {
		margin-top: 2rem;
	}

	.archive-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.archive-list li {
		border-bottom: 1px solid #141414;
	}

	.archive-link {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 0.5rem;
		text-decoration: none;
		color: #b0b0b0;
		transition: color 0.2s, background 0.2s;
		border-radius: 4px;
	}

	.archive-link:hover {
		color: #e0e0e0;
		background: #111;
	}

	.archive-link time {
		font-size: 0.85rem;
		color: #6ba3ff;
		flex-shrink: 0;
		min-width: 140px;
	}

	.archive-week {
		font-size: 0.8rem;
		color: #555;
	}

	/* Responsive */
	@media (max-width: 600px) {
		.digest-page {
			padding: 1.25rem 1rem 3rem;
		}

		.page-header h1 {
			font-size: 2rem;
		}

		.hero-card {
			padding: 1.25rem;
		}

		.hero-title {
			font-size: 1.15rem;
		}

		.post-header {
			flex-direction: column;
			gap: 0.25rem;
		}

		.archive-link {
			flex-direction: column;
			gap: 0.25rem;
			align-items: flex-start;
		}

		.archive-link time {
			min-width: auto;
		}
	}
</style>
