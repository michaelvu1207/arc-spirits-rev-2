<script lang="ts">
	import { onMount } from 'svelte';
	import type { IconPoolRow } from '$lib/types/gameData';
	import { loadAllIcons, getIconPoolUrl } from '$lib/utils/iconPool';

	interface Props {
		selected?: string[];
		onselect?: (ids: string[]) => void;
		multiple?: boolean;
		maxSelection?: number;
		allowDuplicates?: boolean;
		maxResults?: number;
	}

	let {
		selected = $bindable<string[]>([]),
		onselect,
		multiple = true,
		maxSelection = 5,
		allowDuplicates = true,
		maxResults = 450
	}: Props = $props();

	type IconWithSearch = IconPoolRow & { name_lower: string };

	let icons = $state<IconWithSearch[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');
	let sourceFilter = $state<string>('all');

	// Get unique source types for filter dropdown
	const sourceTypes = $derived([...new Set(icons.map((i) => i.source_type))].sort());

	const filteredIcons = $derived.by(() => {
		let result = icons;

		// Filter by source type
		if (sourceFilter !== 'all') {
			result = result.filter((icon) => icon.source_type === sourceFilter);
		}

		// Filter by search query
		const query = searchQuery.trim().toLowerCase();
		if (query) {
			result = result.filter((icon) =>
				icon.name_lower.includes(query)
			);
		}

		return result;
	});

	const visibleIcons = $derived.by(() => filteredIcons.slice(0, maxResults));
	const selectedSet = $derived(new Set(selected));

	onMount(async () => {
		const loaded = await loadAllIcons();
		icons = loaded.map((icon) => ({ ...icon, name_lower: icon.name.toLowerCase() }));
		loading = false;
	});

	function toggleIcon(id: string) {
		if (!allowDuplicates && selectedSet.has(id)) {
			// Remove (only if duplicates not allowed)
			const newSelection = selected.filter((s) => s !== id);
			selected = newSelection;
			onselect?.(newSelection);
		} else {
			// Add (if under limit)
			if (multiple) {
				if (selected.length < maxSelection) {
					const newSelection = [...selected, id];
					selected = newSelection;
					onselect?.(newSelection);
				}
			} else {
				// Single select - replace
				selected = [id];
				onselect?.([id]);
			}
		}
	}

	function getSourceBadge(sourceType: string): string {
		switch (sourceType) {
			case 'origin':
				return 'O';
			case 'class':
				return 'C';
			case 'rune':
				return 'R';
			case 'uploaded':
				return 'U';
			case 'dice_side':
				return 'D';
			default:
				return '';
		}
	}

	function getSourceColor(sourceType: string): string {
		switch (sourceType) {
			case 'origin':
				return 'rgba(168, 85, 247, 0.8)';
			case 'class':
				return 'rgba(59, 130, 246, 0.8)';
			case 'rune':
				return 'rgba(251, 191, 36, 0.8)';
			case 'uploaded':
				return 'rgba(34, 197, 94, 0.8)';
			case 'dice_side':
				return 'rgba(236, 72, 153, 0.8)';
			default:
				return 'transparent';
		}
	}

	function getSourceLabel(sourceType: string): string {
		switch (sourceType) {
			case 'origin':
				return 'Origins';
			case 'class':
				return 'Classes';
			case 'rune':
				return 'Runes';
			case 'uploaded':
				return 'Uploaded';
			case 'dice_side':
				return 'Dice Sides';
			case 'custom':
				return 'Custom';
			default:
				return sourceType;
		}
	}
</script>

<div class="icon-picker">
	<div class="icon-picker__filters">
		<input
			type="text"
			placeholder="Search icons..."
			bind:value={searchQuery}
			class="icon-picker__input"
		/>
		<select bind:value={sourceFilter} class="icon-picker__select">
			<option value="all">All Sources</option>
			{#each sourceTypes as source}
				<option value={source}>{getSourceLabel(source)}</option>
			{/each}
		</select>
		{#if multiple}
			<span class="icon-picker__count">{selected.length}/{maxSelection}</span>
		{/if}
	</div>

	{#if loading}
		<div class="icon-picker__loading">Loading icons...</div>
	{:else if filteredIcons.length === 0}
		<div class="icon-picker__empty">No icons found</div>
	{:else}
		{#if filteredIcons.length > maxResults}
			<div class="icon-picker__notice">
				Showing {maxResults} of {filteredIcons.length} icons. Use search/filters to narrow results.
			</div>
		{/if}
		<div class="icon-picker__grid">
			{#each visibleIcons as icon (icon.id)}
				{@const url = getIconPoolUrl(icon)}
				{@const selectionCount = selected.filter((s) => s === icon.id).length}
				{@const isSelected = selectionCount > 0}
				{@const atLimit = multiple && selected.length >= maxSelection}
				<button
					type="button"
					class="icon-picker__item"
					class:icon-picker__item--selected={isSelected}
					class:icon-picker__item--disabled={atLimit}
					onclick={() => !atLimit && toggleIcon(icon.id)}
					title={icon.name}
					disabled={atLimit}
				>
					{#if url}
						<img src={url} alt={icon.name} class="icon-picker__image" loading="lazy" decoding="async" />
					{:else}
						<span class="icon-picker__placeholder">?</span>
					{/if}
					{#if getSourceBadge(icon.source_type)}
						<span
							class="icon-picker__badge"
							style="background: {getSourceColor(icon.source_type)}"
						>
							{getSourceBadge(icon.source_type)}
						</span>
					{/if}
					{#if selectionCount > 0}
						<span class="icon-picker__check">{selectionCount > 1 ? selectionCount : '✓'}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.icon-picker {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.icon-picker__filters {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.icon-picker__input {
		flex: 1;
		min-width: 120px;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
		font-size: 0.875rem;
	}

	.icon-picker__input:focus {
		outline: none;
		border-color: rgba(96, 165, 250, 0.75);
	}

	.icon-picker__input::placeholder {
		color: rgba(148, 163, 184, 0.5);
	}

	.icon-picker__select {
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.icon-picker__select:focus {
		outline: none;
		border-color: rgba(96, 165, 250, 0.75);
	}

	.icon-picker__count {
		font-size: 0.75rem;
		color: #94a3b8;
		white-space: nowrap;
	}

	.icon-picker__loading,
	.icon-picker__empty {
		padding: 2rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.icon-picker__notice {
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.55);
		color: rgba(226, 232, 240, 0.85);
		font-size: 0.75rem;
	}

	.icon-picker__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
		gap: 0.5rem;
		max-height: 240px;
		overflow-y: auto;
		padding: 0.25rem;
	}

	.icon-picker__item {
		position: relative;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 4px;
		border-radius: 6px;
		border: 2px solid transparent;
		background: rgba(30, 41, 59, 0.5);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.icon-picker__item:hover:not(:disabled) {
		background: rgba(51, 65, 85, 0.6);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.icon-picker__item--selected {
		border-color: rgba(74, 222, 128, 0.7);
		background: rgba(74, 222, 128, 0.1);
	}

	.icon-picker__item--disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.icon-picker__image {
		width: 100%;
		height: 100%;
		object-fit: contain;
		border-radius: 4px;
	}

	.icon-picker__placeholder {
		font-size: 1.25rem;
		color: #64748b;
	}

	.icon-picker__badge {
		position: absolute;
		top: 2px;
		left: 2px;
		font-size: 0.6rem;
		font-weight: 700;
		padding: 1px 3px;
		border-radius: 3px;
		color: white;
	}

	.icon-picker__check {
		position: absolute;
		bottom: 2px;
		right: 2px;
		font-size: 0.7rem;
		color: #4ade80;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 50%;
		width: 14px;
		height: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
