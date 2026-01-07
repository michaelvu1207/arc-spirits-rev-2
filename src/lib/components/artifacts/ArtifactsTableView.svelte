<script lang="ts">
	import type { ArtifactRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';

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
	};

	let { artifacts, language = BASE_LANGUAGE, tagLookup, guardianLookup, runeLookup, onEdit }: Props = $props();

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

<div class="table-container">
	<table class="data-table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Guardian</th>
				<th>Tags</th>
				<th>Recipe Items</th>
				<th>Qty</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each artifacts as artifact (artifact.id)}
				{@const displayName = getArtifactName(artifact)}
				{@const displayBenefit = getArtifactBenefit(artifact)}
				<tr>
					<td class="name-cell">
						<div class="name-content">
							{displayName}
							{#if displayBenefit}
								<small>{displayBenefit}</small>
							{/if}
						</div>
					</td>
					<td>{guardianLookup.getLabel(artifact.guardian_id, '—')}</td>
					<td>
						<div class="tags-cell">
							{#if artifact.tag_ids && artifact.tag_ids.length > 0}
								{#each artifact.tag_ids.slice(0, 2) as tagId}
									{@const tag = tagLookup.get(tagId)}
									{#if tag}
										<span class="tag" style="border-color: {tag.color}">
											{tag.name}
										</span>
									{/if}
								{/each}
								{#if artifact.tag_ids.length > 2}
									<span class="more-tag">+{artifact.tag_ids.length - 2}</span>
								{/if}
							{:else}
								<span class="empty">—</span>
							{/if}
						</div>
					</td>
					<td class="number-cell">{artifact.recipe_box?.length ?? 0}</td>
					<td class="number-cell">{artifact.quantity ?? 1}</td>
					<td class="action-cell">
						<CardActionMenu onEdit={() => onEdit(artifact)} onDelete={null} onGenerate={null} />
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="empty-cell">No artifacts match the current filters.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-container {
		overflow-x: auto;
		background: rgba(30, 41, 59, 0.2);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 4px;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.data-table thead {
		background: rgba(15, 23, 42, 0.5);
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.data-table th {
		padding: 0.5rem;
		text-align: left;
		font-weight: 600;
		color: #94a3b8;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.data-table td {
		padding: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		color: #e2e8f0;
	}

	.data-table tbody tr {
		transition: background-color 0.15s ease;
	}

	.data-table tbody tr:hover {
		background: rgba(30, 41, 59, 0.4);
	}

	.name-cell {
		font-weight: 500;
		max-width: 300px;
	}

	.name-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.name-content small {
		color: #94a3b8;
		font-size: 0.7rem;
		font-weight: 400;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.tags-cell {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.tag {
		font-size: 0.65rem;
		padding: 0.15rem 0.3rem;
		background: rgba(100, 116, 139, 0.3);
		border: 1px solid;
		border-radius: 2px;
		line-height: 1.2;
		white-space: nowrap;
	}

	.more-tag {
		font-size: 0.65rem;
		padding: 0.15rem 0.3rem;
		background: rgba(100, 116, 139, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 2px;
		color: #cbd5e1;
	}

	.number-cell {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		color: #93c5fd;
	}

	.empty {
		color: #64748b;
	}

	.action-cell {
		width: 40px;
		text-align: center;
	}

	.empty-cell {
		text-align: center;
		color: #94a3b8;
		padding: 1.5rem;
		font-style: italic;
	}
</style>
