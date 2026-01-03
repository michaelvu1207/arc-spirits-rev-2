<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { TravelerQuestRow } from '$lib/types/gameData';
	import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';

	interface Props {
		quests?: TravelerQuestRow[];
	}

	let { quests = [] }: Props = $props();

	const dispatch = createEventDispatcher<{
		edit: TravelerQuestRow;
	}>();

	onMount(async () => {
		await loadIconPool();
	});

	function handleCardClick(quest: TravelerQuestRow) {
		dispatch('edit', quest);
	}

	function handleKeydown(event: KeyboardEvent, quest: TravelerQuestRow) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleCardClick(quest);
		}
	}
</script>

<!-- Rustic Horizontal Scroll -->
<div class="scroll-grid">
	{#each quests as quest, idx (quest.id)}
		{@const delay = idx * 0.1}
		<article
			class="scroll-card"
			style="--delay: {delay}s"
			role="button"
			tabindex="0"
			onclick={() => handleCardClick(quest)}
			onkeydown={(e) => handleKeydown(e, quest)}
		>
			<!-- Aged paper base -->
			<div class="paper-base">
				<div class="paper-texture"></div>
				<div class="paper-stains"></div>
			</div>

			<!-- Side scroll rolls -->
			<div class="roll roll-left">
				<div class="roll-shadow"></div>
				<div class="roll-body">
					<div class="roll-grain"></div>
					<div class="roll-highlight"></div>
				</div>
				<div class="roll-cap roll-cap-t"></div>
				<div class="roll-cap roll-cap-b"></div>
			</div>
			<div class="roll roll-right">
				<div class="roll-shadow"></div>
				<div class="roll-body">
					<div class="roll-grain"></div>
					<div class="roll-highlight"></div>
				</div>
				<div class="roll-cap roll-cap-t"></div>
				<div class="roll-cap roll-cap-b"></div>
			</div>

			<!-- Main content -->
			<div class="scroll-content">
				<!-- Header -->
				<div class="header-bar">
					<div class="quest-label">
						<span class="label-ornament">~</span>
						<span class="label-text">Quest</span>
						<span class="label-ornament">~</span>
					</div>
				</div>

				<!-- Title -->
				<div class="title-container">
					<h3 class="quest-title">{quest.title}</h3>
					<div class="title-underline"></div>
				</div>

				<!-- Description -->
				<div class="desc-area">
					<p class="quest-description">{quest.description || 'Details yet unknown...'}</p>
				</div>

				<!-- Reward display -->
				<div class="reward-display">
					<div class="reward-label">
						<span class="label-text">Reward</span>
					</div>
					<div class="reward-divider"></div>
					<div class="reward-items">
						{#if quest.reward_text && quest.reward_text.trim()}
							<span class="reward-text">{quest.reward_text}</span>
						{:else if quest.reward_icon_ids && quest.reward_icon_ids.length > 0}
							{#each quest.reward_icon_ids.slice(0, 8) as iconId, i (`${quest.id}-${i}`)}
								{@const url = getIconPoolUrl(iconId)}
								<div class="reward-box">
									{#if url}
										<img src={url} alt="" />
									{:else}
										<span class="box-fallback">?</span>
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
	.scroll-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(700px, 1fr));
		gap: 3rem;
		padding: 2rem;
	}

	.scroll-card {
		position: relative;
		aspect-ratio: 7 / 5;
		cursor: pointer;
		animation: fade-in 0.4s ease-out var(--delay) both;
		transition: transform 0.2s ease;
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

	.scroll-card:hover {
		transform: translateY(-3px);
	}

	.scroll-card:hover .paper-base {
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
	}

	.scroll-card:focus-visible {
		outline: 2px solid #8b6914;
		outline-offset: 6px;
	}

	/* Paper base */
	.paper-base {
		position: absolute;
		inset: 0 44px;
		background: linear-gradient(
			135deg,
			#e8dcc4 0%,
			#d9c9a8 25%,
			#e2d4b8 50%,
			#d5c4a0 75%,
			#ddd0b5 100%
		);
		border: 2px solid #a89060;
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.15),
			inset 0 0 60px rgba(139, 105, 20, 0.08);
		overflow: hidden;
		transition: box-shadow 0.2s ease;
	}

	.paper-texture {
		position: absolute;
		inset: 0;
		background-image:
			url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
		opacity: 0.06;
	}

	.paper-stains {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 30%, rgba(139, 90, 43, 0.08) 0%, transparent 50%),
			radial-gradient(ellipse at 80% 70%, rgba(120, 80, 30, 0.06) 0%, transparent 40%),
			radial-gradient(ellipse at 60% 20%, rgba(100, 70, 20, 0.05) 0%, transparent 35%);
	}

	/* Side scroll rolls */
	.roll {
		position: absolute;
		top: -16px;
		bottom: -16px;
		width: 56px;
		z-index: 5;
	}

	.roll-left { left: 0; }
	.roll-right { right: 0; }

	.roll-shadow {
		position: absolute;
		inset: 30px -6px 30px 10px;
		background: rgba(0, 0, 0, 0.25);
		border-radius: 50%;
		filter: blur(8px);
	}

	.roll-body {
		position: absolute;
		inset: 24px 0;
		background: linear-gradient(
			90deg,
			#6b4423 0%,
			#8b5a2b 15%,
			#a0693d 30%,
			#7a4f28 50%,
			#8b5a2b 70%,
			#6b4423 85%,
			#5a3a1e 100%
		);
		border-radius: 28px;
		box-shadow:
			inset 0 4px 8px rgba(255, 255, 255, 0.15),
			inset 0 -4px 8px rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}

	.roll-grain {
		position: absolute;
		inset: 0;
		background-image:
			url("data:image/svg+xml,%3Csvg viewBox='0 0 40 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.3 0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E");
		opacity: 0.12;
	}

	.roll-highlight {
		position: absolute;
		left: 8px;
		top: 8%;
		bottom: 8%;
		width: 10px;
		background: linear-gradient(180deg, transparent, rgba(255,255,255,0.2), transparent);
		border-radius: 6px;
	}

	.roll-cap {
		position: absolute;
		left: -8px;
		width: 72px;
		height: 44px;
		background: linear-gradient(
			90deg,
			#4a3520 0%,
			#6b4a30 20%,
			#8b6340 50%,
			#6b4a30 80%,
			#4a3520 100%
		);
		border-radius: 10px;
		box-shadow:
			0 4px 8px rgba(0, 0, 0, 0.3),
			inset 0 2px 4px rgba(255, 255, 255, 0.1);
	}

	.roll-cap::after {
		content: '';
		position: absolute;
		inset: 6px 12px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
		border-radius: 4px;
	}

	.roll-cap-t { top: 0; }
	.roll-cap-b { bottom: 0; }

	/* Content */
	.scroll-content {
		position: absolute;
		inset: 0 44px;
		z-index: 2;
		padding: 2.5rem 4rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	/* Header */
	.header-bar {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.quest-label {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.label-ornament {
		font-family: 'Opsilon', serif;
		font-size: 2rem;
		color: #8b6914;
	}

	.quest-label .label-text {
		font-family: 'Opsilon', serif;
		font-size: 1.4rem;
		color: #6b5020;
		letter-spacing: 0.2em;
		text-transform: uppercase;
	}

	/* Title */
	.title-container {
		text-align: center;
		margin: 0.5rem 0;
	}

	.quest-title {
		font-family: 'Opsilon', serif;
		font-size: 2.6rem;
		color: #3a2810;
		margin: 0;
		line-height: 1.2;
	}

	.title-underline {
		height: 2px;
		background: linear-gradient(90deg, transparent, #a08050, transparent);
		margin-top: 0.8rem;
	}

	/* Description */
	.desc-area {
		flex: 1;
		background: rgba(255, 250, 240, 0.4);
		padding: 1.5rem;
		border-top: 2px solid rgba(139, 105, 20, 0.15);
		border-bottom: 2px solid rgba(139, 105, 20, 0.15);
	}

	.quest-description {
		font-family: 'Opsilon', serif;
		font-size: 1.7rem;
		color: #4a3820;
		margin: 0;
		line-height: 1.6;
		font-style: italic;
	}

	/* Reward display */
	.reward-display {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		margin-top: auto;
		padding-top: 1rem;
	}

	.reward-label .label-text {
		font-family: 'Opsilon', serif;
		font-size: 1.3rem;
		color: #6b5020;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.reward-divider {
		width: 2px;
		height: 40px;
		background: #a08050;
	}

	.reward-items {
		display: flex;
		gap: 0.8rem;
		flex-wrap: wrap;
		flex: 1;
	}

	.reward-box {
		width: 64px;
		height: 64px;
		background: linear-gradient(135deg, #4a3820, #3a2810);
		border: 2px solid #6b5020;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
	}

	.reward-box img {
		width: 40px;
		height: 40px;
		object-fit: contain;
		filter:
			drop-shadow(1px 0 0 #2b1a12)
			drop-shadow(-1px 0 0 #2b1a12)
			drop-shadow(0 1px 0 #2b1a12)
			drop-shadow(0 -1px 0 #2b1a12)
			drop-shadow(1px 1px 0 #2b1a12)
			drop-shadow(-1px 1px 0 #2b1a12)
			drop-shadow(1px -1px 0 #2b1a12)
			drop-shadow(-1px -1px 0 #2b1a12)
			drop-shadow(2px 0 0 #2b1a12)
			drop-shadow(-2px 0 0 #2b1a12)
			drop-shadow(0 2px 0 #2b1a12)
			drop-shadow(0 -2px 0 #2b1a12);
	}

	.box-fallback {
		font-size: 1.8rem;
		color: #a08050;
	}

	.reward-text {
		font-family: 'Opsilon', serif;
		font-size: 1.7rem;
		color: #3a2810;
	}

	.no-reward {
		font-family: 'Opsilon', serif;
		font-size: 1.6rem;
		color: rgba(58, 40, 16, 0.5);
		font-style: italic;
	}
</style>
