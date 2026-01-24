<script lang="ts">
	import { onMount } from 'svelte';
	import type { RewardRow, RewardRowType } from '$lib/types/gameData';
	import { loadIconPool } from '$lib/utils/iconPool';
	import { Button } from '$lib/components/ui';
	import RewardRowEditor from './RewardRowEditor.svelte';

	interface Props {
		rewardRows?: RewardRow[];
		defaultType?: RewardRowType;
		onchange?: (rows: RewardRow[]) => void;
	}

	let { rewardRows = $bindable<RewardRow[]>([]), defaultType = 'all_in_combat', onchange }: Props = $props();

	let iconPoolLoaded = $state(false);

	onMount(async () => {
		// Pre-load the icon pool
		await loadIconPool();
		iconPoolLoaded = true;
	});

	function addRow() {
		const newRow: RewardRow = {
			type: defaultType,
			icon_ids: []
		};
		rewardRows = [...rewardRows, newRow];
		onchange?.(rewardRows);
	}

	function updateRow(index: number, row: RewardRow) {
		rewardRows = rewardRows.map((r, i) => (i === index ? row : r));
		onchange?.(rewardRows);
	}

	function removeRow(index: number) {
		rewardRows = rewardRows.filter((_, i) => i !== index);
		onchange?.(rewardRows);
	}

	function moveRow(index: number, direction: 'up' | 'down') {
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= rewardRows.length) return;

		const newRows = [...rewardRows];
		[newRows[index], newRows[newIndex]] = [newRows[newIndex], newRows[index]];
		rewardRows = newRows;
		onchange?.(rewardRows);
	}
</script>

<div class="reward-rows-editor">
	<div class="reward-rows-editor__header">
		<h4>Reward Rows</h4>
		<Button variant="secondary" onclick={addRow}>+ Add Row</Button>
	</div>

	{#if !iconPoolLoaded}
		<div class="reward-rows-editor__loading">Loading icons...</div>
	{:else if rewardRows.length === 0}
		<div class="reward-rows-editor__empty">
			<p>No reward rows. Click "Add Row" to create one.</p>
		</div>
	{:else}
		<div class="reward-rows-editor__list">
			{#each rewardRows as row, index (index)}
				<div class="reward-rows-editor__item">
					<div class="reward-rows-editor__controls">
						<span class="reward-rows-editor__index">#{index + 1}</span>
						<button
							type="button"
							class="reward-rows-editor__move"
							disabled={index === 0}
							onclick={() => moveRow(index, 'up')}
							title="Move up"
						>
							↑
						</button>
						<button
							type="button"
							class="reward-rows-editor__move"
							disabled={index === rewardRows.length - 1}
							onclick={() => moveRow(index, 'down')}
							title="Move down"
						>
							↓
						</button>
					</div>
					<div class="reward-rows-editor__editor">
						<RewardRowEditor
							bind:row={rewardRows[index]}
							onchange={(r) => updateRow(index, r)}
							onremove={() => removeRow(index)}
						/>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.reward-rows-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.reward-rows-editor__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.reward-rows-editor__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.reward-rows-editor__loading {
		padding: 1rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.reward-rows-editor__empty {
		padding: 1.5rem;
		text-align: center;
		border: 2px dashed rgba(148, 163, 184, 0.2);
		border-radius: 8px;
	}

	.reward-rows-editor__empty p {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.reward-rows-editor__list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.reward-rows-editor__item {
		display: flex;
		gap: 0.5rem;
	}

	.reward-rows-editor__controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		padding-top: 0.5rem;
	}

	.reward-rows-editor__index {
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		margin-bottom: 0.25rem;
	}

	.reward-rows-editor__move {
		width: 20px;
		height: 20px;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 4px;
		background: rgba(30, 41, 59, 0.5);
		color: #94a3b8;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.reward-rows-editor__move:hover:not(:disabled) {
		background: rgba(51, 65, 85, 0.6);
		border-color: rgba(148, 163, 184, 0.5);
		color: #e2e8f0;
	}

	.reward-rows-editor__move:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.reward-rows-editor__editor {
		flex: 1;
	}
</style>
