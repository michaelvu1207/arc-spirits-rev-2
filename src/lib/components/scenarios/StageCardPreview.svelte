<script lang="ts">
	import { browser } from '$app/environment';
	import { generateEventCardPNG } from '$lib/generators/cards';
	import type { StageCard } from '$lib/components/abyss-deck';
	import type { GameLocationRewardRow } from '$lib/types/gameData';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { getErrorMessage } from '$lib/utils';

	type StageLocationPreviewLocation = {
		id: string;
		name: string;
		background_image_path: string | null;
		image_with_icons_path: string | null;
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

	let generatedPreviewUrl = $state<string | null>(null);
	let generatedPreviewError = $state<string | null>(null);
	let generatingPreview = $state(false);

	const stageLocationImageUrl = $derived.by(() => {
		if (card.card_kind !== 'stage_location') return null;
		const imagePath = location?.image_with_icons_path ?? location?.background_image_path ?? card.image_path ?? null;
		const imageUpdatedAt = location?.updated_at ?? card.updated_at ?? 0;
		return publicAssetUrl(imagePath, { updatedAt: imageUpdatedAt });
	});

	$effect(() => {
		if (!browser) return;

		// If this card already has a generated PNG, prefer that.
		if (cardImageUrl) {
			generatedPreviewUrl = null;
			generatedPreviewError = null;
			generatingPreview = false;
			return;
		}

		if (card.card_kind !== 'event') {
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
				const blob = await generateEventCardPNG(card as any);
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
	{:else if stageLocationImageUrl}
		<img src={stageLocationImageUrl} alt={card.title} loading="lazy" />
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
