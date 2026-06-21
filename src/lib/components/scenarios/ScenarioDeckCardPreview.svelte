<script lang="ts">
	import { publicAssetUrl } from '$lib/utils/storage';
	import StageCardPreview from '$lib/components/scenarios/StageCardPreview.svelte';
	import type {
		GameLocationRewardRow,
		ScenarioDeckEntryRow
	} from '$lib/types/gameData';
	import type { StageCard } from '$lib/components/abyss-deck';

	interface Props {
		entry: ScenarioDeckEntryRow;
		monster?: { id: string; name: string; card_image_path: string | null; updated_at: string | null } | null;
		location?: {
			id: string;
			name: string;
			background_image_path: string | null;
			image_with_icons_path: string | null;
			updated_at: string | null;
			reward_rows: GameLocationRewardRow[];
		} | null;
		event?: {
			id: string;
			internal_name: string;
			stage: string;
			title: string;
			description: string | null;
			reward_rows: unknown;
			image_path: string | null;
			card_image_path: string | null;
			data: unknown;
			created_at?: string | null;
			updated_at: string | null;
		} | null;
		stageCompletion?: {
			id: string;
			title: string;
			stage: string;
			card_image_path: string | null;
			updated_at: string | null;
		} | null;
	}

	let { entry, monster = null, location = null, event = null, stageCompletion = null }: Props = $props();

	function getStorageImageUrl(path: string | null | undefined, updatedAt?: string | null): string | null {
		if (!path) return null;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function getEventArtUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
		if (!imagePath) return null;
		const path = imagePath.startsWith('events/') ? imagePath : `events/${imagePath}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	const eventStageCard = $derived.by<StageCard | null>(() => {
		if (entry.kind !== 'event') return null;
		if (!event) return null;

		return {
			id: event.id,
			name: event.internal_name,
			card_kind: 'event',
			stage: event.stage as any,
			title: event.title,
			description: event.description,
			image_path: event.image_path,
			card_image_path: event.card_image_path,
			reward_rows: event.reward_rows as any,
			order_num: entry.order_num,
			created_at: event.created_at ?? null,
				updated_at: event.updated_at,
				data: event.data as any,
				game_location_id: null,
				art_url: getEventArtUrl(event.image_path, event.updated_at)
			} as unknown as StageCard;
	});

	const locationStageCard = $derived.by<StageCard | null>(() => {
		if (entry.kind !== 'location') return null;
		if (!location) return null;
		if (!entry.entry_stage) return null;

		return {
			id: entry.id,
			name: entry.id,
			card_kind: 'stage_location',
			stage: entry.entry_stage,
			title: location.name,
			description: null,
			image_path: location.background_image_path ?? null,
			card_image_path: location.image_with_icons_path ?? null,
			reward_rows: [],
			order_num: entry.order_num,
			created_at: entry.created_at,
				updated_at: location.updated_at ?? entry.updated_at,
				data: entry.data,
				game_location_id: location.id,
				art_url: null
			} as unknown as StageCard;
	});

	const locationRenderStyle = $derived.by(() => {
		if (entry.kind !== 'location') return null;
	});

	const monsterImageUrl = $derived.by(() => {
		if (!monster) return null;
		return getStorageImageUrl(monster.card_image_path, monster.updated_at);
	});

	// EventCardPreview uses its own background store; no need to subscribe here.

	// For event_cards with a stored PNG, prefer showing the PNG (fast).
	const eventCardImageUrl = $derived.by(() => {
		if (entry.kind !== 'event') return null;
		if (!event?.card_image_path) return null;
		return getStorageImageUrl(event.card_image_path, event.updated_at);
	});

	const locationFallbackImageUrl = $derived.by(() => {
		if (entry.kind !== 'location') return null;
		return getStorageImageUrl(location?.image_with_icons_path ?? location?.background_image_path, location?.updated_at);
	});

	const stageCompletionImageUrl = $derived.by(() => {
		if (entry.kind !== 'stage_completion') return null;
		if (!stageCompletion?.card_image_path) return null;
		return getStorageImageUrl(stageCompletion.card_image_path, stageCompletion.updated_at);
	});
</script>

<div class="preview">
	{#if entry.kind === 'event'}
		{#if eventCardImageUrl}
			<img src={eventCardImageUrl} alt={event?.title ?? 'Event'} loading="lazy" />
		{:else if eventStageCard}
			<StageCardPreview card={eventStageCard} />
		{:else}
			<div class="placeholder">Missing event</div>
		{/if}
	{:else if entry.kind === 'location'}
		{#if locationStageCard}
			<!-- Uses per-entry render style in entry.data -->
			<StageCardPreview card={locationStageCard} location={location} />
		{:else if locationFallbackImageUrl}
			<img src={locationFallbackImageUrl} alt={location?.name ?? 'Location'} loading="lazy" />
		{:else}
			<div class="placeholder">Missing location</div>
		{/if}
	{:else if entry.kind === 'monster'}
		{#if monsterImageUrl}
			<img src={monsterImageUrl} alt={monster?.name ?? 'Monster'} loading="lazy" />
		{:else}
			<div class="placeholder">No monster PNG</div>
		{/if}
	{:else if entry.kind === 'stage_completion'}
		{#if stageCompletionImageUrl}
			<img src={stageCompletionImageUrl} alt={stageCompletion?.title ?? 'Stage Completion'} loading="lazy" />
		{:else}
			<div class="placeholder">{stageCompletion?.title ?? 'No PNG'}</div>
		{/if}
	{:else}
		<div class="placeholder">Unknown kind: {entry.kind}</div>
	{/if}
</div>

<style>
	.preview {
		width: 100%;
		height: 100%;
		display: block;
		overflow: hidden;
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
		align-items: center;
		justify-content: center;
		padding: 0.75rem;
		text-align: center;
		color: #cbd5e1;
		background: rgba(15, 23, 42, 0.25);
		border: 1px dashed rgba(148, 163, 184, 0.35);
		border-radius: 10px;
		font-weight: 600;
		font-size: 0.85rem;
	}

</style>
