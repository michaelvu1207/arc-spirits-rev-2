<script lang="ts">
	import type { CostDuplicates } from '$lib/types/gameData';
	import { NumberControl } from '$lib/components/shared';
	import { DEFAULT_COST_DUPLICATES } from '$lib/features/editions/editions';

	interface Props {
		costDuplicates: CostDuplicates;
	}

	let { costDuplicates = $bindable() }: Props = $props();

	const ALL_COSTS = ['1', '3', '4', '5', '7', '9', '11', '13', '15', '17'];

	let showIndividual = $state(false);

	// Group costs by their duplicate count for the grouped view
	const groupedCosts = $derived.by(() => {
		const groups: Record<number, string[]> = {};
		for (const cost of ALL_COSTS) {
			const count = costDuplicates[cost] ?? 1;
			if (!groups[count]) groups[count] = [];
			groups[count].push(cost);
		}
		return Object.entries(groups)
			.map(([count, costs]) => ({
				count: Number(count),
				costs,
				label: costs.length === 1 ? `Cost ${costs[0]}` : `Cost ${costs.join(', ')}`
			}))
			.sort((a, b) => b.count - a.count);
	});

	function resetToDefaults() {
		costDuplicates = { ...DEFAULT_COST_DUPLICATES };
	}

	function updateGroupCount(costs: string[], newCount: number) {
		const updated = { ...costDuplicates };
		for (const cost of costs) {
			updated[cost] = Math.max(0, Math.min(10, newCount));
		}
		costDuplicates = updated;
	}
</script>

<div class="cost-duplicates-editor">
	<div class="cost-duplicates-editor__header">
		<label class="toggle-label">
			<input type="checkbox" bind:checked={showIndividual} />
			<span>Show all costs individually</span>
		</label>
		<button type="button" class="reset-btn" onclick={resetToDefaults}>Reset to Defaults</button>
	</div>

	{#if showIndividual}
		<div class="cost-grid">
			{#each ALL_COSTS as cost}
				<NumberControl
					label="Cost {cost}"
					bind:value={costDuplicates[cost]}
					min={0}
					max={10}
				/>
			{/each}
		</div>
	{:else}
		<div class="cost-groups">
			{#each groupedCosts as group (group.costs.join(','))}
				<div class="cost-group">
					<div class="cost-group__label">
						{group.label}
					</div>
					<div class="cost-group__stepper">
						<button type="button" class="stepper-btn" disabled={group.count <= 0} onclick={() => updateGroupCount(group.costs, group.count - 1)}>−</button>
						<span class="stepper-value">{group.count}x</span>
						<button type="button" class="stepper-btn" disabled={group.count >= 10} onclick={() => updateGroupCount(group.costs, group.count + 1)}>+</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.cost-duplicates-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.cost-duplicates-editor__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
		cursor: pointer;
	}

	.toggle-label input {
		margin: 0;
	}

	.reset-btn {
		background: none;
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #60a5fa;
		font-size: 0.7rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.reset-btn:hover {
		background: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.3);
	}

	.cost-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.cost-groups {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.cost-group {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.4rem 0.6rem;
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 6px;
	}

	.cost-group__label {
		font-size: 0.8rem;
		color: #cbd5e1;
		font-weight: 500;
		min-width: 0;
	}

	.cost-group__stepper {
		display: flex;
		align-items: center;
		gap: 0;
		flex-shrink: 0;
	}

	.stepper-btn {
		padding: 0.3rem 0.6rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #cbd5f5;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 600;
		transition: all 0.15s ease;
	}

	.stepper-btn:first-child {
		border-radius: 6px 0 0 6px;
		border-right: none;
	}

	.stepper-btn:last-child {
		border-radius: 0 6px 6px 0;
		border-left: none;
	}

	.stepper-btn:hover:not(:disabled) {
		background: rgba(59, 130, 246, 0.2);
	}

	.stepper-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.stepper-value {
		padding: 0.3rem 0.5rem;
		background: rgba(30, 41, 59, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #cbd5f5;
		font-size: 0.85rem;
		font-weight: 600;
		min-width: 36px;
		text-align: center;
	}
</style>
