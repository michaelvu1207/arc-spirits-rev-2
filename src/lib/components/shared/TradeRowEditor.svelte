<script lang="ts">
	import { onMount } from 'svelte';
	import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
	import { IconPicker } from '$lib/components/shared';
	import { Button } from '$lib/components/ui';

	interface Props {
		leftGroups?: string[][];
		rightGroups?: string[][];
		maxIcons?: number;
		title?: string;
		showHeader?: boolean;
		onchange?: (leftGroups: string[][], rightGroups: string[][]) => void;
	}

	let {
		leftGroups = $bindable<string[][]>([[]]),
		rightGroups = $bindable<string[][]>([[]]),
		maxIcons = 6,
		title = 'Trade Row',
		showHeader = true,
		onchange
	}: Props = $props();

	let iconPoolLoaded = $state(false);
	let leftPickerIndex = $state<number | null>(null);
	let rightPickerIndex = $state<number | null>(null);

	onMount(async () => {
		await loadIconPool();
		iconPoolLoaded = true;
	});

	function updateLeftGroup(index: number, ids: string[]) {
		leftGroups = leftGroups.map((group, i) => (i === index ? ids : group));
		onchange?.(leftGroups, rightGroups);
	}

	function updateRightGroup(index: number, ids: string[]) {
		rightGroups = rightGroups.map((group, i) => (i === index ? ids : group));
		onchange?.(leftGroups, rightGroups);
	}

	function removeLeftIcon(groupIndex: number, iconIndex: number) {
		leftGroups = leftGroups.map((group, i) =>
			i === groupIndex ? group.filter((_, idx) => idx !== iconIndex) : group
		);
		onchange?.(leftGroups, rightGroups);
	}

	function removeRightIcon(groupIndex: number, iconIndex: number) {
		rightGroups = rightGroups.map((group, i) =>
			i === groupIndex ? group.filter((_, idx) => idx !== iconIndex) : group
		);
		onchange?.(leftGroups, rightGroups);
	}

	function addLeftGroup() {
		leftGroups = [...leftGroups, []];
		onchange?.(leftGroups, rightGroups);
	}

	function addRightGroup() {
		rightGroups = [...rightGroups, []];
		onchange?.(leftGroups, rightGroups);
	}

	function removeLeftGroup(index: number) {
		if (leftGroups.length <= 1) return;
		leftGroups = leftGroups.filter((_, i) => i !== index);
		onchange?.(leftGroups, rightGroups);
	}

	function removeRightGroup(index: number) {
		if (rightGroups.length <= 1) return;
		rightGroups = rightGroups.filter((_, i) => i !== index);
		onchange?.(leftGroups, rightGroups);
	}
</script>

<div class="trade-editor">
	{#if showHeader}
		<div class="trade-editor__header">
			<h4>{title}</h4>
		</div>
	{/if}

	{#if !iconPoolLoaded}
		<div class="trade-editor__loading">Loading icons...</div>
	{:else}
		<div class="trade-editor__row">
			<div class="trade-editor__side">
				<div class="trade-editor__label">Left Side</div>
				<div class="trade-editor__groups">
					{#each leftGroups as group, groupIndex (`left-${groupIndex}`)}
						<div class="trade-editor__group">
							{#if group.length === 0}
								<button
									type="button"
									class="trade-editor__add"
									onclick={() => (leftPickerIndex = groupIndex)}
								>
									+ Add Icons
								</button>
							{:else}
								<div class="trade-editor__icons">
									{#each group as iconId, iconIndex (`${iconId}-${iconIndex}`)}
										{@const url = getIconPoolUrl(iconId)}
										<div class="trade-editor__icon">
											{#if url}
												<img src={url} alt="Left icon" />
											{:else}
												<span class="trade-editor__icon-placeholder">?</span>
											{/if}
											<button
												type="button"
												class="trade-editor__remove"
												onclick={() => removeLeftIcon(groupIndex, iconIndex)}
											>
												X
											</button>
										</div>
									{/each}
									{#if group.length < maxIcons}
										<button
											type="button"
											class="trade-editor__add-more"
											onclick={() => (leftPickerIndex = groupIndex)}
										>
											+
										</button>
									{/if}
								</div>
							{/if}
							{#if leftGroups.length > 1}
								<button
									type="button"
									class="trade-editor__remove-group"
									onclick={() => removeLeftGroup(groupIndex)}
								>
									Remove Group
								</button>
							{/if}
						</div>
						{#if groupIndex < leftGroups.length - 1}
							<div class="trade-editor__or">/</div>
						{/if}
					{/each}
				</div>
				<button type="button" class="trade-editor__add-group" onclick={addLeftGroup}>
					+ OR Group
				</button>
			</div>

			<div class="trade-editor__arrow">-&gt;</div>

			<div class="trade-editor__side">
				<div class="trade-editor__label">Right Side</div>
				<div class="trade-editor__groups">
					{#each rightGroups as group, groupIndex (`right-${groupIndex}`)}
						<div class="trade-editor__group">
							{#if group.length === 0}
								<button
									type="button"
									class="trade-editor__add"
									onclick={() => (rightPickerIndex = groupIndex)}
								>
									+ Add Icons
								</button>
							{:else}
								<div class="trade-editor__icons">
									{#each group as iconId, iconIndex (`${iconId}-${iconIndex}`)}
										{@const url = getIconPoolUrl(iconId)}
										<div class="trade-editor__icon">
											{#if url}
												<img src={url} alt="Right icon" />
											{:else}
												<span class="trade-editor__icon-placeholder">?</span>
											{/if}
											<button
												type="button"
												class="trade-editor__remove"
												onclick={() => removeRightIcon(groupIndex, iconIndex)}
											>
												X
											</button>
										</div>
									{/each}
									{#if group.length < maxIcons}
										<button
											type="button"
											class="trade-editor__add-more"
											onclick={() => (rightPickerIndex = groupIndex)}
										>
											+
										</button>
									{/if}
								</div>
							{/if}
							{#if rightGroups.length > 1}
								<button
									type="button"
									class="trade-editor__remove-group"
									onclick={() => removeRightGroup(groupIndex)}
								>
									Remove Group
								</button>
							{/if}
						</div>
						{#if groupIndex < rightGroups.length - 1}
							<div class="trade-editor__or">/</div>
						{/if}
					{/each}
				</div>
				<button type="button" class="trade-editor__add-group" onclick={addRightGroup}>
					+ OR Group
				</button>
			</div>
		</div>
	{/if}

	{#if leftPickerIndex !== null}
		{@const activeLeftIndex = leftPickerIndex ?? 0}
		<div class="trade-editor__picker">
			<IconPicker
				selected={leftGroups[activeLeftIndex] ?? []}
				onselect={(ids) => updateLeftGroup(activeLeftIndex, ids)}
				multiple={true}
				maxSelection={maxIcons}
				allowDuplicates={true}
			/>
			<Button variant="secondary" onclick={() => (leftPickerIndex = null)}>Done</Button>
		</div>
	{/if}

	{#if rightPickerIndex !== null}
		{@const activeRightIndex = rightPickerIndex ?? 0}
		<div class="trade-editor__picker">
			<IconPicker
				selected={rightGroups[activeRightIndex] ?? []}
				onselect={(ids) => updateRightGroup(activeRightIndex, ids)}
				multiple={true}
				maxSelection={maxIcons}
				allowDuplicates={true}
			/>
			<Button variant="secondary" onclick={() => (rightPickerIndex = null)}>Done</Button>
		</div>
	{/if}
</div>

<style>
	.trade-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.trade-editor__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.trade-editor__loading {
		padding: 1rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.trade-editor__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		gap: 0.75rem;
		align-items: center;
	}

	.trade-editor__side {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 120px;
	}

	.trade-editor__label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #94a3b8;
	}

	.trade-editor__arrow {
		font-size: 1.25rem;
		font-weight: 700;
		color: #e2e8f0;
		padding: 0 0.25rem;
	}

	.trade-editor__add {
		width: 100%;
		padding: 0.75rem;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 0.85rem;
		transition: all 0.15s ease;
	}

	.trade-editor__add:hover {
		border-color: #f8fafc;
		color: #f8fafc;
	}

	.trade-editor__groups {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.trade-editor__group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: flex-start;
	}

	.trade-editor__or {
		font-size: 1rem;
		font-weight: 700;
		color: rgba(148, 163, 184, 0.7);
		padding: 0 0.2rem;
	}

	.trade-editor__add-group {
		align-self: flex-start;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		background: transparent;
		color: #94a3b8;
		padding: 0.35rem 0.6rem;
		border-radius: 6px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.trade-editor__add-group:hover {
		color: #f8fafc;
		border-color: rgba(248, 250, 252, 0.6);
	}

	.trade-editor__icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.trade-editor__icon {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.5);
		overflow: hidden;
	}

		.trade-editor__icon img {
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

	.trade-editor__icon-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #64748b;
		font-size: 0.85rem;
	}

	.trade-editor__remove {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		background: #ef4444;
		color: #fff;
		font-size: 0.6rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.trade-editor__icon:hover .trade-editor__remove {
		opacity: 1;
	}

	.trade-editor__remove-group {
		border: none;
		background: transparent;
		color: #fca5a5;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
	}

	.trade-editor__remove-group:hover {
		color: #fecaca;
	}

	.trade-editor__add-more {
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
		transition: all 0.15s ease;
	}

	.trade-editor__add-more:hover {
		border-color: #f8fafc;
		color: #f8fafc;
	}

	.trade-editor__picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		background: rgba(2, 6, 23, 0.6);
	}
</style>
