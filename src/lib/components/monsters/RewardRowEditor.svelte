<script lang="ts">
	import type { RewardRow, RewardRowType } from '$lib/types/gameData';
	import { REWARD_ROW_CONFIG } from '$lib/types/gameData';
	import { getIconPoolUrl } from '$lib/utils/iconPool';
	import { IconPicker } from '$lib/components/shared';
	import { Select, Button } from '$lib/components/ui';

	interface Props {
		row: RewardRow;
		onchange?: (row: RewardRow) => void;
		onremove?: () => void;
	}

	let { row = $bindable(), onchange, onremove }: Props = $props();

	let showIconPicker = $state(false);

	const typeOptions = [
		{ value: 'all_players', label: 'All players gain' },
		{ value: 'all_in_combat', label: 'All in combat gain' },
		{ value: 'all_in_combat_pick_one', label: 'All in combat pick 1' },
		{ value: 'all_winners', label: 'All winners gain' },
		{ value: 'all_losers', label: 'All losers gain' },
		{ value: 'one_winner', label: 'One winner gains' },
		{ value: 'tournament', label: 'Tournament' }
	];

	const config = $derived(REWARD_ROW_CONFIG[row.type]);

	function handleTypeChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		row.type = target.value as RewardRowType;
		onchange?.(row);
	}

	function handleIconSelect(ids: string[]) {
		row.icon_ids = ids;
		onchange?.(row);
	}

	function removeIcon(id: string) {
		row.icon_ids = row.icon_ids.filter((i) => i !== id);
		onchange?.(row);
	}
</script>

<div class="reward-row-editor" style="--row-color: {config.color}; --row-bg: {config.bgColor}">
	<div class="reward-row-editor__header">
		<Select
			value={row.type}
			options={typeOptions}
			onchange={handleTypeChange}
		/>
		<Button variant="ghost" onclick={onremove} class="reward-row-editor__remove">
			✕
		</Button>
	</div>

	<div class="reward-row-editor__icons">
		{#if row.icon_ids.length === 0}
			<button
				type="button"
				class="reward-row-editor__add-icon"
				onclick={() => (showIconPicker = true)}
			>
				+ Add Icons
			</button>
		{:else}
			<div class="reward-row-editor__icon-list">
				{#each row.icon_ids as iconId, index (index)}
					{@const url = getIconPoolUrl(iconId)}
					<div class="reward-row-editor__icon">
						{#if url}
							<img src={url} alt="Reward icon" loading="lazy" decoding="async" />
						{:else}
							<span class="reward-row-editor__icon-placeholder">?</span>
						{/if}
						<button
							type="button"
							class="reward-row-editor__icon-remove"
							onclick={() => removeIcon(iconId)}
						>
							✕
						</button>
					</div>
				{/each}
				{#if row.icon_ids.length < 5}
					<button
						type="button"
						class="reward-row-editor__add-more"
						onclick={() => (showIconPicker = true)}
					>
						+
					</button>
				{/if}
			</div>
		{/if}
	</div>

	{#if showIconPicker}
		<div class="reward-row-editor__picker">
			<IconPicker
				bind:selected={row.icon_ids}
				onselect={handleIconSelect}
				multiple={true}
				maxSelection={5}
			/>
			<Button
				variant="secondary"
				onclick={() => (showIconPicker = false)}
			>
				Done
			</Button>
		</div>
	{/if}
</div>

<style>
	.reward-row-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 8px;
		background: var(--row-bg);
		border: 1px solid color-mix(in srgb, var(--row-color) 30%, transparent);
	}

	.reward-row-editor__header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.reward-row-editor__header :global(select) {
		flex: 1;
	}

	:global(.reward-row-editor__remove) {
		padding: 0.25rem 0.5rem;
		min-width: auto;
	}

	.reward-row-editor__icons {
		min-height: 48px;
	}

	.reward-row-editor__add-icon {
		width: 100%;
		padding: 0.75rem;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.reward-row-editor__add-icon:hover {
		border-color: var(--row-color);
		color: var(--row-color);
	}

	.reward-row-editor__icon-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.reward-row-editor__icon {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.5);
		overflow: hidden;
	}

		.reward-row-editor__icon img {
			width: 100%;
			height: 100%;
			object-fit: contain;
			filter:
				drop-shadow(1px 0 0 #2b1a12)
				drop-shadow(-1px 0 0 #2b1a12)
				drop-shadow(0 1px 0 #2b1a12)
				drop-shadow(0 -1px 0 #2b1a12)
				drop-shadow(1px 1px 0 #2b1a12)
				drop-shadow(-1px 1px 0 #2b1a12)
				drop-shadow(1px -1px 0 #2b1a12)
				drop-shadow(-1px -1px 0 #2b1a12)
				drop-shadow(2px 0 0 #2b1a12)
				drop-shadow(-2px 0 0 #2b1a12)
				drop-shadow(0 2px 0 #2b1a12)
				drop-shadow(0 -2px 0 #2b1a12);
		}

	.reward-row-editor__icon-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #64748b;
	}

	.reward-row-editor__icon-remove {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		background: #ef4444;
		color: white;
		font-size: 0.6rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.reward-row-editor__icon:hover .reward-row-editor__icon-remove {
		opacity: 1;
	}

	.reward-row-editor__add-more {
		width: 40px;
		height: 40px;
		border-radius: 6px;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}

	.reward-row-editor__add-more:hover {
		border-color: var(--row-color);
		color: var(--row-color);
	}

	.reward-row-editor__picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.2);
	}
</style>
