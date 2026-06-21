<script lang="ts">
	import type { MatItemRow, LookupService } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';
	import { useMultiSelect } from '$lib/composables';

	type Props = {
		mats: MatItemRow[];
		originLookup: LookupService;
		onEdit: (mat: MatItemRow) => void;
		onDelete: (mat: MatItemRow) => void;
		onDeleteMultiple: (mats: MatItemRow[]) => void;
	};

	let { mats, originLookup, onEdit, onDelete, onDeleteMultiple }: Props = $props();

	const selection = useMultiSelect();

	function getMatCategory(mat: MatItemRow): string {
		if (mat.origin_id) return originLookup.getLabel(mat.origin_id, 'Unknown Origin');
		return 'Unassigned';
	}

	function getMatKindLabel(mat: MatItemRow): string {
		return mat.kind === 'relic' ? 'Relic' : 'Rune';
	}

	function deleteSelected() {
		const matsToDelete = mats.filter((m) => selection.isSelected(m.id));
		onDeleteMultiple(matsToDelete);
		selection.deselectAll();
	}
</script>

<MultiSelectBar
	selectedCount={selection.selectedCount}
	totalCount={mats.length}
	onSelectAll={() => selection.selectAll(mats.map((m) => m.id))}
	onDeselectAll={selection.deselectAll}
	onDeleteSelected={deleteSelected}
/>

{#if mats.length === 0}
	<div class="empty-state">No mats match the current filters.</div>
{:else}
	<div class="mat-list">
		{#each mats as mat (mat.id)}
			<article class="mat-card" class:selected={selection.isSelected(mat.id)}>
				<header>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={selection.isSelected(mat.id)}
							onchange={() => selection.toggle(mat.id)}
							aria-label="Select {mat.name}"
						/>
					</div>
					<div class="header-content">
						<div class="mat-card__identity">
							<h2>{mat.name}</h2>
						</div>
						<CardActionMenu
							onEdit={() => onEdit(mat)}
							onDelete={() => onDelete(mat)}
							onGenerate={null}
						/>
					</div>
				</header>
				<p class="meta">
					<span class="kind-badge {mat.kind}">
						{getMatKindLabel(mat)}
					</span>
					{getMatCategory(mat)}
				</p>
			</article>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.mat-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.5rem;
	}

	.mat-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 6px;
		padding: 0.5rem;
		transition: all 0.2s;
	}

	.mat-card:hover {
		border-color: rgba(148, 163, 184, 0.3);
		background: rgba(30, 41, 59, 0.6);
	}

	.mat-card header {
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
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #3b82f6;
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		flex: 1;
		gap: 0.5rem;
	}

	.mat-card__identity {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mat-card.selected {
		border-color: rgba(59, 130, 246, 0.5);
		background: rgba(59, 130, 246, 0.1);
	}

	.mat-card h2 {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.mat-card .meta {
		margin: 0.4rem 0 0 0;
		color: #a5b4fc;
		font-weight: 500;
		font-size: 0.7rem;
	}

	.kind-badge {
		display: inline-block;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		margin-right: 0.3rem;
	}

	.kind-badge.rune {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.kind-badge.relic {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}
</style>
