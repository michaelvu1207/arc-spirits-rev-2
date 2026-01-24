<script lang="ts">
	import type { CustomDiceWithSides } from '$lib/features/dice/dice';
	import { DICE_TYPE_ICONS, DICE_TYPE_LABELS } from '$lib/features/dice/dice';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';
	import { BASE_LANGUAGE, type TranslationLanguage, getTranslationValue } from '$lib/i18n/translations';

	type Props = {
		dices: CustomDiceWithSides[];
		onEdit: (dice: CustomDiceWithSides) => void;
		onDelete: (dice: CustomDiceWithSides) => void;
		onDeleteMultiple?: (diceIds: string[]) => void;
		language?: TranslationLanguage;
	};

	let { dices, onEdit, onDelete, onDeleteMultiple, language = BASE_LANGUAGE }: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());

	function toggleSelect(diceId: string) {
		const newSelected = new Set(selectedIds);
		if (newSelected.has(diceId)) {
			newSelected.delete(diceId);
		} else {
			newSelected.add(diceId);
		}
		selectedIds = newSelected;
	}

	function selectAll() {
		selectedIds = new Set(dices.map((d) => d.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function deleteSelected() {
		if (onDeleteMultiple && selectedIds.size > 0) {
			onDeleteMultiple(Array.from(selectedIds));
			selectedIds = new Set();
		}
	}

	function getDiceName(dice: CustomDiceWithSides): string {
		if (language === BASE_LANGUAGE) return dice.name;
		return getTranslationValue((dice as any).name_translations, String(language)) ?? dice.name;
	}

	function getDiceDescription(dice: CustomDiceWithSides): string | null {
		const base = dice.description ?? null;
		if (language === BASE_LANGUAGE) return base;
		return getTranslationValue((dice as any).description_translations, String(language)) ?? base;
	}

	/**
	 * Calculate Expected Value and Standard Deviation for attack dice
	 */
	function calculateStats(dice: CustomDiceWithSides): { ev: number; sd: number } | null {
		if (dice.dice_type !== 'attack') return null;

		const values = dice.dice_sides
			.map((side) => parseFloat(side.reward_value) || 0)
			.filter((v) => !isNaN(v));

		if (values.length === 0) return null;

		// Expected Value (mean)
		const ev = values.reduce((sum, v) => sum + v, 0) / values.length;

		// Standard Deviation
		const variance = values.reduce((sum, v) => sum + Math.pow(v - ev, 2), 0) / values.length;
		const sd = Math.sqrt(variance);

		return { ev, sd };
	}

	/**
	 * Format stats for display
	 */
	function formatStats(stats: { ev: number; sd: number } | null): string {
		if (!stats) return '';
		return `EV: ${stats.ev.toFixed(2)}, SD: ${stats.sd.toFixed(2)}`;
	}
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={dices.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

<section class="card-grid">
	{#each dices as dice (dice.id)}
		{@const stats = calculateStats(dice)}
		{@const isSelected = selectedIds.has(dice.id)}
		{@const displayName = getDiceName(dice)}
		{@const displayDescription = getDiceDescription(dice)}
		<article class="card dice-card" class:selected={isSelected}>
			<header>
				<div class="checkbox-wrapper">
					<input
						type="checkbox"
						checked={isSelected}
						onchange={() => toggleSelect(dice.id)}
						aria-label="Select {displayName}"
					/>
				</div>
				<div class="header-content">
					{#if dice.icon}
						<span class="dice-icon">{dice.icon}</span>
					{/if}
					<div class="title-group">
						<h2>{displayName}</h2>
						<div class="type-badge" data-type={dice.dice_type}>
							<span class="type-icon">{DICE_TYPE_ICONS[dice.dice_type]}</span>
							<span class="type-label">{DICE_TYPE_LABELS[dice.dice_type]}</span>
						</div>
					</div>
				</div>
				<CardActionMenu
					onEdit={() => onEdit(dice)}
					onDelete={() => onDelete(dice)}
					onGenerate={null}
				/>
			</header>

			<div class="dice-details">
				{#if displayDescription}
					<div class="detail-section">
						<p class="description-text">{displayDescription}</p>
					</div>
				{/if}

				<div class="detail-section">
					<div class="info-row">
						<span class="info-label">Sides:</span>
						<span class="info-value">{dice.dice_sides.length}</span>
					</div>

					{#if stats}
						<div class="info-row stats">
							<span class="info-label">Stats:</span>
							<span class="info-value">{formatStats(stats)}</span>
						</div>
					{/if}
				</div>

				{#if dice.category || dice.color}
					<div class="detail-section metadata">
						{#if dice.category}
							<span class="category-badge">{dice.category}</span>
						{/if}
						{#if dice.color}
							<div class="color-swatch-container">
								<span class="color-label">Color:</span>
								<div class="color-swatch" style="background-color: {dice.color}"></div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</article>
	{:else}
		<div class="card empty">No dice found</div>
	{/each}
</section>

<style>
	.card-grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	}

	.card {
		background: rgba(30, 41, 59, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		padding: 0.5rem;
		transition: all 0.2s ease;
	}

	.card:hover {
		transform: translateY(-2px);
		border-color: rgba(148, 163, 184, 0.4);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.card.empty {
		text-align: center;
		color: #94a3b8;
		padding: 1rem;
		font-style: italic;
		font-size: 0.75rem;
	}

	.dice-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.dice-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.4rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		padding-top: 0.15rem;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #3b82f6;
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		flex: 1;
		min-width: 0;
	}

	.card.selected {
		border-color: rgba(59, 130, 246, 0.5);
		background: rgba(59, 130, 246, 0.1);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}

	.dice-icon {
		font-size: 1.5rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.title-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.dice-card h2 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #f8fafc;
		line-height: 1.2;
		word-break: break-word;
	}

	.type-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.65rem;
		font-weight: 500;
		padding: 0.15rem 0.35rem;
		border-radius: 2px;
		line-height: 1.2;
		width: fit-content;
	}

	.type-badge[data-type='attack'] {
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
	}

	.type-badge[data-type='special'] {
		background: rgba(139, 92, 246, 0.2);
		border: 1px solid rgba(139, 92, 246, 0.4);
		color: #c4b5fd;
	}

	.type-icon {
		line-height: 1;
	}

	.type-label {
		line-height: 1;
	}

	.dice-details {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.detail-section {
		background: rgba(15, 23, 42, 0.5);
		border-radius: 2px;
		padding: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.description-text {
		margin: 0;
		font-size: 0.7rem;
		color: #cbd5e1;
		line-height: 1.4;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.7rem;
		line-height: 1.4;
	}

	.info-row + .info-row {
		margin-top: 0.25rem;
	}

	.info-label {
		color: #c7d2fe;
		font-weight: 600;
	}

	.info-value {
		color: #cbd5e1;
	}

	.info-row.stats .info-value {
		font-family: 'Courier New', monospace;
		font-size: 0.65rem;
		color: #a5b4fc;
	}

	.detail-section.metadata {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.category-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 500;
		padding: 0.15rem 0.35rem;
		border-radius: 2px;
		line-height: 1.2;
		background: rgba(100, 116, 139, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.3);
		color: #cbd5e1;
	}

	.color-swatch-container {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.color-label {
		font-size: 0.65rem;
		color: #94a3b8;
	}

	.color-swatch {
		width: 20px;
		height: 20px;
		border-radius: 3px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		flex-shrink: 0;
	}
</style>
