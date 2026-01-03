<script lang="ts">
	import type { ClassRow, SpecialCategoryRow } from '$lib/types/gameData';
	import type { Effect, EffectBreakpoint, DiceEffect } from '$lib/types/effects';
	import { supabase } from '$lib/api/supabaseClient';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';
	import {
		parseEffectSchema,
		formatEffectSummary,
		parsePrismaticJson,
		type PrismaticForm
	} from '$lib/features/classes/classes';

	interface Props {
		classes: ClassRow[];
		specialCategories: SpecialCategoryRow[];
		diceNameById: Map<string, string>;
		onEdit: (cls: ClassRow) => void;
		onDelete: (cls: ClassRow) => void;
		onDeleteMultiple?: (ids: string[]) => void;
		onEditSpecial: (cat: SpecialCategoryRow) => void;
		onDeleteSpecial: (cat: SpecialCategoryRow) => void;
	}

	let {
		classes,
		specialCategories,
		diceNameById,
		onEdit,
		onDelete,
		onDeleteMultiple = () => {},
		onEditSpecial,
		onDeleteSpecial
	}: Props = $props();

	const gameAssetsStorage = supabase.storage.from('game_assets');

	let selectedIds = $state<Set<string>>(new Set());

	function toggleSelect(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
		selectedIds = selectedIds;
	}

	function selectAll() {
		selectedIds = new Set(regularClasses.map((c) => c.id));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function deleteSelected() {
		const ids = Array.from(selectedIds);
		onDeleteMultiple(ids);
		selectedIds = new Set();
	}

	function getIconUrl(iconPng: string | null | undefined): string | null {
		if (!iconPng) return null;
		const path = iconPng.startsWith('class_icons/') ? iconPng : `class_icons/${iconPng}`;
		const { data } = gameAssetsStorage.getPublicUrl(path);
		return data?.publicUrl ?? null;
	}

	const resolveDiceLabel = (id: string | null | undefined, fallback?: string) => {
		if (id && diceNameById.has(id)) return diceNameById.get(id) ?? fallback ?? 'Custom Dice';
		return fallback ?? (id ?? 'Custom Dice');
	};

	const summarizeEffectBase = (effect: Effect) => formatEffectSummary(effect, resolveDiceLabel);

	function toNumericCount(count: EffectBreakpoint['count']): number | null {
		if (typeof count === 'number' && Number.isFinite(count)) return count;
		if (typeof count === 'string') {
			const parsed = Number.parseInt(count, 10);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}

	function sortBreakpointsByCount(breakpoints: EffectBreakpoint[]): EffectBreakpoint[] {
		return [...breakpoints]
			.map((bp, index) => ({ bp, index }))
			.sort((a, b) => {
				const aNumeric = toNumericCount(a.bp.count);
				const bNumeric = toNumericCount(b.bp.count);

				if (aNumeric !== null && bNumeric !== null) return aNumeric - bNumeric;
				if (aNumeric !== null) return -1;
				if (bNumeric !== null) return 1;
				return a.index - b.index;
			})
			.map(({ bp }) => bp);
	}

	function summarizeEffectWithScaling(className: string, effect: Effect): string {
		if (effect.type !== 'dice') {
			return summarizeEffectBase(effect);
		}

		const diceEffect = effect as DiceEffect;
		const diceLabelRaw = resolveDiceLabel(diceEffect.dice_id, diceEffect.dice_name);
		const diceLabel = (diceLabelRaw ?? diceEffect.dice_name ?? diceEffect.dice_id ?? 'Custom Dice')
			.replace(/\s+/g, ' ')
			.trim();
		const quantityValue = Number(diceEffect.quantity ?? 0);
		const quantityDisplay = Number.isFinite(quantityValue) ? Math.max(0, Math.floor(quantityValue)) : 0;
		const fallbackSummary = `${quantityDisplay}× ${diceLabel}`;

		const isSorcerer = className?.trim().toLowerCase() === 'sorcerer';
		if (isSorcerer) {
			return `${quantityDisplay}× ${diceLabel} × Runes`;
		}

		const baseSummary = summarizeEffectBase(effect);
		return baseSummary && baseSummary.trim().length ? baseSummary : fallbackSummary;
	}

	function resolveDiceIdsInSchema(schema: EffectBreakpoint[]): EffectBreakpoint[] {
		return schema.map((bp) => {
			const updatedEffects = bp.effects.map((effect) => {
				if (effect.type !== 'dice') return effect;
				const typed = effect as DiceEffect;
				if (typed.dice_id && diceNameById.has(typed.dice_id)) {
					return { ...typed, dice_name: diceNameById.get(typed.dice_id) ?? typed.dice_name };
				}
				return typed;
			});
			return { ...bp, effects: updatedEffects };
		});
	}

	function renderMultiline(value?: string | null): string {
		return (value ?? '').replace(/\r\n/g, '\n').trim();
	}

	function getClassById(id: string): ClassRow | undefined {
		return classes.find((c) => c.id === id);
	}

	const getPrismatic = parsePrismaticJson;

	// Compute set of class IDs that are in any special category
	const specialCategoryClassIds = $derived(
		new Set(
			specialCategories.flatMap((cat) => [
				...cat.slot_1_class_ids,
				...cat.slot_2_class_ids,
				...cat.slot_3_class_ids
			])
		)
	);

	// Filter out classes that are in special categories
	const regularClasses = $derived(classes.filter((c) => !specialCategoryClassIds.has(c.id)));

	// Combined and sorted items for rendering (interleaved by position)
	type GridItem =
		| { type: 'class'; data: ClassRow }
		| { type: 'special'; data: SpecialCategoryRow };

	const sortedGridItems = $derived.by(() => {
		const classItems: GridItem[] = regularClasses.map((c) => ({ type: 'class' as const, data: c }));
		const specialItems: GridItem[] = specialCategories.map((s) => ({ type: 'special' as const, data: s }));
		const combined = [...classItems, ...specialItems];
		return combined.sort((a, b) => a.data.position - b.data.position);
	});
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={regularClasses.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

{#if regularClasses.length === 0 && specialCategories.length === 0}
	<div class="empty-state">No classes match the current search.</div>
{:else}
	<section class="class-grid">
		<!-- Combined grid items sorted by position -->
		{#each sortedGridItems as item (item.type === 'special' ? `special-${item.data.id}` : item.data.id)}
			{#if item.type === 'special'}
				{@const category = item.data as SpecialCategoryRow}
				<article class="special-category-card" style="border-left-color: {category.color ?? '#8b5cf6'}">
					<header class="special-category-card__header">
						<div class="special-category-card__identity">
							<span class="special-category-card__icon">{category.icon_emoji ?? '⚡'}</span>
							<div>
								<h2>{category.name}</h2>
								<small>Position {category.position}</small>
							</div>
						</div>
						<CardActionMenu
							onEdit={() => onEditSpecial(category)}
							onDelete={() => onDeleteSpecial(category)}
							onGenerate={null}
						/>
					</header>

					{#if category.description}
						<p class="special-category-card__description">{category.description}</p>
					{/if}

					<div class="special-slots">
						{#each [category.slot_1_class_ids, category.slot_2_class_ids, category.slot_3_class_ids] as slotIds, slotIndex}
							<div class="special-slot" class:special-slot--empty={slotIds.length === 0}>
								{#each slotIds as classId}
									{@const cls = getClassById(classId)}
									{#if cls}
										{@const slotEffectSchema = sortBreakpointsByCount(
											resolveDiceIdsInSchema(parseEffectSchema(cls.effect_schema))
										)}
										<div class="special-slot__class" style="border-left-color: {cls.color ?? '#8b5cf6'}">
												<div class="special-slot__header">
													<span class="special-slot__icon">{cls.icon_emoji ?? '🛡️'}</span>
													<span class="special-slot__name">{cls.name}</span>
													<button
														type="button"
														class="special-slot__edit-btn"
														onclick={() => onEdit(cls)}
														title="Edit {cls.name}"
													>
														✏️
													</button>
													<button
														type="button"
														class="special-slot__delete-btn"
														onclick={() => onDelete(cls)}
														title="Delete {cls.name}"
													>
														🗑️
													</button>
												</div>
											{#if slotEffectSchema.length}
												<div class="special-slot__breakpoints">
													{#each slotEffectSchema as bp, bpIndex (`${classId}-bp-${bpIndex}`)}
														<span
															class="special-slot__bp"
															class:bronze={bp.color === 'bronze'}
															class:silver={bp.color === 'silver'}
															class:gold={bp.color === 'gold'}
															class:prismatic={bp.color === 'prismatic'}
														>
															({bp.count}) {bp.effects.map((e) => summarizeEffectWithScaling(cls.name, e)).join(', ')}
														</span>
													{/each}
												</div>
											{/if}
										</div>
									{/if}
								{/each}
								{#if slotIds.length === 0}
									<span class="special-slot__placeholder">Slot {slotIndex + 1}</span>
								{/if}
							</div>
						{/each}
					</div>
				</article>
			{:else}
				{@const entry = item.data as ClassRow}
			{@const description = renderMultiline(entry.description)}
			{@const footer = renderMultiline(entry.footer)}
			{@const prismatic = getPrismatic(entry.prismatic)}
			{@const effectSchema = sortBreakpointsByCount(
				resolveDiceIdsInSchema(parseEffectSchema(entry.effect_schema))
			)}
			{@const isSelected = selectedIds.has(entry.id)}
			<article class="class-card" class:selected={isSelected} style={`border-left-color: ${entry.color ?? '#8b5cf6'}`}>
				<header class="class-card__header">
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={isSelected}
							onchange={() => toggleSelect(entry.id)}
							aria-label="Select {entry.name}"
						/>
					</div>
					<div class="header-content">
						<div class="class-card__identity">
							{#if getIconUrl(entry.icon_png)}
								<img class="class-card__icon-image" src={getIconUrl(entry.icon_png)} alt={`${entry.name} icon`} />
							{:else}
								<span class="class-card__icon">{entry.icon_emoji ?? '🛡️'}</span>
							{/if}
							<div>
								<h2>{entry.name}</h2>
								<small>Position {entry.position}</small>
							</div>
						</div>
						<CardActionMenu
							onEdit={() => onEdit(entry)}
							onDelete={() => onDelete(entry)}
							onGenerate={null}
						/>
					</div>
				</header>

				{#if description}
					<p class="class-card__description">{description}</p>
				{:else}
					<p class="class-card__description class-card__description--empty">
						No description provided.
					</p>
				{/if}

				{#if Array.isArray(entry.tags) && entry.tags.length}
					<div class="trait-tag-list">
						{#each entry.tags as tag (tag)}
							<span class="trait-tag">{tag}</span>
						{/each}
					</div>
				{/if}

				{#if effectSchema.length}
					<ul class="breakpoints">
						{#each effectSchema as bp, index (`${entry.id}-bp-${index}`)}
							<li class="breakpoints__item">
								<div class="breakpoints__line">
									<span
										class="breakpoints__count"
										class:bronze={bp.color === 'bronze'}
										class:silver={bp.color === 'silver'}
										class:gold={bp.color === 'gold'}
										class:prismatic={bp.color === 'prismatic'}
									>
										({bp.count})
									</span>
									<div class="breakpoints__effects">
										{#each bp.effects as effect, effectIndex (`${entry.id}-bp-${index}-effect-${effectIndex}`)}
											<span class="effect-tag">
												{summarizeEffectWithScaling(entry.name, effect)}
											</span>
										{/each}
									</div>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="class-card__description class-card__description--empty">
						No effects configured.
					</p>
				{/if}

				{#if prismatic}
					<section class="prismatic">
						<header class="prismatic__header">
							<span class="prismatic__lead">
								{#if prismatic.count}
									<span class="prismatic__count">({prismatic.count})</span>
								{/if}
								<span class="prismatic__title">{prismatic.name || 'Prismatic Bonus'}</span>
							</span>
						</header>
						{#if prismatic.description}
							<p class="prismatic__description">{prismatic.description}</p>
						{/if}
					</section>
				{/if}

				{#if footer}
					<footer class="class-card__footer">{footer}</footer>
				{/if}
			</article>
			{/if}
		{/each}
	</section>
{/if}

<style>
	.empty-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.class-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.5rem;
	}

	.class-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		border-left: 4px solid rgba(139, 92, 246, 0.6);
		background: rgba(15, 23, 42, 0.7);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.class-card__header {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		padding-top: 0.2rem;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #3b82f6;
	}

	.header-content {
		flex: 1;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.class-card.selected {
		background: rgba(59, 130, 246, 0.12);
		border-color: rgba(59, 130, 246, 0.4);
	}

	.class-card__identity {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.class-card__identity h2 {
		font-size: 0.85rem;
		margin: 0;
	}

	.class-card__identity small {
		font-size: 0.7rem;
		color: #64748b;
	}

	.class-card__icon {
		font-size: 1.25rem;
	}

	.class-card__icon-image {
		width: 24px;
		height: 24px;
		object-fit: contain;
		border-radius: 4px;
	}

	.class-card__description {
		margin: 0;
		color: #d1d5f9;
		white-space: pre-wrap;
		font-size: 0.75rem;
	}

	.class-card__description--empty {
		color: #94a3b8;
		font-style: italic;
	}

	.class-card__footer {
		margin: 0;
		padding-top: 0.3rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		color: #cbd5f5;
		font-size: 0.7rem;
	}

	.breakpoints {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.3rem;
	}

	.breakpoints__item {
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 6px;
		padding: 0.3rem 0.4rem;
	}

	.breakpoints__line {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.breakpoints__count {
		font-weight: 600;
		color: #cbd5f5;
		font-size: 0.75rem;
	}

	.breakpoints__count.bronze {
		color: #fbbf24;
	}

	.breakpoints__count.silver {
		color: #cbd5f5;
	}

	.breakpoints__count.gold {
		color: #facc15;
	}

	.breakpoints__count.prismatic {
		background: linear-gradient(135deg, #f472b6, #60a5fa, #34d399);
		color: #0f172a;
		padding: 0.1rem 0.25rem;
		border-radius: 999px;
	}

	.breakpoints__effects {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.effect-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.35rem;
		border-radius: 999px;
		background: rgba(59, 130, 246, 0.18);
		color: #e0e7ff;
		font-size: 0.7rem;
		letter-spacing: 0.02em;
	}

	.trait-tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.trait-tag {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.35rem;
		border-radius: 999px;
		background: rgba(148, 163, 184, 0.25);
		color: #e2e8f0;
		font-size: 0.7rem;
		letter-spacing: 0.03em;
	}

	.prismatic {
		border-radius: 6px;
		border: 1px solid rgba(129, 140, 248, 0.35);
		background: rgba(30, 41, 59, 0.65);
		padding: 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.prismatic__header {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.prismatic__lead {
		display: inline-flex;
		gap: 0.25rem;
		align-items: baseline;
	}

	.prismatic__count {
		font-weight: 600;
		color: #a855f7;
		font-size: 0.75rem;
	}

	.prismatic__title {
		font-weight: 600;
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		color: #ede9fe;
	}

	.prismatic__description {
		margin: 0;
		color: #d8b4fe;
		white-space: pre-wrap;
		font-size: 0.7rem;
	}

	/* Special Category Card Styles */
	.special-category-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		border-left: 4px solid rgba(139, 92, 246, 0.6);
		background: rgba(15, 23, 42, 0.7);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.special-category-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.special-category-card__identity {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.special-category-card__identity h2 {
		font-size: 0.85rem;
		margin: 0;
	}

	.special-category-card__identity small {
		font-size: 0.7rem;
		color: #64748b;
	}

	.special-category-card__icon {
		font-size: 1.25rem;
	}

	.special-category-card__description {
		margin: 0;
		color: #d1d5f9;
		white-space: pre-wrap;
		font-size: 0.75rem;
	}

	.special-slots {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.special-slot {
		display: flex;
		align-items: flex-start;
		padding: 0.3rem;
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 6px;
	}

	.special-slot--empty {
		justify-content: center;
		padding: 0.4rem;
	}

	.special-slot__class {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding-left: 0.3rem;
		border-left: 3px solid;
		flex: 1;
	}

	.special-slot__header {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.special-slot__icon {
		font-size: 0.85rem;
	}

	.special-slot__name {
		font-size: 0.75rem;
		font-weight: 600;
		color: #e2e8f0;
		flex: 1;
	}

	.special-slot__edit-btn {
		padding: 0.1rem 0.2rem;
		font-size: 0.65rem;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 4px;
		cursor: pointer;
		opacity: 0.6;
		transition: opacity 0.15s ease, background 0.15s ease;
	}

		.special-slot__edit-btn:hover {
			opacity: 1;
			background: rgba(59, 130, 246, 0.35);
		}

		.special-slot__delete-btn {
			padding: 0.1rem 0.2rem;
			font-size: 0.65rem;
			background: rgba(248, 113, 113, 0.15);
			border: 1px solid rgba(248, 113, 113, 0.25);
			border-radius: 4px;
			cursor: pointer;
			opacity: 0.6;
			transition: opacity 0.15s ease, background 0.15s ease;
		}

		.special-slot__delete-btn:hover {
			opacity: 1;
			background: rgba(248, 113, 113, 0.25);
		}

	.special-slot__breakpoints {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.special-slot__bp {
		font-size: 0.7rem;
		color: #94a3b8;
		line-height: 1.25;
	}

	.special-slot__bp.bronze {
		color: #fbbf24;
	}

	.special-slot__bp.silver {
		color: #cbd5f5;
	}

	.special-slot__bp.gold {
		color: #facc15;
	}

	.special-slot__bp.prismatic {
		background: linear-gradient(135deg, #f472b6, #60a5fa, #34d399);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.special-slot__placeholder {
		font-size: 0.7rem;
		color: #475569;
		font-style: italic;
	}
</style>
