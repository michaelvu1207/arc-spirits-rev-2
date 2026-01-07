<script lang="ts">
	import type { ArtifactRow } from '$lib/types/gameData';

	type ArtifactLanguage = 'base' | string;
	const BASE_LANGUAGE: ArtifactLanguage = 'base';

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
		get: (id: string | null) => any;
	};

	type Props = {
		artifacts: ArtifactRow[];
		language?: ArtifactLanguage;
		tagLookup: LookupService;
		guardianLookup: LookupService;
		runeLookup: LookupService;
	};

	let { artifacts, language = BASE_LANGUAGE, tagLookup, guardianLookup, runeLookup }: Props = $props();

	function normalizeOptionalText(value: string | null | undefined): string | null {
		const trimmed = (value ?? '').trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	function normalizeLanguageCode(value: string): string {
		return value.trim().replace(/_/g, '-').toLowerCase();
	}

	function getTranslationValue(input: unknown, lang: string): string | null {
		if (!lang || lang === BASE_LANGUAGE) return null;
		if (!input || typeof input !== 'object') return null;
		const record = input as Record<string, unknown>;
		const direct = record[lang];
		if (typeof direct === 'string') return normalizeOptionalText(direct);
		for (const [key, value] of Object.entries(record)) {
			if (normalizeLanguageCode(key) !== lang) continue;
			if (typeof value !== 'string') continue;
			return normalizeOptionalText(value);
		}
		return null;
	}

	function getArtifactName(artifact: ArtifactRow): string {
		if (language === BASE_LANGUAGE) return artifact.name;
		return getTranslationValue(artifact.name_translations, language) ?? artifact.name;
	}

	function getArtifactBenefit(artifact: ArtifactRow): string {
		if (language === BASE_LANGUAGE) return artifact.benefit ?? '';
		return getTranslationValue(artifact.benefit_translations, language) ?? artifact.benefit ?? '';
	}
</script>

<section class="preview-grid">
	{#each artifacts as artifact (artifact.id)}
		{@const displayName = getArtifactName(artifact)}
		{@const displayBenefit = getArtifactBenefit(artifact)}
		<article class="preview-card">
			<div class="card-header">
				<h2>{displayName}</h2>
				{#if artifact.guardian_id}
					<span class="guardian">{guardianLookup.getLabel(artifact.guardian_id)}</span>
				{/if}
			</div>

			{#if displayBenefit}
				<div class="card-benefit">
					<p>{displayBenefit}</p>
				</div>
			{/if}

			{#if artifact.tag_ids && artifact.tag_ids.length > 0}
				<div class="card-tags">
					{#each artifact.tag_ids as tagId}
						{@const tag = tagLookup.get(tagId)}
						{#if tag}
							<span class="tag" style="border-color: {tag.color}; background-color: {tag.color}20">
								{tag.name}
							</span>
						{/if}
					{/each}
				</div>
			{/if}

			{#if artifact.recipe_box && artifact.recipe_box.length > 0}
				<div class="card-recipe">
					<h4>Recipe</h4>
					<ul>
						{#each artifact.recipe_box as entry}
							<li>{entry.quantity}x {runeLookup.getLabel(entry.rune_id, 'Unknown')}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="card-footer">
				<span class="quantity">Qty: {artifact.quantity ?? 1}</span>
			</div>
		</article>
	{:else}
		<div class="empty">No artifacts match the current filters.</div>
	{/each}
</section>

<style>
	.preview-grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	.preview-card {
		background: linear-gradient(135deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%);
		border: 2px solid rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
		transition: all 0.2s ease;
	}

	.preview-card:hover {
		border-color: rgba(148, 163, 184, 0.5);
		box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
		transform: translateY(-2px);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.card-header h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #f8fafc;
		line-height: 1.2;
		flex: 1;
	}

	.guardian {
		font-size: 0.65rem;
		padding: 0.2rem 0.4rem;
		background: rgba(168, 85, 247, 0.2);
		border: 1px solid rgba(168, 85, 247, 0.4);
		border-radius: 3px;
		color: #d8b4fe;
		font-weight: 600;
		white-space: nowrap;
	}

	.card-benefit {
		padding: 0.5rem;
		background: rgba(59, 130, 246, 0.1);
		border-left: 2px solid rgba(59, 130, 246, 0.5);
		border-radius: 2px;
	}

	.card-benefit p {
		margin: 0;
		font-size: 0.75rem;
		color: #cbd5e1;
		line-height: 1.4;
	}

	.card-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.tag {
		font-size: 0.65rem;
		padding: 0.2rem 0.4rem;
		border: 1px solid;
		border-radius: 3px;
		font-weight: 600;
		line-height: 1.2;
	}

	.card-recipe {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 4px;
		padding: 0.5rem;
	}

	.card-recipe h4 {
		margin: 0 0 0.3rem 0;
		font-size: 0.7rem;
		color: #c7d2fe;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.card-recipe ul {
		margin: 0;
		padding-left: 1rem;
		list-style: disc;
	}

	.card-recipe li {
		font-size: 0.7rem;
		color: #94a3b8;
		line-height: 1.4;
	}

	.card-footer {
		margin-top: auto;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.2);
		display: flex;
		justify-content: flex-end;
	}

	.quantity {
		font-size: 0.7rem;
		color: #94a3b8;
		font-weight: 600;
	}

	.empty {
		grid-column: 1 / -1;
		text-align: center;
		color: #94a3b8;
		padding: 2rem;
		font-style: italic;
		font-size: 0.75rem;
	}
</style>
