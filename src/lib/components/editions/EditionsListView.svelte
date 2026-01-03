<script lang="ts">
	import type { EditionRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';

	type LookupService = {
		getLabel: (id: string | null, defaultValue?: string) => string;
		get: (id: string | null) => any;
	};

	type Props = {
		editions: EditionRow[];
		originLookup: LookupService;
		stats: Map<string, { totalUnique: number; totalWithDuplicates: number }>;
		onEdit: (edition: EditionRow) => void;
		onDelete: (edition: EditionRow) => void;
		onDeleteMultiple: (ids: string[]) => void;
		onSelect: (edition: EditionRow) => void;
		selectedEditionId: string | null;
	};

	let { editions, originLookup, stats, onEdit, onDelete, onDeleteMultiple, onSelect, selectedEditionId }: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());

	function toggleSelect(id: string, event: Event) {
		event.stopPropagation();
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function selectAll() {
		selectedIds = new Set(editions.map(e => e.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function deleteSelected() {
		onDeleteMultiple(Array.from(selectedIds));
		selectedIds = new Set();
	}
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={editions.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

<section class="card-grid">
	{#each editions as edition (edition.id)}
		{@const editionStats = stats.get(edition.id)}
		<button
			class="card edition-card"
			class:selected={selectedEditionId === edition.id || selectedIds.has(edition.id)}
			onclick={() => onSelect(edition)}
		>
			<header>
				<div class="checkbox-wrapper">
					<input
						type="checkbox"
						checked={selectedIds.has(edition.id)}
						onclick={(e) => toggleSelect(edition.id, e)}
					/>
				</div>
				<div class="header-content">
					<div>
						<h2>
							{edition.name}
							{#if edition.is_default}
								<span class="tag default">Default</span>
							{/if}
						</h2>
						{#if edition.description}
							<small>{edition.description}</small>
						{/if}
					</div>
					<CardActionMenu
						onEdit={() => onEdit(edition)}
						onDelete={() => onDelete(edition)}
						onGenerate={null}
					/>
				</div>
			</header>

			<div class="edition-details">
				<div class="detail-section">
					<h3>Origins ({edition.origin_ids.length})</h3>
					<div class="origin-chips">
						{#each edition.origin_ids as originId}
							{@const origin = originLookup.get(originId)}
							{#if origin}
								<span class="origin-chip" style="border-color: {origin.color}">
									{origin.name}
								</span>
							{/if}
						{/each}
					</div>
				</div>

				{#if editionStats}
					<div class="stats">
						<div class="stat">
							<span class="stat__value">{editionStats.totalUnique}</span>
							<span class="stat__label">Unique</span>
						</div>
						<div class="stat">
							<span class="stat__value">{editionStats.totalWithDuplicates}</span>
							<span class="stat__label">Total</span>
						</div>
					</div>
				{/if}
			</div>
		</button>
	{:else}
		<div class="card empty">No editions yet. Create one to get started.</div>
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

	.edition-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
		width: 100%;
	}

	.edition-card:hover {
		background: rgba(30, 41, 59, 0.5);
	}

	.edition-card.selected {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.4);
	}

	.edition-card header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		padding-top: 0.1rem;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		margin: 0;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.4rem;
		flex: 1;
	}

	.edition-card h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #f8fafc;
		line-height: 1.2;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.tag.default {
		font-size: 0.6rem;
		padding: 0.15rem 0.3rem;
		background: rgba(34, 197, 94, 0.2);
		border: 1px solid rgba(34, 197, 94, 0.4);
		border-radius: 2px;
		color: #86efac;
		font-weight: 500;
	}

	.edition-card small {
		display: block;
		color: #a5b4fc;
		margin-top: 0.1rem;
		font-size: 0.7rem;
		line-height: 1.3;
	}

	.edition-details {
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

	.origin-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.origin-chip {
		font-size: 0.65rem;
		padding: 0.15rem 0.35rem;
		background: rgba(51, 65, 85, 0.5);
		border: 1px solid;
		border-radius: 2px;
		line-height: 1.2;
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.4rem;
	}

	.stat {
		text-align: center;
		padding: 0.4rem;
		background: rgba(51, 65, 85, 0.4);
		border-radius: 2px;
	}

	.stat__value {
		display: block;
		font-size: 1.1rem;
		font-weight: 600;
		color: #93c5fd;
		line-height: 1.2;
	}

	.stat__label {
		font-size: 0.65rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
</style>
