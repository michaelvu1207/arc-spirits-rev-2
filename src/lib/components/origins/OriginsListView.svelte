<script lang="ts">
import type { OriginRow } from '$lib/types/gameData';
import { publicAssetUrl } from '$lib/utils';
import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';
	import { useMultiSelect } from '$lib/composables';

	type Props = {
		origins: OriginRow[];
		onEdit: (origin: OriginRow) => void;
		onDelete: (origin: OriginRow) => void;
		onToggleEnabled?: (origin: OriginRow, enabled: boolean) => void;
		onDeleteMultiple: (ids: string[]) => void;
	};

	let { origins, onEdit, onDelete, onToggleEnabled, onDeleteMultiple }: Props = $props();

	const selection = useMultiSelect();

	function getIconUrl(path: string | null | undefined, updatedAt?: string | number | null): string | null {
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function deleteSelected() {
		onDeleteMultiple(Array.from(selection.selectedIds));
		selection.deselectAll();
	}
</script>

<MultiSelectBar
	selectedCount={selection.selectedCount}
	totalCount={origins.length}
	onSelectAll={() => selection.selectAll(origins.map((o) => o.id))}
	onDeselectAll={selection.deselectAll}
	onDeleteSelected={deleteSelected}
/>

<div class="list-view">
	{#each origins as origin (origin.id)}
		<article class="origin-card" class:selected={selection.isSelected(origin.id)}>
			<header>
				<div class="checkbox-wrapper">
					<input
						type="checkbox"
						checked={selection.isSelected(origin.id)}
						onclick={(e) => { e.stopPropagation(); selection.toggle(origin.id); }}
						aria-label="Select {origin.name}"
					/>
				</div>
				<div class="header-content">
					<div class="origin-card__identity">
						{#if getIconUrl(origin.icon_png, origin.updated_at)}
							<img
								class="origin-card__icon-image"
								src={getIconUrl(origin.icon_png, origin.updated_at)}
								alt={`${origin.name} icon`}
							/>
						{:else if origin.icon_emoji}
							<span class="origin-card__icon">{origin.icon_emoji}</span>
						{/if}
						<div>
							<h2>{origin.name}</h2>
							<small>Position {origin.position}</small>
						</div>
					</div>
					<CardActionMenu
						onEdit={() => onEdit(origin)}
						onDelete={() => onDelete(origin)}
						onGenerate={null}
						onToggleEnabled={
							onToggleEnabled
								? () => onToggleEnabled(origin, !(origin.is_enabled ?? true))
								: null
						}
						toggleLabel={origin.is_enabled === false ? 'Enable' : 'Disable'}
					/>
				</div>
			</header>
			{#if origin.description}
				<p class="muted">{origin.description}</p>
			{/if}
			<div class="meta">
				{#if origin.color}
					<span class="tag">
						Color:
						<span class="swatch" style={`background:${origin.color}`}></span>
						{origin.color}
					</span>
				{/if}
			</div>
		</article>
	{:else}
		<div class="empty">No origins found</div>
	{/each}
</div>

<style>
	.list-view {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.5rem;
	}

	.origin-card {
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		transition: all 0.15s ease;
	}

	.origin-card.selected {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.3);
	}

	.origin-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #3b82f6;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
		flex: 1;
	}

	.origin-card__identity {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.origin-card__icon {
		font-size: 1.4rem;
	}

	.origin-card__icon-image {
		width: 24px;
		height: 24px;
		object-fit: contain;
		border-radius: 4px;
	}

	.origin-card h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.origin-card small {
		display: block;
		color: #94a3b8;
		font-size: 0.65rem;
	}

	.muted {
		color: #cbd5e1;
		margin: 0;
		font-size: 0.7rem;
		white-space: pre-line;
		line-height: 1.4;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.2rem;
	}

	.tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.2rem 0.4rem;
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 4px;
		font-size: 0.65rem;
		color: #cbd5e1;
	}

	.swatch {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1px solid rgba(148, 163, 184, 0.4);
	}

	.empty {
		grid-column: 1 / -1;
		padding: 1.5rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

</style>
