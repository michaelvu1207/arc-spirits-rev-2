<script lang="ts">
	import type { MonsterRow, SpecialEffectRow } from '$lib/types/gameData';
	import { publicAssetUrl } from '$lib/utils/storage';

	type Monster = MonsterRow & {
		icon_url?: string | null;
		art_url?: string | null;
		effects?: SpecialEffectRow[];
		invade_location_name?: string | null;
	};

	export let monster: Monster;

	// Legacy props kept for compatibility with AbyssDeckWorkspace and other callers.
	export let orderNum: number | undefined = undefined;
	export let footerLabel: string = 'Monster';
	export let renderMode: 'full' | 'fast' = 'full';
	export let language: string = 'base';
	export let variant: number | undefined = undefined;

	function isGeneratedPath(path: string | null | undefined): boolean {
		if (!path) return false;
		return path.includes('card_images/monsters/en_generated') || path.includes('/en_generated/');
	}

	$: finalPath = isGeneratedPath(monster.card_image_path) ? monster.card_image_path : null;
	$: basePath = monster.card_base_image_path ?? null;
	// Prefer icon-placer output; fallback to base no-info print; last-resort to legacy card_image_path.
	$: effectivePath = finalPath ?? basePath ?? monster.card_image_path ?? null;
	$: imageUrl = publicAssetUrl(effectivePath, { updatedAt: monster.updated_at ?? undefined });
</script>

<div class="card-preview" class:missing={!imageUrl} title={monster.name}>
	{#if imageUrl}
		<img src={imageUrl} alt={monster.name} loading="lazy" decoding="async" />
	{:else}
		<div class="placeholder">
			<div class="placeholder__title">{monster.name}</div>
			<div class="placeholder__hint">No generated card image yet.</div>
		</div>
	{/if}
</div>

<style>
	.card-preview {
		width: 100%;
		height: 100%;
		border-radius: 6px;
		overflow: hidden;
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.22);
		display: grid;
		place-items: center;
	}

	.card-preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		background: rgba(2, 6, 23, 0.6);
	}

	.placeholder {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		gap: 0.35rem;
		padding: 1rem;
		color: rgba(226, 232, 240, 0.9);
		text-align: center;
		font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji';
	}

	.placeholder__title {
		font-weight: 800;
		font-size: 1.05rem;
	}

	.placeholder__hint {
		font-size: 0.9rem;
		color: rgba(148, 163, 184, 0.95);
	}

	.card-preview.missing {
		border-style: dashed;
	}
</style>
