<script lang="ts">
	import type { OriginRow } from '$lib/types/gameData';
	import { publicAssetUrl } from '$lib/utils';

	interface Props {
		origins: OriginRow[];
		selectedIds: string[];
		onToggle: (originId: string) => void;
	}

	let { origins, selectedIds, onToggle }: Props = $props();

	const selectedCount = $derived(selectedIds.length);

	function selectAll() {
		for (const origin of origins) {
			if (!selectedIds.includes(origin.id)) {
				onToggle(origin.id);
			}
		}
	}

	function deselectAll() {
		for (const id of [...selectedIds]) {
			onToggle(id);
		}
	}

	function getIconUrl(origin: OriginRow): string | null {
		return publicAssetUrl(origin.icon_png, { updatedAt: origin.updated_at ?? undefined });
	}
</script>

<div class="origin-toggle-chips">
	<div class="origin-toggle-chips__header">
		<span class="origin-toggle-chips__count">{selectedCount} of {origins.length} selected</span>
		<div class="origin-toggle-chips__actions">
			<button type="button" class="text-btn" onclick={selectAll}>Select All</button>
			<button type="button" class="text-btn" onclick={deselectAll}>Deselect All</button>
		</div>
	</div>
	<div class="origin-toggle-chips__grid">
		{#each origins as origin (origin.id)}
			{@const active = selectedIds.includes(origin.id)}
			<button
				type="button"
				class="origin-chip"
				class:active
				style="--chip-color: {origin.color}"
				onclick={() => onToggle(origin.id)}
			>
				{#if getIconUrl(origin)}
					<img src={getIconUrl(origin)} alt="" class="origin-chip__icon" />
				{:else if origin.icon_emoji}
					<span class="origin-chip__emoji">{origin.icon_emoji}</span>
				{/if}
				<span class="origin-chip__name">{origin.name}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.origin-toggle-chips {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.origin-toggle-chips__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.origin-toggle-chips__count {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.origin-toggle-chips__actions {
		display: flex;
		gap: 0.5rem;
	}

	.text-btn {
		background: none;
		border: none;
		color: #60a5fa;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0.15rem 0.3rem;
		border-radius: 4px;
	}

	.text-btn:hover {
		color: #93c5fd;
		background: rgba(59, 130, 246, 0.1);
	}

	.origin-toggle-chips__grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.origin-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.6rem;
		background: transparent;
		border: 1px dashed var(--chip-color, #64748b);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s ease;
		color: #94a3b8;
		font-size: 0.8rem;
		opacity: 0.6;
	}

	.origin-chip:hover {
		opacity: 0.85;
		background: rgba(255, 255, 255, 0.03);
	}

	.origin-chip.active {
		background: color-mix(in srgb, var(--chip-color) 20%, transparent);
		border-style: solid;
		opacity: 1;
		color: #e2e8f0;
	}

	.origin-chip__icon {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}

	.origin-chip__emoji {
		font-size: 0.9rem;
	}

	.origin-chip__name {
		font-weight: 500;
	}
</style>
