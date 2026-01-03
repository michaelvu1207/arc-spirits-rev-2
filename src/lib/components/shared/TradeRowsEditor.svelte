<script lang="ts">
	import type { TradeRow } from '$lib/types/gameData';
	import TradeRowEditor from './TradeRowEditor.svelte';
	import { Button } from '$lib/components/ui';

	interface Props {
		tradeRows?: TradeRow[];
		maxIcons?: number;
		maxRows?: number;
		onchange?: (rows: TradeRow[]) => void;
	}

	function normalizeGroups(groups: string[][] | null | undefined, fallback?: string[] | null): string[][] {
		if (Array.isArray(groups) && groups.length > 0) {
			return groups.map((group) => (Array.isArray(group) ? group : []));
		}
		if (Array.isArray(fallback) && fallback.length > 0) {
			return [fallback];
		}
		return [[]];
	}

	function flattenGroups(groups: string[][]): string[] {
		return groups.flatMap((group) => group.filter((id): id is string => typeof id === 'string'));
	}

	const emptyRow = (): TradeRow => ({
		left_icon_ids: [],
		right_icon_ids: [],
		left_icon_groups: [[]],
		right_icon_groups: [[]]
	});

	let {
		tradeRows = $bindable<TradeRow[]>([emptyRow()]),
		maxIcons = 6,
		maxRows,
		onchange
	}: Props = $props();

	const canAddRow = $derived.by(() => (maxRows ? tradeRows.length < maxRows : true));

	function updateRow(index: number, leftGroups: string[][], rightGroups: string[][]) {
		const safeLeftGroups = normalizeGroups(leftGroups);
		const safeRightGroups = normalizeGroups(rightGroups);
		const left = flattenGroups(safeLeftGroups);
		const right = flattenGroups(safeRightGroups);
		tradeRows = tradeRows.map((row, i) =>
			i === index
				? {
						...row,
						left_icon_ids: left,
						right_icon_ids: right,
						left_icon_groups: safeLeftGroups,
						right_icon_groups: safeRightGroups
					}
				: row
		);
		onchange?.(tradeRows);
	}

	function addRow() {
		if (!canAddRow) return;
		tradeRows = [...tradeRows, emptyRow()];
		onchange?.(tradeRows);
	}

	function removeRow(index: number) {
		if (tradeRows.length <= 1) return;
		tradeRows = tradeRows.filter((_, i) => i !== index);
		onchange?.(tradeRows);
	}
</script>

<div class="trade-rows">
	<div class="trade-rows__header">
		<h4>Trade Rows</h4>
		<Button variant="secondary" onclick={addRow} disabled={!canAddRow}>+ Add Row</Button>
	</div>

	<div class="trade-rows__list">
		{#each tradeRows as row, index (index)}
			{@const leftGroups = normalizeGroups(row.left_icon_groups, row.left_icon_ids)}
			{@const rightGroups = normalizeGroups(row.right_icon_groups, row.right_icon_ids)}
			<div class="trade-rows__row">
				<div class="trade-rows__row-header">
					<span>Row {index + 1}</span>
					{#if tradeRows.length > 1}
						<button type="button" class="trade-rows__remove" onclick={() => removeRow(index)}>
							Remove
						</button>
					{/if}
				</div>
				<TradeRowEditor
					leftGroups={leftGroups}
					rightGroups={rightGroups}
					maxIcons={maxIcons}
					onchange={(left, right) => updateRow(index, left, right)}
					showHeader={false}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.trade-rows {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trade-rows__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.trade-rows__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.trade-rows__list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trade-rows__row {
		padding: 0.5rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
	}

	.trade-rows__row-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
		margin-bottom: 0.5rem;
	}

	.trade-rows__remove {
		border: none;
		background: transparent;
		color: #fca5a5;
		font-size: 0.7rem;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.trade-rows__remove:hover {
		color: #fecaca;
	}
</style>
