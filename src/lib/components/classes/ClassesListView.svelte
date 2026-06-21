<script lang="ts">
	import type { ClassRow } from '$lib/types/gameData';
	import type { Effect, EffectBreakpoint, DiceEffect } from '$lib/types/effects';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';
	import { BASE_LANGUAGE, type TranslationLanguage, getTranslationValue } from '$lib/i18n/translations';
	import { useMultiSelect } from '$lib/composables';
	import { publicAssetUrl } from '$lib/utils';
	import {
		parseEffectSchema,
		formatEffectSummary,
		parsePrismaticJson,
		type PrismaticForm
	} from '$lib/features/classes/classes';

	interface Props {
		classes: ClassRow[];
		diceNameById: Map<string, string>;
		onEdit: (cls: ClassRow) => void;
		onDelete: (cls: ClassRow) => void;
		onDeleteMultiple?: (ids: string[]) => void;
		language?: TranslationLanguage;
	}

	let {
		classes,
		diceNameById,
		onEdit,
		onDelete,
		onDeleteMultiple = () => {},
		language = BASE_LANGUAGE
	}: Props = $props();

	const selection = useMultiSelect();

	function deleteSelected() {
		const ids = Array.from(selection.selectedIds);
		onDeleteMultiple(ids);
		selection.deselectAll();
	}

	function getIconUrl(iconPng: string | null | undefined, updatedAt?: string | null): string | null {
		if (!iconPng) return null;
		const path = iconPng.startsWith('class_icons/') ? iconPng : `class_icons/${iconPng}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	const resolveDiceLabel = (id: string | null | undefined, fallback?: string) => {
		if (id && diceNameById.has(id)) return diceNameById.get(id) ?? fallback ?? 'Custom Dice';
		return fallback ?? (id ?? 'Custom Dice');
	};

	const summarizeEffectBase = (effect: Effect) => formatEffectSummary(effect, resolveDiceLabel, language);

	function getBreakpointCount(bp: EffectBreakpoint): string | number {
		if (language === BASE_LANGUAGE) return bp.count;
		if (typeof bp.count !== 'string') return bp.count;
		return getTranslationValue((bp as any).count_translations, String(language)) ?? bp.count;
	}

	function toNumericCount(count: EffectBreakpoint['count']): number | null {
		if (typeof count === 'number' && Number.isFinite(count)) return count;
		if (typeof count === 'string') {
			const trimmed = count.trim();
			if (!/^\d+$/.test(trimmed)) return null;
			const parsed = Number.parseInt(trimmed, 10);
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

	function getClassName(entry: ClassRow): string {
		if (language === BASE_LANGUAGE) return entry.name;
		return getTranslationValue(entry.name_translations, String(language)) ?? entry.name;
	}

	function getClassDescription(entry: ClassRow): string {
		if (language === BASE_LANGUAGE) return entry.description ?? '';
		return getTranslationValue(entry.description_translations, String(language)) ?? entry.description ?? '';
	}

	function getClassFooter(entry: ClassRow): string {
		if (language === BASE_LANGUAGE) return entry.footer ?? '';
		return getTranslationValue(entry.footer_translations, String(language)) ?? entry.footer ?? '';
	}

	const getPrismatic = parsePrismaticJson;

	function getClassType(entry: ClassRow): 'normal' | 'human' | 'special' {
		if (entry.class_type === 'human' || entry.class_type === 'special' || entry.class_type === 'normal') {
			return entry.class_type;
		}
		return entry.is_special ? 'special' : 'normal';
	}

	const regularClasses = $derived(
		classes.filter((c) => getClassType(c) === 'normal').sort((a, b) => a.position - b.position)
	);

	const humanClasses = $derived(
		classes.filter((c) => getClassType(c) === 'human').sort((a, b) => a.position - b.position)
	);

	const specialClasses = $derived(
		classes.filter((c) => getClassType(c) === 'special').sort((a, b) => a.position - b.position)
	);

	const classSections = $derived(
		[
			{ label: '', classes: regularClasses },
			{ label: 'Human Classes', classes: humanClasses },
			{ label: 'Special Classes', classes: specialClasses }
		].filter((section) => section.classes.length > 0)
	);
	</script>

<MultiSelectBar
	selectedCount={selection.selectedCount}
	totalCount={classes.length}
	onSelectAll={() => selection.selectAll(classes.map((c) => c.id))}
	onDeselectAll={selection.deselectAll}
	onDeleteSelected={deleteSelected}
/>

{#if classSections.length === 0}
	<div class="empty-state">No classes match the current search.</div>
{:else}
	{#each classSections as section}
		{#if section.label}
			<div class="section-divider">
				<span class="section-divider__label">{section.label}</span>
			</div>
		{/if}

		<section class="class-grid">
			{#each section.classes as entry (entry.id)}
				{@const classType = getClassType(entry)}
				{@const displayName = getClassName(entry)}
				{@const description = renderMultiline(getClassDescription(entry))}
				{@const footer = renderMultiline(getClassFooter(entry))}
				{@const prismatic = getPrismatic(entry.prismatic)}
				{@const effectSchema = sortBreakpointsByCount(
					resolveDiceIdsInSchema(parseEffectSchema(entry.effect_schema))
				)}
				{@const isSelected = selection.isSelected(entry.id)}
				<article
					class="class-card"
					class:selected={isSelected}
					class:is-human={classType === 'human'}
					class:is-special={classType === 'special'}
					style={classType === 'special'
						? `--accent-color: ${entry.color ?? '#d4a843'}`
						: `border-left-color: ${entry.color ?? '#8b5cf6'}`}
				>
					{#if classType === 'special'}
						<div class="special-corner special-corner--tl"></div>
						<div class="special-corner special-corner--tr"></div>
						<div class="special-corner special-corner--bl"></div>
						<div class="special-corner special-corner--br"></div>
					{/if}

					<header class="class-card__header">
						<div class="checkbox-wrapper">
							<input
								type="checkbox"
								checked={isSelected}
								onchange={() => selection.toggle(entry.id)}
								aria-label="Select {displayName}"
							/>
						</div>
						<div class="header-content">
							<div class="class-card__identity">
								{#if getIconUrl(entry.icon_png, entry.updated_at)}
									<img
										class="class-card__icon-image"
										class:class-card__icon-image--white={classType === 'special'}
										src={getIconUrl(entry.icon_png, entry.updated_at)}
										alt={`${displayName} icon`}
									/>
								{:else}
									<span class="class-card__icon">{entry.icon_emoji ?? '🛡️'}</span>
								{/if}
								<div>
									<h2>
										{displayName}
										{#if classType === 'human'}
											<span class="human-badge">Human</span>
										{:else if classType === 'special'}
											<span class="special-badge">Special</span>
										{/if}
									</h2>
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
											({getBreakpointCount(bp)})
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
			{/each}
		</section>
	{/each}
{/if}

<style>
	.empty-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.section-divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0.75rem 0;
	}

	.section-divider::before,
	.section-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(168, 130, 50, 0.3);
	}

	.section-divider__label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #d4a843;
		white-space: nowrap;
	}

	.class-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.5rem;
	}

	/* ── Normal (non-special) card — browns & gold ── */
	.class-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		border-left: 4px solid rgba(168, 130, 50, 0.55);
		background:
			linear-gradient(135deg, rgba(48, 32, 20, 0.82) 0%, rgba(62, 42, 26, 0.78) 50%, rgba(40, 28, 18, 0.82) 100%);
		border-radius: 8px;
		border: 1px solid rgba(168, 130, 50, 0.3);
		box-shadow: inset 0 0 12px rgba(90, 62, 28, 0.2), 0 1px 3px rgba(0, 0, 0, 0.3);
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
		background:
			linear-gradient(135deg, rgba(70, 48, 24, 0.85) 0%, rgba(95, 65, 30, 0.82) 50%, rgba(60, 42, 22, 0.85) 100%);
		border-color: rgba(212, 168, 67, 0.6);
		box-shadow: inset 0 0 14px rgba(168, 130, 50, 0.25), 0 0 0 1px rgba(212, 168, 67, 0.3);
	}

	.class-card__identity {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.class-card__identity h2 {
		font-size: 0.85rem;
		margin: 0;
		color: #f0dca0;
		letter-spacing: 0.02em;
	}

	.class-card__identity small {
		font-size: 0.7rem;
		color: #c4a96a;
	}

		.special-badge {
			display: inline-block;
			font-size: 0.6rem;
			font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.1rem 0.3rem;
		border-radius: 999px;
		background: rgba(202, 168, 62, 0.25);
		color: #d4a843;
			vertical-align: middle;
		}

		.human-badge {
			display: inline-block;
			font-size: 0.6rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.04em;
			padding: 0.1rem 0.3rem;
			border-radius: 999px;
			background: rgba(245, 245, 245, 0.14);
			border: 1px solid rgba(245, 245, 245, 0.28);
			color: #f8fafc;
			vertical-align: middle;
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
		color: #e8d5a0;
		white-space: pre-wrap;
		font-size: 0.75rem;
	}

	.class-card__description--empty {
		color: #a08968;
		font-style: italic;
	}

	.class-card__footer {
		margin: 0;
		padding-top: 0.3rem;
		border-top: 1px solid rgba(168, 130, 50, 0.3);
		color: #d4a843;
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
		background: rgba(25, 16, 10, 0.55);
		border: 1px solid rgba(168, 130, 50, 0.25);
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
		color: #d4a843;
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
		background: transparent;
		color: #f0dca0;
		border: none;
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
		background: transparent;
		color: #e8d5a0;
		border: none;
		font-size: 0.7rem;
		letter-spacing: 0.03em;
	}

	.prismatic {
		border-radius: 6px;
		border: 1px solid rgba(168, 130, 50, 0.35);
		background: rgba(35, 22, 12, 0.6);
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
		color: #f5e6c8;
	}

		.prismatic__description {
			margin: 0;
			color: #e8d5a0;
			white-space: pre-wrap;
			font-size: 0.7rem;
		}

		/* Human class cards are non-special, but separated visually from normal classes. */
		.class-card.is-human {
			background:
				linear-gradient(135deg, rgba(8, 8, 8, 0.94) 0%, rgba(32, 32, 32, 0.9) 48%, rgba(12, 12, 12, 0.94) 100%);
			border-color: rgba(245, 245, 245, 0.34);
			border-left-color: rgba(245, 245, 245, 0.72) !important;
			box-shadow:
				inset 0 0 18px rgba(255, 255, 255, 0.07),
				0 1px 3px rgba(0, 0, 0, 0.42);
		}

		.class-card.is-human .class-card__identity h2 {
			color: #f8fafc;
		}

		.class-card.is-human .class-card__identity small,
		.class-card.is-human .class-card__footer {
			color: #d4d4d8;
		}

		.class-card.is-human .class-card__description,
		.class-card.is-human .effect-tag,
		.class-card.is-human .trait-tag {
			color: #f4f4f5;
		}

		.class-card.is-human .breakpoints__item,
		.class-card.is-human .prismatic {
			background: rgba(0, 0, 0, 0.48);
			border-color: rgba(245, 245, 245, 0.2);
		}

		.class-card.is-human .breakpoints__count,
		.class-card.is-human .prismatic__title {
			color: #f8fafc;
		}

		.class-card.is-human .class-card__icon-image {
			filter: grayscale(1) contrast(1.18);
		}

		/* ── Special card overrides ── */
	.class-card.is-special {
		position: relative;
		background:
			linear-gradient(135deg, rgba(15, 8, 28, 0.95) 0%, rgba(35, 18, 55, 0.92) 50%, rgba(20, 10, 35, 0.95) 100%);
		border: 1px solid var(--accent-color, #d4a843);
		border-left: 1px solid var(--accent-color, #d4a843);
		border-radius: 0;
		padding: 0.75rem;
		box-shadow:
			inset 0 0 30px rgba(88, 28, 135, 0.2),
			0 0 0 1px rgba(0, 0, 0, 0.4),
			0 4px 16px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}

	.class-card.is-special::before {
		content: '';
		position: absolute;
		inset: 3px;
		border: 1px solid rgba(212, 168, 67, 0.25);
		pointer-events: none;
	}

	.class-card.is-special::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--accent-color, #d4a843), transparent);
		pointer-events: none;
	}

	.special-corner {
		position: absolute;
		width: 10px;
		height: 10px;
		pointer-events: none;
		z-index: 1;
	}

	.special-corner--tl {
		top: 0;
		left: 0;
		border-top: 2px solid var(--accent-color, #d4a843);
		border-left: 2px solid var(--accent-color, #d4a843);
	}

	.special-corner--tr {
		top: 0;
		right: 0;
		border-top: 2px solid var(--accent-color, #d4a843);
		border-right: 2px solid var(--accent-color, #d4a843);
	}

	.special-corner--bl {
		bottom: 0;
		left: 0;
		border-bottom: 2px solid var(--accent-color, #d4a843);
		border-left: 2px solid var(--accent-color, #d4a843);
	}

	.special-corner--br {
		bottom: 0;
		right: 0;
		border-bottom: 2px solid var(--accent-color, #d4a843);
		border-right: 2px solid var(--accent-color, #d4a843);
	}

	.class-card.is-special > *:not(.special-corner) {
		position: relative;
		z-index: 2;
	}

	.class-card.is-special .class-card__identity h2 {
		color: #f5e6c8;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 700;
	}

	.class-card.is-special .class-card__description {
		color: #d1c4e9;
	}

	.class-card.is-special .class-card__footer {
		border-top-color: rgba(168, 130, 50, 0.25);
		color: #c4a96a;
	}

	.class-card.is-special .breakpoints__item {
		background: rgba(10, 5, 20, 0.6);
		border: 1px solid rgba(168, 130, 50, 0.3);
		border-radius: 0;
	}

	.class-card.is-special .effect-tag {
		background: rgba(168, 130, 50, 0.12);
		color: #f0dca0;
		border: 1px solid rgba(168, 130, 50, 0.3);
		border-radius: 0;
		font-weight: 500;
	}

	.class-card.is-special .trait-tag {
		background: rgba(168, 130, 50, 0.15);
		color: #e8d5a0;
		border: 1px solid rgba(168, 130, 50, 0.25);
		border-radius: 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.65rem;
	}

	.class-card.is-special .prismatic {
		border: 1px solid rgba(168, 130, 50, 0.35);
		background: rgba(20, 10, 35, 0.7);
		border-radius: 0;
	}

	.class-card.is-special .prismatic__title {
		color: #f5e6c8;
	}

	.class-card.is-special .prismatic__description {
		color: #d8b4fe;
	}

	.class-card.is-special.selected {
		background:
			linear-gradient(135deg, rgba(25, 12, 45, 0.95) 0%, rgba(50, 25, 75, 0.92) 50%, rgba(30, 15, 50, 0.95) 100%);
		border-color: var(--accent-color, #d4a843);
		box-shadow:
			inset 0 0 30px rgba(168, 130, 50, 0.25),
			0 0 0 1px rgba(212, 168, 67, 0.4),
			0 4px 20px rgba(168, 130, 50, 0.2);
	}

	.class-card.is-special .special-badge {
		border-radius: 0;
		background: var(--accent-color, #d4a843);
		color: #0f0818;
		font-weight: 700;
	}

	.class-card__icon-image--white {
		filter: brightness(0) invert(1);
	}
</style>
