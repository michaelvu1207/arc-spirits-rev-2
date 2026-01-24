<script lang="ts">
	import { browser } from '$app/environment';
	import EventCardPreview from '$lib/components/abyss-deck/EventCardPreview.svelte';
	import { generateEventCardPNG, generateEventCardPNGV2, generateEventLocationCardPNG } from '$lib/generators/cards';
	import type { StageCard } from '$lib/components/abyss-deck';
	import type { GameLocationRewardRow } from '$lib/types/gameData';
	import { getStageCardRenderStyle, type StageEventRenderStyle } from '$lib/types/stageCardStyles';
	import { getEventCardBackgroundSettingsOverride } from '$lib/types/stageCardStylePresets';
	import { defaultEventCardBackgroundSettings } from '$lib/settings/eventCardBackground';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { getErrorMessage } from '$lib/utils';

	type StageLocationPreviewLocation = {
		id: string;
		name: string;
		background_image_path: string | null;
		updated_at: string | null;
		reward_rows: GameLocationRewardRow[];
	};

	interface Props {
		card: StageCard;
		location?: StageLocationPreviewLocation | null;
	}

	let { card, location = null }: Props = $props();

	const cardImageUrl = $derived.by(() => {
		if (!card.card_image_path) return null;
		return publicAssetUrl(card.card_image_path, { updatedAt: card.updated_at ?? 0 });
	});

	const renderStyle = $derived.by(() => getStageCardRenderStyle(card.card_kind, (card as unknown as { data?: unknown }).data));

	// Check if this is a v6 event style (uses HTML preview)
	const isEventV6Style = $derived(card.card_kind === 'event' && renderStyle.startsWith('event_v6'));

	// Get background settings override for the current render style
	const eventBackgroundOverride = $derived.by(() => {
		if (card.card_kind !== 'event') return null;
		const override = getEventCardBackgroundSettingsOverride(renderStyle as StageEventRenderStyle);
		// For event_v6 (default Arcane), use the default settings so it looks consistent
		return override ?? defaultEventCardBackgroundSettings;
	});

	let generatedPreviewUrl = $state<string | null>(null);
	let generatedPreviewError = $state<string | null>(null);
	let generatingPreview = $state(false);

	$effect(() => {
		if (!browser) return;

		// If this card already has a generated PNG, prefer that.
		if (cardImageUrl) {
			generatedPreviewUrl = null;
			generatedPreviewError = null;
			generatingPreview = false;
			return;
		}

		const kind = card.card_kind;
		const style = renderStyle;
		// Use HTML preview for all event_v6* styles; only generate PNGs for stage_location and event_v2
		const shouldGenerate = kind === 'stage_location' || (kind === 'event' && !style.startsWith('event_v6'));

		if (!shouldGenerate) {
			generatedPreviewUrl = null;
			generatedPreviewError = null;
			generatingPreview = false;
			return;
		}

		let cancelled = false;
		let urlToRevoke: string | null = null;

		generatedPreviewUrl = null;
		generatedPreviewError = null;
		generatingPreview = true;

		(async () => {
			try {
				let blob: Blob;

				if (kind === 'event') {
					if (style === 'event_v2') {
						blob = await generateEventCardPNGV2(card as any, (card as any).art_url ?? null);
					} else {
						const bgOverride = getEventCardBackgroundSettingsOverride(style as any);
						blob = await generateEventCardPNG(card as any, bgOverride);
					}
				} else if (kind === 'stage_location') {
					const imagePath = location?.background_image_path ?? card.image_path ?? null;
					const imageUpdatedAt = location?.updated_at ?? card.updated_at ?? 0;
					const locationImageUrl = publicAssetUrl(imagePath, { updatedAt: imageUpdatedAt });
					if (!locationImageUrl) {
						throw new Error('Stage location is missing a background image.');
					}

					blob = await generateEventLocationCardPNG({
						locationImageUrl,
						title: location?.name ?? card.title,
						rewardRows: location?.reward_rows ?? null,
						renderStyle: style
					});
				} else {
					throw new Error(`Unsupported stage card kind: ${kind}`);
				}

				if (cancelled) return;
				urlToRevoke = URL.createObjectURL(blob);
				generatedPreviewUrl = urlToRevoke;
			} catch (err) {
				if (cancelled) return;
				generatedPreviewError = getErrorMessage(err);
			} finally {
				if (cancelled) return;
				generatingPreview = false;
			}
		})();

		return () => {
			cancelled = true;
			if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
		};
	});
</script>

<div class="preview">
	{#if cardImageUrl}
		<img src={cardImageUrl} alt={card.title} loading="lazy" />
	{:else if isEventV6Style}
		<div class="html-preview">
			<div class="html-preview__inner">
				<EventCardPreview event={card as any} backgroundSettingsOverride={eventBackgroundOverride} styleId={renderStyle} />
			</div>
		</div>
	{:else if generatedPreviewUrl}
		<img src={generatedPreviewUrl} alt={card.title} loading="lazy" />
	{:else if generatingPreview}
		<div class="placeholder" aria-label="Generating preview">
			<div class="spinner" aria-hidden="true"></div>
		</div>
	{:else}
		<div class="placeholder">
			<div class="placeholder-emoji">🎴</div>
			<div class="placeholder-text">{card.title}</div>
			{#if generatedPreviewError}
				<div class="placeholder-error">{generatedPreviewError}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.preview {
		width: 100%;
		height: 100%;
		display: block;
	}

	.preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.html-preview {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.html-preview__inner {
		/* 600x437 scaled to 40% = 240x175 */
		width: 240px;
		height: 175px;
		position: relative;
		pointer-events: none;
	}

	.html-preview__inner > :global(*) {
		position: absolute;
		top: 0;
		left: 0;
		width: 600px;
		height: 437px;
		transform: scale(0.4);
		transform-origin: top left;
	}

	.placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		text-align: center;
		color: #cbd5e1;
	}

	.placeholder-emoji {
		font-size: 2.25rem;
	}

	.placeholder-text {
		font-weight: 700;
		font-size: 0.9rem;
		color: #e2e8f0;
	}

	.placeholder-error {
		max-width: 100%;
		font-size: 0.75rem;
		color: rgba(248, 113, 113, 0.9);
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.spinner {
		width: 22px;
		height: 22px;
		border-radius: 999px;
		border: 2px solid rgba(148, 163, 184, 0.35);
		border-top-color: rgba(96, 165, 250, 0.9);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
