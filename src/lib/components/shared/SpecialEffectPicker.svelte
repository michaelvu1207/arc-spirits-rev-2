<script lang="ts">
	import { onMount } from 'svelte';
	import type { SpecialEffectRow } from '$lib/types/gameData';
	import { supabase } from '$lib/api/supabaseClient';

	interface Props {
		selected?: string[];
		onselect?: (ids: string[]) => void;
		maxSelection?: number;
	}

		let {
			selected = $bindable<string[]>([]),
			onselect,
			maxSelection = 6
		}: Props = $props();

	let effects = $state<SpecialEffectRow[]>([]);
	let loading = $state(true);
	let searchQuery = $state('');

	const filteredEffects = $derived.by(() => {
		if (!searchQuery.trim()) return effects;
		return effects.filter((effect) =>
			effect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(effect.description?.toLowerCase().includes(searchQuery.toLowerCase()))
		);
	});

	const selectedSet = $derived(new Set(selected));

	onMount(async () => {
		const { data, error } = await supabase
			.from('special_effects')
			.select('*')
			.order('name');

		if (!error && data) {
			effects = data;
		}
		loading = false;
	});

	function toggleEffect(id: string) {
		if (selectedSet.has(id)) {
			// Remove
			const newSelection = selected.filter((s) => s !== id);
			selected = newSelection;
			onselect?.(newSelection);
		} else {
			// Add (if under limit)
			if (selected.length < maxSelection) {
				const newSelection = [...selected, id];
				selected = newSelection;
				onselect?.(newSelection);
			}
		}
	}

	function getEffectById(id: string): SpecialEffectRow | undefined {
		return effects.find((e) => e.id === id);
	}
</script>

<div class="effect-picker">
	<div class="effect-picker__header">
		<input
			type="text"
			placeholder="Search effects..."
			bind:value={searchQuery}
			class="effect-picker__input"
		/>
		<span class="effect-picker__count">{selected.length}/{maxSelection}</span>
	</div>

	<!-- Selected effects display -->
	{#if selected.length > 0}
		<div class="effect-picker__selected">
			{#each selected as effectId, index (index)}
				{@const effect = getEffectById(effectId)}
				{#if effect}
					<div class="effect-picker__tag" style="--effect-color: {effect.color || '#a78bfa'}">
						<span class="effect-picker__tag-name">{effect.name}</span>
						<button
							type="button"
							class="effect-picker__tag-remove"
							onclick={() => toggleEffect(effectId)}
						>
							✕
						</button>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if loading}
		<div class="effect-picker__loading">Loading effects...</div>
	{:else if filteredEffects.length === 0}
		<div class="effect-picker__empty">No effects found</div>
	{:else}
		<div class="effect-picker__list">
			{#each filteredEffects as effect (effect.id)}
				{@const isSelected = selectedSet.has(effect.id)}
				{@const atLimit = selected.length >= maxSelection && !isSelected}
				<button
					type="button"
					class="effect-picker__item"
					class:effect-picker__item--selected={isSelected}
					class:effect-picker__item--disabled={atLimit}
					onclick={() => !atLimit && toggleEffect(effect.id)}
					disabled={atLimit}
					style="--effect-color: {effect.color || '#a78bfa'}"
				>
					<div class="effect-picker__item-header">
						{#if effect.icon}
							<span class="effect-picker__item-icon">{effect.icon}</span>
						{/if}
						<span class="effect-picker__item-name">{effect.name}</span>
						{#if isSelected}
							<span class="effect-picker__item-check">✓</span>
						{/if}
					</div>
					{#if effect.description}
						<p class="effect-picker__item-desc">{effect.description}</p>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.effect-picker {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.effect-picker__header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.effect-picker__input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
		font-size: 0.875rem;
	}

	.effect-picker__input:focus {
		outline: none;
		border-color: rgba(168, 85, 247, 0.75);
	}

	.effect-picker__input::placeholder {
		color: rgba(148, 163, 184, 0.5);
	}

	.effect-picker__count {
		font-size: 0.75rem;
		color: #94a3b8;
		white-space: nowrap;
	}

	.effect-picker__selected {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.effect-picker__tag {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
		background: color-mix(in srgb, var(--effect-color) 20%, transparent);
		border: 1px solid color-mix(in srgb, var(--effect-color) 40%, transparent);
	}

	.effect-picker__tag-name {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--effect-color);
	}

	.effect-picker__tag-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border: none;
		background: rgba(239, 68, 68, 0.3);
		color: #f87171;
		border-radius: 50%;
		font-size: 0.6rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.effect-picker__tag-remove:hover {
		background: rgba(239, 68, 68, 0.5);
	}

	.effect-picker__loading,
	.effect-picker__empty {
		padding: 1.5rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.effect-picker__list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 240px;
		overflow-y: auto;
		padding: 0.25rem;
	}

	.effect-picker__item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		border: 2px solid transparent;
		background: rgba(30, 41, 59, 0.5);
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.effect-picker__item:hover:not(:disabled) {
		background: rgba(51, 65, 85, 0.6);
		border-color: color-mix(in srgb, var(--effect-color) 30%, transparent);
	}

	.effect-picker__item--selected {
		border-color: var(--effect-color);
		background: color-mix(in srgb, var(--effect-color) 10%, transparent);
	}

	.effect-picker__item--disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.effect-picker__item-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.effect-picker__item-icon {
		font-size: 1rem;
	}

	.effect-picker__item-name {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--effect-color);
		flex: 1;
	}

	.effect-picker__item-check {
		font-size: 0.8rem;
		color: var(--effect-color);
		background: color-mix(in srgb, var(--effect-color) 25%, transparent);
		border-radius: 50%;
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.effect-picker__item-desc {
		margin: 0;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.4;
	}
</style>
