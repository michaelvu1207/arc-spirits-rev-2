<script lang="ts">
	import { onMount } from 'svelte';
	import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
	import { IconPicker } from '$lib/components/shared';
	import { Button } from '$lib/components/ui';

	interface Props {
		iconGroups?: string[][];
		maxIcons?: number;
		title?: string;
		showHeader?: boolean;
		onchange?: (groups: string[][]) => void;
	}

	let {
		iconGroups = $bindable<string[][]>([[]]),
		maxIcons = 6,
		title = 'Gain Row',
		showHeader = true,
		onchange
	}: Props = $props();

	let iconPoolLoaded = $state(false);
	let pickerIndex = $state<number | null>(null);

	onMount(async () => {
		await loadIconPool();
		iconPoolLoaded = true;
	});

	function updateGroup(index: number, ids: string[]) {
		iconGroups = iconGroups.map((group, i) => (i === index ? ids : group));
		onchange?.(iconGroups);
	}

	function removeIcon(groupIndex: number, iconIndex: number) {
		iconGroups = iconGroups.map((group, i) =>
			i === groupIndex ? group.filter((_, idx) => idx !== iconIndex) : group
		);
		onchange?.(iconGroups);
	}

	function addGroup() {
		iconGroups = [...iconGroups, []];
		onchange?.(iconGroups);
	}

	function removeGroup(index: number) {
		if (iconGroups.length <= 1) return;
		iconGroups = iconGroups.filter((_, i) => i !== index);
		onchange?.(iconGroups);
	}
</script>

<div class="gain-editor">
	{#if showHeader}
		<div class="gain-editor__header">
			<h4>{title}</h4>
		</div>
	{/if}

	{#if !iconPoolLoaded}
		<div class="gain-editor__loading">Loading icons...</div>
	{:else}
		<div class="gain-editor__row">
			<div class="gain-editor__label">Gain Icons</div>
			<div class="gain-editor__groups">
				{#each iconGroups as group, groupIndex (`gain-${groupIndex}`)}
					<div class="gain-editor__group">
						{#if group.length === 0}
							<button
								type="button"
								class="gain-editor__add"
								onclick={() => (pickerIndex = groupIndex)}
							>
								+ Add Icons
							</button>
						{:else}
							<div class="gain-editor__icons">
								{#each group as iconId, iconIndex (`${iconId}-${iconIndex}`)}
									{@const url = getIconPoolUrl(iconId)}
									<div class="gain-editor__icon">
										{#if url}
											<img src={url} alt="Gain icon" />
										{:else}
											<span class="gain-editor__icon-placeholder">?</span>
										{/if}
										<button
											type="button"
											class="gain-editor__remove"
											onclick={() => removeIcon(groupIndex, iconIndex)}
										>
											X
										</button>
									</div>
								{/each}
								{#if group.length < maxIcons}
									<button
										type="button"
										class="gain-editor__add-more"
										onclick={() => (pickerIndex = groupIndex)}
									>
										+
									</button>
								{/if}
							</div>
						{/if}
						{#if iconGroups.length > 1}
							<button
								type="button"
								class="gain-editor__remove-group"
								onclick={() => removeGroup(groupIndex)}
							>
								Remove Group
							</button>
						{/if}
					</div>
					{#if groupIndex < iconGroups.length - 1}
						<div class="gain-editor__or">/</div>
					{/if}
				{/each}
			</div>
			<button type="button" class="gain-editor__add-group" onclick={addGroup}>
				+ OR Group
			</button>
		</div>
	{/if}

	{#if pickerIndex !== null}
		{@const activeIndex = pickerIndex ?? 0}
		<div class="gain-editor__picker">
			<IconPicker
				selected={iconGroups[activeIndex] ?? []}
				onselect={(ids) => updateGroup(activeIndex, ids)}
				multiple={true}
				maxSelection={maxIcons}
				allowDuplicates={true}
			/>
			<Button variant="secondary" onclick={() => (pickerIndex = null)}>Done</Button>
		</div>
	{/if}
</div>

<style>
	.gain-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.gain-editor__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.gain-editor__loading {
		padding: 1rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.gain-editor__row {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 120px;
	}

	.gain-editor__label {
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #94a3b8;
	}

	.gain-editor__add {
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

	.gain-editor__add:hover {
		border-color: #f8fafc;
		color: #f8fafc;
	}

	.gain-editor__groups {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.gain-editor__group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		align-items: flex-start;
	}

	.gain-editor__or {
		font-size: 1rem;
		font-weight: 700;
		color: rgba(148, 163, 184, 0.7);
		padding: 0 0.2rem;
	}

	.gain-editor__add-group {
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

	.gain-editor__add-group:hover {
		color: #f8fafc;
		border-color: rgba(248, 250, 252, 0.6);
	}

	.gain-editor__icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.gain-editor__icon {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.5);
		overflow: hidden;
	}

		.gain-editor__icon img {
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

	.gain-editor__icon-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #64748b;
		font-size: 0.85rem;
	}

	.gain-editor__remove {
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

	.gain-editor__icon:hover .gain-editor__remove {
		opacity: 1;
	}

	.gain-editor__remove-group {
		border: none;
		background: transparent;
		color: #fca5a5;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
	}

	.gain-editor__remove-group:hover {
		color: #fecaca;
	}

	.gain-editor__add-more {
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

	.gain-editor__add-more:hover {
		border-color: #f8fafc;
		color: #f8fafc;
	}

	.gain-editor__picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		background: rgba(2, 6, 23, 0.6);
	}
</style>
