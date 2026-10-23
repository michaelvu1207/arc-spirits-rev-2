<script lang="ts">
	import { formatEffectSummary, parseEffectSchema } from '$lib/features/classes/classes';
	import type { HexSpiritGalleryTag } from '$lib/features/hex-spirits/galleryTags';
	import type { ClassRow, HexSpiritRow, MatItemRow } from '$lib/types/gameData';

	type GallerySpirit = HexSpiritRow & {
		game_print_image_url: string | null;
		back_side_base_url: string | null;
		back_side_export_url: string | null;
	};

	type GalleryClass = Pick<
		ClassRow,
		'id' | 'name' | 'icon_emoji' | 'description' | 'effect_schema'
	>;

	let {
		spirits,
		imageSide,
		classes,
		runes,
		onOpen,
		tags = [],
		assignedTagIdsBySpirit = {},
		busyAssignmentKeys = new Set<string>(),
		onToggleTag
	}: {
		spirits: GallerySpirit[];
		imageSide: 'front' | 'back' | 'data';
		classes: GalleryClass[];
		runes: MatItemRow[];
		onOpen: (spirit: GallerySpirit) => void;
		tags?: HexSpiritGalleryTag[];
		assignedTagIdsBySpirit?: Record<string, string[]>;
		busyAssignmentKeys?: Set<string>;
		onToggleTag?: (spiritId: string, tagId: string, assigned: boolean) => void | Promise<void>;
	} = $props();

	let previewSpirit: GallerySpirit | null = $state(null);
	let previewPosition = $state({ left: 0, top: 0 });

	function imageUrl(spirit: GallerySpirit): string | null {
		return imageSide === 'back'
			? spirit.back_side_export_url || spirit.back_side_base_url
			: spirit.game_print_image_url;
	}

	function classCounts(spirit: GallerySpirit): Array<{ spiritClass: GalleryClass; count: number }> {
		const counts = new Map<string, number>();
		for (const classId of spirit.traits?.class_ids ?? []) {
			counts.set(classId, (counts.get(classId) ?? 0) + 1);
		}
		return [...counts.entries()].flatMap(([classId, count]) => {
			const spiritClass = classes.find((candidate) => candidate.id === classId);
			return spiritClass ? [{ spiritClass, count }] : [];
		});
	}

	function showAbilityPreview(event: PointerEvent | FocusEvent, spirit: GallerySpirit) {
		if (event instanceof PointerEvent && event.pointerType === 'touch') return;
		const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const popupWidth = 330;
		const gap = 12;
		const left = rect.right + gap + popupWidth <= window.innerWidth
			? rect.right + gap
			: Math.max(gap, rect.left - popupWidth - gap);
		previewPosition = {
			left,
			top: Math.min(Math.max(gap, rect.top), Math.max(gap, window.innerHeight - 420))
		};
		previewSpirit = spirit;
	}

	function hideAbilityPreview() {
		previewSpirit = null;
	}

	function openOnKeyboard(event: KeyboardEvent, spirit: GallerySpirit) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onOpen(spirit);
		}
	}
</script>

<div class="cell-prints">
	{#each spirits as spirit (spirit.id)}
		<div class="spirit-card-shell">
			{#if imageSide === 'data'}
				<div
					class="cell-data-card cell-print--clickable"
					role="button"
					tabindex="0"
					onclick={() => onOpen(spirit)}
					onkeydown={(event) => openOnKeyboard(event, spirit)}
					onpointerenter={(event) => showAbilityPreview(event, spirit)}
					onpointerleave={hideAbilityPreview}
					onfocus={(event) => showAbilityPreview(event, spirit)}
					onblur={hideAbilityPreview}
				>
					<div class="data-card__name">{spirit.name}</div>
					<div class="data-card__cost">Cost: {spirit.cost}</div>
					{#if classCounts(spirit).length}
						<div class="data-card__classes">
							{#each classCounts(spirit) as { spiritClass, count } (spiritClass.id)}
								<span class="data-card__class-chip">
									{#if spiritClass.icon_emoji}{spiritClass.icon_emoji}{/if}
									{count > 1 ? `${count}× ` : ''}{spiritClass.name}
								</span>
							{/each}
						</div>
					{/if}
					{#if spirit.awaken_condition?.type === 'rune_cost'}
						<div class="data-card__runes">
							{#each spirit.awaken_condition.rune_ids as token}
								{#if typeof token === 'string'}
									{@const rune = runes.find((candidate) => candidate.id === token)}
									{#if rune}<span class="data-card__rune-chip">{rune.name}</span>{/if}
								{:else if token.kind === 'or'}
									<span class="data-card__rune-chip">
										{token.rune_ids.map((id) => runes.find((candidate) => candidate.id === id)?.name ?? '?').join(' / ')}
									</span>
								{/if}
							{/each}
						</div>
					{:else if spirit.awaken_condition?.type === 'text'}
						<div class="data-card__runes">
							<span class="data-card__rune-chip">{spirit.awaken_condition.text}</span>
						</div>
					{/if}
				</div>
			{:else}
				{@const cardImageUrl = imageUrl(spirit)}
				<div
					class="cell-print cell-print--clickable"
					role="button"
					tabindex="0"
					onclick={() => onOpen(spirit)}
					onkeydown={(event) => openOnKeyboard(event, spirit)}
					onpointerenter={(event) => showAbilityPreview(event, spirit)}
					onpointerleave={hideAbilityPreview}
					onfocus={(event) => showAbilityPreview(event, spirit)}
					onblur={hideAbilityPreview}
				>
					{#if cardImageUrl}
						<img
							src={cardImageUrl}
							alt={imageSide === 'front' ? `Front print for ${spirit.name}` : `Back print for ${spirit.name}`}
							loading="lazy"
						/>
					{:else}
						<div class="cell-print__placeholder">
							{imageSide === 'front' ? 'No Front Print' : 'No Back Print'}
						</div>
					{/if}
				</div>
			{/if}

			{#if tags.length > 0 && onToggleTag}
				<details class="tag-picker">
					<summary>Tags ({assignedTagIdsBySpirit[spirit.id]?.length ?? 0})</summary>
					<div class="tag-picker__options">
						{#each tags as tag (tag.id)}
							{@const assignmentKey = `${spirit.id}:${tag.id}`}
							<label class:busy={busyAssignmentKeys.has(assignmentKey)}>
								<input
									type="checkbox"
									checked={assignedTagIdsBySpirit[spirit.id]?.includes(tag.id) ?? false}
									disabled={busyAssignmentKeys.has(assignmentKey)}
									onchange={(event) => onToggleTag?.(spirit.id, tag.id, event.currentTarget.checked)}
								/>
								<span class="tag-dot" style:background={tag.color}></span>
								<span>{tag.name}</span>
							</label>
						{/each}
					</div>
				</details>
			{/if}
		</div>
	{/each}
</div>

{#if previewSpirit}
	<aside
		class="ability-preview"
		style:left={`${previewPosition.left}px`}
		style:top={`${previewPosition.top}px`}
		aria-live="polite"
	>
		<div class="ability-preview__eyebrow">{previewSpirit.name}</div>
		{#if classCounts(previewSpirit).length > 0}
			{#each classCounts(previewSpirit) as { spiritClass, count } (spiritClass.id)}
				{@const breakpoints = parseEffectSchema(spiritClass.effect_schema)}
				<section class="ability-class">
					<h4>
						<span>{spiritClass.icon_emoji || '✦'}</span>
						{spiritClass.name}{count > 1 ? ` ×${count}` : ''}
					</h4>
					{#if spiritClass.description}
						<p class="ability-class__description">{spiritClass.description}</p>
					{/if}
					{#if breakpoints.length > 0}
						<div class="ability-breakpoints">
							{#each breakpoints as breakpoint, index (`${breakpoint.count}-${index}`)}
								<div class="ability-breakpoint" data-color={breakpoint.color ?? 'bronze'}>
									<span class="ability-breakpoint__count">{breakpoint.count}</span>
									<div>
										{#if breakpoint.description}<p>{breakpoint.description}</p>{/if}
										{#each breakpoint.effects as effect}
											<p>{formatEffectSummary(effect)}</p>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		{:else}
			<p class="ability-preview__empty">This spirit has no class ability.</p>
		{/if}
	</aside>
{/if}

<style>
	.cell-prints {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.5rem;
	}

	.spirit-card-shell { min-width: 0; }
	.cell-print { background: rgba(30, 41, 59, 0.6); border-radius: 8px; border: 1px solid rgba(148, 163, 184, 0.2); padding: 0.35rem; display: flex; flex-direction: column; gap: 0.35rem; }
	.cell-print img, .cell-print__placeholder { width: 100%; aspect-ratio: 1.1 / 1; border-radius: 6px; object-fit: cover; background: rgba(15, 23, 42, 0.6); }
	.cell-print__placeholder { display: grid; place-items: center; color: #94a3b8; font-size: 0.7rem; text-transform: uppercase; }
	.cell-print--clickable { cursor: pointer; transition: all 0.2s ease; }
	.cell-print--clickable:hover { transform: scale(1.03); border-color: rgba(99, 102, 241, 0.5); box-shadow: 0 0 12px rgba(99, 102, 241, 0.3); }
	.cell-print--clickable:focus { outline: 2px solid rgba(99, 102, 241, 0.6); outline-offset: 2px; }
	.cell-data-card { background: rgba(30, 41, 59, 0.6); border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.2); padding: 0.35rem 0.4rem; display: flex; flex-direction: column; gap: 0.15rem; }
	.data-card__name { color: #f8fafc; font-size: 0.7rem; font-weight: 600; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.data-card__cost { color: #fbbf24; font-size: 0.6rem; font-weight: 600; }
	.data-card__classes, .data-card__runes { display: flex; flex-wrap: wrap; gap: 0.15rem; }
	.data-card__class-chip, .data-card__rune-chip { font-size: 0.55rem; font-weight: 500; padding: 0.05rem 0.2rem; border-radius: 2px; background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.3); }
	.data-card__rune-chip { background: rgba(168, 85, 247, 0.2); color: #d8b4fe; border-color: rgba(168, 85, 247, 0.3); }

	.tag-picker { margin-top: 0.3rem; position: relative; }
	.tag-picker summary { cursor: pointer; color: #cbd5e1; font-size: 0.65rem; user-select: none; }
	.tag-picker__options { margin-top: 0.25rem; padding: 0.35rem; display: grid; gap: 0.25rem; border-radius: 6px; background: rgba(15, 23, 42, 0.94); border: 1px solid rgba(249, 115, 22, 0.3); }
	.tag-picker__options label { display: flex; align-items: center; gap: 0.3rem; color: #e2e8f0; font-size: 0.65rem; cursor: pointer; }
	.tag-picker__options label.busy { opacity: 0.55; }
	.tag-picker__options input { margin: 0; }
	.tag-dot { width: 0.55rem; height: 0.55rem; border-radius: 999px; flex: 0 0 auto; }

	.ability-preview { position: fixed; z-index: 10000; width: min(330px, calc(100vw - 24px)); max-height: min(400px, calc(100vh - 24px)); overflow: auto; pointer-events: none; padding: 0.75rem; border-radius: 12px; color: #e2e8f0; background: linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98)); border: 1px solid rgba(129, 140, 248, 0.5); box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55); }
	.ability-preview__eyebrow { color: #a5b4fc; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.55rem; }
	.ability-class + .ability-class { border-top: 1px solid rgba(148, 163, 184, 0.18); margin-top: 0.65rem; padding-top: 0.65rem; }
	.ability-class h4 { margin: 0; display: flex; align-items: center; gap: 0.35rem; color: #fff; font-size: 0.95rem; }
	.ability-class__description, .ability-preview__empty { margin: 0.35rem 0 0; color: #cbd5e1; font-size: 0.72rem; line-height: 1.4; }
	.ability-breakpoints { display: grid; gap: 0.35rem; margin-top: 0.5rem; }
	.ability-breakpoint { display: grid; grid-template-columns: 1.55rem 1fr; gap: 0.4rem; align-items: start; padding: 0.35rem; border-radius: 7px; background: rgba(148, 163, 184, 0.08); }
	.ability-breakpoint__count { display: grid; place-items: center; width: 1.45rem; height: 1.45rem; border-radius: 5px; color: #fff; background: #9a5d34; font-size: 0.68rem; font-weight: 800; }
	.ability-breakpoint[data-color='silver'] .ability-breakpoint__count { background: #64748b; }
	.ability-breakpoint[data-color='gold'] .ability-breakpoint__count { background: #ca8a04; }
	.ability-breakpoint[data-color='prismatic'] .ability-breakpoint__count { background: linear-gradient(135deg, #7c3aed, #db2777, #0891b2); }
	.ability-breakpoint p { margin: 0; color: #e2e8f0; font-size: 0.67rem; line-height: 1.35; }
	.ability-breakpoint p + p { margin-top: 0.2rem; color: #94a3b8; }
</style>
