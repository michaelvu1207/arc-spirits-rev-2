<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { supabase } from '$lib/api/supabaseClient';
	import type { MonsterRow, StageCardRow } from '$lib/types/gameData';

	export let isOpen = false;
	export let monsters: MonsterRow[] = [];
	export let events: StageCardRow[] = [];

	type GalleryItem = {
		type: 'monster' | 'event';
		id: string;
		name: string;
		card_image_path: string | null;
		order_num: number;
	};

	// Combine and filter cards that have images, sorted by order_num
	$: cardsWithImages = [
		...monsters
			.filter((m) => m.card_image_path)
			.map((m) => ({
				type: 'monster' as const,
				id: m.id,
				name: m.name,
				card_image_path: m.card_image_path,
				order_num: m.order_num ?? 999
			})),
		...events
			.filter((e) => e.card_image_path)
			.map((e) => ({
				type: 'event' as const,
				id: e.id,
				name: e.title,
				card_image_path: e.card_image_path,
				order_num: e.order_num ?? 999
			}))
	].sort((a, b) => a.order_num - b.order_num);

	// Get public URL for card image
	function getCardImageUrl(item: GalleryItem): string | null {
		if (!item.card_image_path) return null;
		const { data } = supabase.storage.from('game_assets').getPublicUrl(item.card_image_path);
		return data?.publicUrl || null;
	}

	function close() {
		isOpen = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}
</script>

{#if isOpen}
	<div class="gallery-backdrop" role="button" tabindex="0" on:click={handleBackdropClick} on:keydown={(e)=> (e.key==="Enter"||e.key===" ") && handleBackdropClick(e as any)} transition:fade={{ duration: 200 }}>
		<div class="gallery-panel" transition:fly={{ y: 20, duration: 300 }}>
			<div class="gallery-header">
				<h2>Card Gallery</h2>
				<button class="close-btn" on:click={close}>&times;</button>
			</div>
			<div class="gallery-content">
				{#if cardsWithImages.length === 0}
					<div class="empty-state">
						<p>No card images generated yet.</p>
						<p class="hint">Use "Generate All Cards" to create card images.</p>
					</div>
				{:else}
					<div class="gallery-grid">
						{#each cardsWithImages as card}
							{@const imageUrl = getCardImageUrl(card)}
							{#if imageUrl}
								<div class="card-item" class:card-item--event={card.type === 'event'}>
									<div class="card-image-wrapper">
										<img src={imageUrl} alt={card.name || 'Card'} loading="lazy" />
									</div>
									<div class="card-name">
										{#if card.type === 'event'}
											<span class="card-type-badge card-type-badge--event">Event</span>
										{/if}
										{card.name || 'Unnamed Card'}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
			<div class="gallery-footer">
				<span class="count">{cardsWithImages.length} card{cardsWithImages.length !== 1 ? 's' : ''} generated</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.gallery-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.gallery-panel {
		background: #0f172a;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		width: 100%;
		max-width: 1200px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
	}

	.gallery-header {
		padding: 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(15, 23, 42, 0.8);
		flex-shrink: 0;
	}

	.gallery-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #f8fafc;
	}

	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #f8fafc;
	}

	.gallery-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		min-height: 0;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #94a3b8;
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	.empty-state .hint {
		font-size: 0.9rem;
		color: #64748b;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 1.5rem;
	}

	.card-item {
		display: flex;
		flex-direction: column;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		overflow: hidden;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.card-item:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.card-image-wrapper {
		width: 100%;
		aspect-ratio: 3 / 4;
		overflow: hidden;
		background: #1e293b;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card-image-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.card-name {
		padding: 0.75rem;
		text-align: center;
		font-size: 0.9rem;
		color: #f8fafc;
		font-weight: 500;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.card-item--event {
		border-color: rgba(59, 130, 246, 0.3);
	}

	.card-item--event:hover {
		border-color: rgba(59, 130, 246, 0.5);
	}

	.card-type-badge {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
	}

	.card-type-badge--event {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
	}

	.gallery-footer {
		padding: 1rem 1.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		background: rgba(15, 23, 42, 0.8);
		flex-shrink: 0;
	}

	.count {
		color: #94a3b8;
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.gallery-panel {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.gallery-grid {
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
			gap: 1rem;
		}
	}
</style>
