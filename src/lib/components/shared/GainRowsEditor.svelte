<script lang="ts">
	import type { GainRow } from '$lib/types/gameData';
	import GainRowEditor from './GainRowEditor.svelte';
	import { Button } from '$lib/components/ui';

	interface Props {
		gainRows?: GainRow[];
		maxIcons?: number;
		maxRows?: number;
		onchange?: (rows: GainRow[]) => void;
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

	const emptyRow = (): GainRow => ({ icon_ids: [], icon_groups: [[]] });

	let {
		gainRows = $bindable<GainRow[]>([emptyRow()]),
		maxIcons = 6,
		maxRows,
		onchange
	}: Props = $props();

	const canAddRow = $derived.by(() => (maxRows ? gainRows.length < maxRows : true));

	function updateRow(index: number, groups: string[][]) {
		const safeGroups = normalizeGroups(groups);
		const icons = flattenGroups(safeGroups);
		gainRows = gainRows.map((row, i) =>
			i === index ? { ...row, icon_ids: icons, icon_groups: safeGroups } : row
		);
		onchange?.(gainRows);
	}

	function addRow() {
		if (!canAddRow) return;
		gainRows = [...gainRows, emptyRow()];
		onchange?.(gainRows);
	}

	function removeRow(index: number) {
		if (gainRows.length <= 1) return;
		gainRows = gainRows.filter((_, i) => i !== index);
		onchange?.(gainRows);
	}
</script>

<div class="gain-rows">
	<div class="gain-rows__header">
		<h4>Gain Rows</h4>
		<Button variant="secondary" onclick={addRow} disabled={!canAddRow}>+ Add Row</Button>
	</div>

	<div class="gain-rows__list">
		{#each gainRows as row, index (index)}
			{@const iconGroups = normalizeGroups(row.icon_groups, row.icon_ids)}
			<div class="gain-rows__row">
				<div class="gain-rows__row-header">
					<span>Row {index + 1}</span>
					{#if gainRows.length > 1}
						<button type="button" class="gain-rows__remove" onclick={() => removeRow(index)}>
							Remove
						</button>
					{/if}
				</div>
				<GainRowEditor
					iconGroups={iconGroups}
					maxIcons={maxIcons}
					onchange={(groups) => updateRow(index, groups)}
					showHeader={false}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.gain-rows {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.gain-rows__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.gain-rows__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.gain-rows__list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.gain-rows__row {
		padding: 0.5rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
	}

	.gain-rows__row-header {
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

	.gain-rows__remove {
		border: none;
		background: transparent;
		color: #fca5a5;
		font-size: 0.7rem;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.gain-rows__remove:hover {
		color: #fecaca;
	}
</style>
