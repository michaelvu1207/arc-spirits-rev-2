<script lang="ts">
	import { onMount } from 'svelte';
	import type { GameLocationRewardRow } from '$lib/types/gameData';
	import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
	import { IconPicker } from '$lib/components/shared';
	import { Button } from '$lib/components/ui';

	interface Props {
		rewardRows?: GameLocationRewardRow[];
		onchange?: (rows: GameLocationRewardRow[]) => void;
		maxIconsPerRow?: number;
	}

	let { rewardRows = $bindable<GameLocationRewardRow[]>([]), onchange, maxIconsPerRow = 5 }: Props = $props();

	let iconPoolLoaded = $state(false);
	let pickingRowIndex = $state<number | null>(null);

	onMount(async () => {
		await loadIconPool();
		iconPoolLoaded = true;
	});

	function addRow() {
		rewardRows = [...rewardRows, { icon_ids: [] }];
		onchange?.(rewardRows);
	}

	function updateRow(index: number, row: GameLocationRewardRow) {
		rewardRows = rewardRows.map((r, i) => (i === index ? row : r));
		onchange?.(rewardRows);
	}

	function removeRow(index: number) {
		rewardRows = rewardRows.filter((_, i) => i !== index);
		onchange?.(rewardRows);
		if (pickingRowIndex === index) pickingRowIndex = null;
	}

	function moveRow(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= rewardRows.length) return;

		const newRows = [...rewardRows];
		[newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
		rewardRows = newRows;
		onchange?.(rewardRows);

		if (pickingRowIndex === index) pickingRowIndex = newIndex;
		else if (pickingRowIndex === newIndex) pickingRowIndex = index;
	}

	function setRowIcons(index: number, iconIds: string[]) {
		updateRow(index, { ...rewardRows[index], icon_ids: iconIds });
	}

	function removeIcon(index: number, iconId: string) {
		const row = rewardRows[index];
		setRowIcons(index, row.icon_ids.filter((id) => id !== iconId));
	}
</script>

<div class="location-reward-rows">
	<div class="location-reward-rows__header">
		<h4>Rewards</h4>
		<Button variant="secondary" onclick={addRow}>+ Add Reward Row</Button>
	</div>

	{#if !iconPoolLoaded}
		<div class="location-reward-rows__loading">Loading icons…</div>
	{:else if rewardRows.length === 0}
		<div class="location-reward-rows__empty">
			<p>No reward rows yet.</p>
		</div>
	{:else}
		<div class="location-reward-rows__list">
			{#each rewardRows as row, index (index)}
				<div class="location-reward-rows__item">
					<div class="location-reward-rows__controls">
						<span class="location-reward-rows__label">Reward row {index + 1}</span>
						<div class="location-reward-rows__buttons">
							<button
								type="button"
								class="location-reward-rows__move"
								disabled={index === 0}
								onclick={() => moveRow(index, 'up')}
								title="Move up"
							>
								↑
							</button>
							<button
								type="button"
								class="location-reward-rows__move"
								disabled={index === rewardRows.length - 1}
								onclick={() => moveRow(index, 'down')}
								title="Move down"
							>
								↓
							</button>
							<Button variant="ghost" onclick={() => removeRow(index)} class="location-reward-rows__remove">
								✕
							</Button>
						</div>
					</div>

					<div class="location-reward-rows__icons">
						{#if row.icon_ids.length === 0}
							<button
								type="button"
								class="location-reward-rows__add-icon"
								onclick={() => (pickingRowIndex = index)}
							>
								+ Add Icons
							</button>
						{:else}
							<div class="location-reward-rows__icon-list">
								{#each row.icon_ids as iconId, iconIndex (iconIndex)}
									{@const url = getIconPoolUrl(iconId)}
									<div class="location-reward-rows__icon">
										{#if url}
											<img src={url} alt="Reward icon" />
										{:else}
											<span class="location-reward-rows__icon-placeholder">?</span>
										{/if}
										<button
											type="button"
											class="location-reward-rows__icon-remove"
											onclick={() => removeIcon(index, iconId)}
										>
											✕
										</button>
									</div>
								{/each}
								{#if row.icon_ids.length < maxIconsPerRow}
									<button
										type="button"
										class="location-reward-rows__add-more"
										onclick={() => (pickingRowIndex = index)}
									>
										+
									</button>
								{/if}
							</div>
						{/if}
					</div>

					{#if pickingRowIndex === index}
						<div class="location-reward-rows__picker">
							<IconPicker
								selected={row.icon_ids}
								onselect={(ids) => setRowIcons(index, ids)}
								multiple={true}
								maxSelection={maxIconsPerRow}
								allowDuplicates={false}
							/>
							<Button variant="secondary" onclick={() => (pickingRowIndex = null)}>Done</Button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.location-reward-rows {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.location-reward-rows__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.location-reward-rows__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.location-reward-rows__loading {
		padding: 1rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.location-reward-rows__empty {
		padding: 1.25rem;
		border: 2px dashed rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		text-align: center;
	}

	.location-reward-rows__empty p {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.location-reward-rows__list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.location-reward-rows__item {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.75rem;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.location-reward-rows__controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.location-reward-rows__label {
		font-size: 0.8rem;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.location-reward-rows__buttons {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.location-reward-rows__move {
		width: 24px;
		height: 24px;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		background: rgba(30, 41, 59, 0.5);
		color: #94a3b8;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s;
		display: grid;
		place-items: center;
	}

	.location-reward-rows__move:hover:not(:disabled) {
		background: rgba(51, 65, 85, 0.6);
		border-color: rgba(148, 163, 184, 0.5);
		color: #e2e8f0;
	}

	.location-reward-rows__move:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	:global(.location-reward-rows__remove) {
		padding: 0.25rem 0.5rem;
		min-width: auto;
	}

	.location-reward-rows__icons {
		min-height: 48px;
	}

	.location-reward-rows__add-icon {
		width: 100%;
		padding: 0.75rem;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.location-reward-rows__add-icon:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
	}

	.location-reward-rows__icon-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.location-reward-rows__icon {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.5);
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.location-reward-rows__icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.location-reward-rows__icon-placeholder {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: #64748b;
	}

	.location-reward-rows__icon-remove {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		background: rgba(248, 113, 113, 0.9);
		color: white;
		font-size: 0.6rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.location-reward-rows__icon:hover .location-reward-rows__icon-remove {
		opacity: 1;
	}

	.location-reward-rows__add-more {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 1.25rem;
		display: grid;
		place-items: center;
		transition: all 0.15s;
	}

	.location-reward-rows__add-more:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
	}

	.location-reward-rows__picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}
</style>

