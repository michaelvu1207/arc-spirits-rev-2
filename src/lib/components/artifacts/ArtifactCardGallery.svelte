<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { supabase } from '$lib/api/supabaseClient';
	import type { ArtifactRow, OriginRow, RuneRow, ArtifactTagRow, GuardianRow } from '$lib/types/gameData';
	import ArtifactCard from './ArtifactCard.svelte';

	interface Props {
		isOpen: boolean;
		artifacts: ArtifactRow[];
		origins?: OriginRow[];
		runes?: RuneRow[];
		tags?: ArtifactTagRow[];
		guardians?: Pick<GuardianRow, 'id' | 'name'>[];
	}

	let {
		isOpen = $bindable(false),
		artifacts = [],
		origins = [],
		runes = [],
		tags = [],
		guardians = []
	}: Props = $props();

	// View mode: 'live' for HTML preview, 'generated' for PNG images
	let viewMode = $state<'live' | 'generated'>('live');

	// Filter artifacts that have card images (for generated view)
	const artifactsWithCards = $derived(artifacts.filter((a) => a.card_image_path));

	// Get public URL for card image
	function getCardImageUrl(artifact: ArtifactRow): string | null {
		if (!artifact.card_image_path) return null;
		const { data } = supabase.storage.from('game_assets').getPublicUrl(artifact.card_image_path);
		return data?.publicUrl || null;
	}

	// Get rune icon URLs for an artifact
	function getRecipeIcons(artifact: ArtifactRow): string[] {
		if (!artifact.recipe_box) return [];
		const icons: string[] = [];
		for (const item of artifact.recipe_box) {
			const rune = runes.find((r) => r.id === item.rune_id);
			if (!rune) continue;

			// Get icon URL
			let iconUrl: string | null = null;
			if (rune.icon_path) {
				const { data } = supabase.storage.from('game_assets').getPublicUrl(rune.icon_path);
				iconUrl = data?.publicUrl || null;
			} else {
				const origin = origins.find((o) => o.id === rune.origin_id);
				if (origin?.icon_png) {
					const path = origin.icon_png.startsWith('origin_icons/') ? origin.icon_png : `origin_icons/${origin.icon_png}`;
					const { data } = supabase.storage.from('game_assets').getPublicUrl(path);
					iconUrl = data?.publicUrl || null;
				}
			}

			if (iconUrl) {
				for (let i = 0; i < item.quantity; i++) {
					icons.push(iconUrl);
				}
			}
		}
		return icons;
	}

	// Get tag names for an artifact
	function getTagNames(artifact: ArtifactRow): string[] {
		if (!artifact.tag_ids) return [];
		return artifact.tag_ids
			.map((id) => tags.find((t) => t.id === id)?.name)
			.filter(Boolean) as string[];
	}

	// Get guardian name for an artifact
	function getGuardianName(artifact: ArtifactRow): string | null {
		if (!artifact.guardian_id) return null;
		return guardians.find((g) => g.id === artifact.guardian_id)?.name || null;
	}

	function close() {
		isOpen = false;
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	function handleBackdropKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			close();
		}
	}
</script>

{#if isOpen}
	<div
		class="gallery-backdrop"
		role="button"
		tabindex="0"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		transition:fade={{ duration: 200 }}
	>
		<div class="gallery-panel" transition:fly={{ y: 20, duration: 300 }}>
			<div class="gallery-header">
				<h2>Artifact Card Gallery</h2>
				<div class="view-toggle">
					<button
						class="toggle-btn"
						class:active={viewMode === 'live'}
						onclick={() => viewMode = 'live'}
					>
						Live Preview
					</button>
					<button
						class="toggle-btn"
						class:active={viewMode === 'generated'}
						onclick={() => viewMode = 'generated'}
					>
						Generated PNGs
					</button>
				</div>
				<button class="close-btn" onclick={close}>&times;</button>
			</div>
			<div class="gallery-content">
				{#if viewMode === 'live'}
					{#if artifacts.length === 0}
						<div class="empty-state">
							<p>No artifacts yet.</p>
						</div>
					{:else}
						<div class="gallery-grid live-grid">
							{#each artifacts as artifact (artifact.id)}
								<div class="card-item live-card">
									<ArtifactCard
										artifact={{ name: artifact.name || '', benefit: artifact.benefit || '' }}
										recipeIcons={getRecipeIcons(artifact)}
										tagNames={getTagNames(artifact)}
										guardianName={getGuardianName(artifact)}
									/>
									<div class="card-name">{artifact.name || 'Unnamed Artifact'}</div>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					{#if artifactsWithCards.length === 0}
						<div class="empty-state">
							<p>No card images generated yet.</p>
							<p class="hint">Use "Generate All Cards" to create card images for artifacts.</p>
						</div>
					{:else}
						<div class="gallery-grid">
							{#each artifactsWithCards as artifact (artifact.id)}
								{@const imageUrl = getCardImageUrl(artifact)}
								{#if imageUrl}
									<div class="card-item">
										<div class="card-image-wrapper">
											<img src={imageUrl} alt={artifact.name || 'Artifact card'} loading="lazy" />
										</div>
										<div class="card-name">{artifact.name || 'Unnamed Artifact'}</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}
				{/if}
			</div>
			<div class="gallery-footer">
				{#if viewMode === 'live'}
					<span class="count">{artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''}</span>
				{:else}
					<span class="count">{artifactsWithCards.length} card{artifactsWithCards.length !== 1 ? 's' : ''} generated</span>
				{/if}
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
		max-width: 1400px;
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
		gap: 1rem;
		background: rgba(15, 23, 42, 0.8);
		flex-shrink: 0;
	}

	.gallery-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #f8fafc;
	}

	.view-toggle {
		display: flex;
		gap: 0.5rem;
		background: rgba(30, 41, 59, 0.6);
		padding: 0.25rem;
		border-radius: 8px;
	}

	.toggle-btn {
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		color: #94a3b8;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.2s;
	}

	.toggle-btn:hover {
		color: #f8fafc;
	}

	.toggle-btn.active {
		background: #3b82f6;
		color: white;
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

	.live-grid {
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 2rem;
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

	.live-card {
		padding: 1rem;
		align-items: center;
	}

	.card-image-wrapper {
		width: 100%;
		aspect-ratio: 4 / 3;
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
	}

	.live-card .card-name {
		border-top: none;
		padding-top: 1rem;
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

		.live-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
