<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { VengeanceCardRow } from '$lib/types/gameData';
	import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';

	interface Props {
		cards?: VengeanceCardRow[];
	}

	let { cards = [] }: Props = $props();

	const dispatch = createEventDispatcher<{
		edit: VengeanceCardRow;
	}>();

	onMount(async () => {
		await loadIconPool();
	});

	function handleCardClick(card: VengeanceCardRow) {
		dispatch('edit', card);
	}

	function handleKeydown(event: KeyboardEvent, card: VengeanceCardRow) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleCardClick(card);
		}
	}
</script>

<div class="vengeance-grid">
	{#each cards as card, idx (card.id)}
		{@const delay = idx * 0.1}
		<article
			class="vengeance-card"
			style="--delay: {delay}s"
			role="button"
			tabindex="0"
			onclick={() => handleCardClick(card)}
			onkeydown={(e) => handleKeydown(e, card)}
		>
			<div class="shadow-mist"></div>
			<div class="ethereal-wisps"></div>
			<div class="veil-border"></div>

			<div class="card-content">
				<div class="header-section">
					<div class="shadow-eye">◉</div>
					<div class="label-row">
						<span class="card-type">Vengeance</span>
						{#if card.quantity > 1}
							<span class="qty-badge">×{card.quantity}</span>
						{/if}
					</div>
				</div>

				<div class="title-section">
					<h3 class="card-title">{card.title}</h3>
					<div class="shadow-line"></div>
				</div>

				<div class="desc-section">
					<p class="card-description">{card.description || 'Details yet unknown...'}</p>
				</div>

				<div class="reward-section">
					<div class="reward-header">
						<span class="reward-label">Reward</span>
						<div class="reward-line"></div>
					</div>
					<div class="reward-icons">
						{#if card.reward_text && card.reward_text.trim()}
							<span class="reward-text">{card.reward_text}</span>
						{:else if card.reward_icon_ids && card.reward_icon_ids.length > 0}
							{#each card.reward_icon_ids.slice(0, 8) as iconId, i (`${card.id}-${i}`)}
								{@const url = getIconPoolUrl(iconId)}
								<div class="reward-slot">
									{#if url}
										<img src={url} alt="" />
									{:else}
										<span class="slot-glyph">◇</span>
									{/if}
								</div>
							{/each}
						{:else}
							<span class="no-reward">Unknown</span>
						{/if}
					</div>
				</div>
			</div>
		</article>
	{/each}
</div>

<style>
	.vengeance-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
		gap: 2.5rem;
		padding: 2rem;
	}

	.vengeance-card {
		position: relative;
		aspect-ratio: 7 / 5;
		border-radius: 8px;
		overflow: hidden;
		cursor: pointer;
		font-family: 'Opsilon', serif;
		background: linear-gradient(135deg, #0a0a0f 0%, #151520 30%, #0d0d15 70%, #050508 100%);
		border: 2px solid #374151;
		box-shadow:
			0 0 40px rgba(88, 28, 135, 0.3),
			0 0 80px rgba(30, 27, 75, 0.2),
			inset 0 0 60px rgba(88, 28, 135, 0.1);
		animation: fade-in 0.4s ease-out var(--delay) both;
		transition: transform 0.3s ease, box-shadow 0.3s ease;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.vengeance-card:hover {
		transform: translateY(-6px);
		box-shadow:
			0 0 60px rgba(88, 28, 135, 0.5),
			0 0 120px rgba(30, 27, 75, 0.3),
			inset 0 0 80px rgba(88, 28, 135, 0.15);
	}

	.vengeance-card:focus-visible {
		outline: 2px solid #7c3aed;
		outline-offset: 4px;
	}

	.shadow-mist {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 30% 20%, rgba(88, 28, 135, 0.2) 0%, transparent 50%),
			radial-gradient(ellipse at 70% 80%, rgba(126, 34, 206, 0.15) 0%, transparent 40%),
			radial-gradient(ellipse at 50% 50%, rgba(30, 27, 75, 0.3) 0%, transparent 60%);
		animation: mist-drift 12s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes mist-drift {
		0%, 100% { opacity: 0.7; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.05); }
	}

	.ethereal-wisps {
		position: absolute;
		inset: 0;
		background-image: url("data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20,100 Q60,60 100,100 T180,100' stroke='%235b21b6' stroke-width='1' fill='none' opacity='0.3'/%3E%3Cpath d='M0,150 Q50,120 100,150 T200,150' stroke='%237c3aed' stroke-width='0.5' fill='none' opacity='0.2'/%3E%3C/svg%3E");
		animation: wisp-float 15s linear infinite;
		pointer-events: none;
	}

	@keyframes wisp-float {
		0% { background-position: 0 0; }
		100% { background-position: 200px 0; }
	}

	.veil-border {
		position: absolute;
		inset: 4px;
		border: 1px solid rgba(88, 28, 135, 0.4);
		border-radius: 4px;
		pointer-events: none;
	}

	.card-content {
		position: relative;
		z-index: 10;
		height: 100%;
		padding: 24px 32px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.header-section {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.shadow-eye {
		font-size: 3rem;
		color: #a78bfa;
		text-shadow: 0 0 20px rgba(167, 139, 250, 0.8);
	}

	.label-row {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.card-type {
		font-size: 1.35rem;
		font-weight: 700;
		color: #9ca3af;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		text-shadow: 0 0 10px rgba(156, 163, 175, 0.3);
	}

	.qty-badge {
		padding: 4px 12px;
		background: rgba(55, 65, 81, 0.5);
		border: 1px solid rgba(107, 114, 128, 0.4);
		border-radius: 999px;
		font-size: 1.35rem;
		font-weight: 700;
		color: #9ca3af;
	}

	.title-section {
		text-align: center;
	}

	.card-title {
		margin: 0;
		font-size: 2.625rem;
		font-weight: 700;
		color: #e5e7eb;
		text-shadow: 0 0 30px rgba(88, 28, 135, 0.5);
	}

	.shadow-line {
		height: 1px;
		margin-top: 8px;
		background: linear-gradient(90deg, transparent, #581c87, #7c3aed, #581c87, transparent);
		box-shadow: 0 0 20px rgba(88, 28, 135, 0.5);
	}

	.desc-section {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card-description {
		margin: 0;
		text-align: center;
		line-height: 1.5;
		font-size: 1.425rem;
		max-width: 90%;
		color: #d1d5db;
		opacity: 0.8;
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.reward-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.reward-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.reward-label {
		font-weight: 700;
		font-size: 1.125rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #a78bfa;
	}

	.reward-line {
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(88, 28, 135, 0.4), transparent);
	}

	.reward-icons {
		display: flex;
		gap: 10px;
		justify-content: center;
		flex-wrap: wrap;
	}

	.reward-text {
		font-style: italic;
		color: rgba(209, 213, 219, 0.7);
		font-size: 1.5rem;
	}

	.reward-slot {
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: linear-gradient(180deg, rgba(30, 27, 75, 0.6), rgba(10, 10, 15, 0.8));
		border: 1px solid rgba(88, 28, 135, 0.5);
		box-shadow: 0 0 10px rgba(88, 28, 135, 0.2);
	}

	.reward-slot img {
		width: 32px;
		height: 32px;
		object-fit: contain;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.35));
	}

	.slot-glyph {
		font-size: 1.875rem;
		color: #a78bfa;
	}

	.no-reward {
		font-size: 1.5rem;
		color: rgba(156, 163, 175, 0.5);
		font-style: italic;
	}
</style>
