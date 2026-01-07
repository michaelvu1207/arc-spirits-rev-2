<script lang="ts">
	import type { ArtifactRow, ArtifactTagRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';

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
		onEdit: (artifact: ArtifactRow) => void;
		onDelete: (artifact: ArtifactRow) => void;
		onDeleteMultiple?: (ids: string[]) => void;
	};

	let {
		artifacts,
		language = BASE_LANGUAGE,
		tagLookup,
		guardianLookup,
		runeLookup,
		onEdit,
		onDelete,
		onDeleteMultiple
	}: Props = $props();

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

	// Multi-select state
	let selectedIds = $state<Set<string>>(new Set());

	function toggleSelect(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function selectAll() {
		selectedIds = new Set(artifacts.map(a => a.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	async function deleteSelected() {
		if (selectedIds.size === 0) return;
		if (!confirm(`Delete ${selectedIds.size} selected item(s)?`)) return;

		if (onDeleteMultiple) {
			onDeleteMultiple(Array.from(selectedIds));
		} else {
			// Fallback: delete one by one
			for (const id of selectedIds) {
				const artifact = artifacts.find(a => a.id === id);
				if (artifact) onDelete(artifact);
			}
		}
		selectedIds = new Set();
	}
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={artifacts.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

<section class="card-grid">
	{#each artifacts as artifact (artifact.id)}
		{@const isSelected = selectedIds.has(artifact.id)}
		{@const displayName = getArtifactName(artifact)}
		{@const displayBenefit = getArtifactBenefit(artifact)}

		<article class="card artifact-card" class:selected={isSelected}>
			<header>
				<label class="checkbox-wrapper">
					<input
						type="checkbox"
						checked={isSelected}
						onchange={() => toggleSelect(artifact.id)}
					/>
				</label>
				<div class="header-content">
					<h2>{displayName}</h2>
					<small>
						{#if artifact.guardian_id}
							Guardian: {guardianLookup.getLabel(artifact.guardian_id, 'None')}
						{:else}
							No guardian
						{/if}
						• Qty: {artifact.quantity ?? 1}
					</small>
				</div>
				<CardActionMenu
					onEdit={() => onEdit(artifact)}
					onDelete={() => onDelete(artifact)}
					onGenerate={null}
				/>
			</header>

			<div class="artifact-details">
				{#if displayBenefit}
					<div class="detail-section">
						<h3>Benefit</h3>
						<p class="benefit-text">{displayBenefit}</p>
					</div>
				{/if}

				{#if artifact.tag_ids && artifact.tag_ids.length > 0}
					<div class="detail-section">
						<h3>Tags</h3>
						<div class="tag-list">
							{#each artifact.tag_ids as tagId}
								{@const tag = tagLookup.get(tagId)}
								{#if tag}
									<span class="tag-badge" style="border-color: {tag.color}">
										{tag.name}
									</span>
								{/if}
							{/each}
						</div>
					</div>
				{/if}

				{#if artifact.recipe_box && artifact.recipe_box.length > 0}
					<div class="detail-section">
						<h3>Recipe ({artifact.recipe_box.length} items)</h3>
						<div class="recipe-preview">
							{artifact.recipe_box.slice(0, 3).map(entry => `${entry.quantity}x ${runeLookup.getLabel(entry.rune_id, 'Unknown')}`).join(', ')}
							{#if artifact.recipe_box.length > 3}
								<span class="more">+{artifact.recipe_box.length - 3} more</span>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		</article>
	{:else}
		<div class="card empty">No artifacts match the current filters.</div>
	{/each}
</section>

<style>
	.card-grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.card {
		background: rgba(30, 41, 59, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		padding: 0.5rem;
	}

	.card.empty {
		text-align: center;
		color: #94a3b8;
		padding: 1rem;
		font-style: italic;
		font-size: 0.75rem;
	}

	.artifact-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.artifact-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.4rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		margin-top: 0.2rem;
	}

	.checkbox-wrapper input[type='checkbox'] {
		cursor: pointer;
		width: 16px;
		height: 16px;
	}

	.header-content {
		flex: 1;
	}

	.artifact-card h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #f8fafc;
		line-height: 1.2;
	}

	.artifact-card small {
		display: block;
		color: #a5b4fc;
		margin-top: 0.1rem;
		font-size: 0.7rem;
		line-height: 1.3;
	}

	.artifact-card.selected {
		border-color: rgba(59, 130, 246, 0.5);
		background: rgba(59, 130, 246, 0.1);
	}

	.artifact-details {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.detail-section {
		background: rgba(15, 23, 42, 0.5);
		border-radius: 2px;
		padding: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.detail-section h3 {
		margin: 0 0 0.3rem 0;
		font-size: 0.7rem;
		color: #c7d2fe;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.benefit-text {
		margin: 0;
		font-size: 0.7rem;
		color: #cbd5e1;
		line-height: 1.4;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.tag-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 500;
		padding: 0.15rem 0.35rem;
		border-radius: 2px;
		line-height: 1.2;
		background: rgba(100, 116, 139, 0.3);
		border: 1px solid;
	}

	.recipe-preview {
		font-size: 0.7rem;
		color: #94a3b8;
		line-height: 1.4;
	}

	.recipe-preview .more {
		color: #64748b;
		font-style: italic;
	}
</style>
