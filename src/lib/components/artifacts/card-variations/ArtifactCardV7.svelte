<script lang="ts">
	/**
	 * V7: Celestial/Astral Theme
	 * Cosmic gradients, stars, constellations, ethereal moonlight, astral magic
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="celestial-card">
	<div class="cosmic-bg">
		<div class="nebula"></div>
		<div class="star-field">
			{#each Array(20) as _, i (i)}
				<span
					class="star"
					style="
						left: {Math.random() * 100}%;
						top: {Math.random() * 100}%;
						--delay: {Math.random() * 3}s;
						--size: {0.5 + Math.random() * 1.5}px;
					"
				></span>
			{/each}
		</div>
		<div class="constellation">
			<svg viewBox="0 0 100 100" class="constellation-svg">
				<line x1="20" y1="20" x2="40" y2="35" />
				<line x1="40" y1="35" x2="60" y2="25" />
				<line x1="60" y1="25" x2="80" y2="40" />
				<line x1="40" y1="35" x2="50" y2="60" />
				<circle cx="20" cy="20" r="2" />
				<circle cx="40" cy="35" r="2" />
				<circle cx="60" cy="25" r="2" />
				<circle cx="80" cy="40" r="2" />
				<circle cx="50" cy="60" r="2" />
			</svg>
		</div>
	</div>

	<div class="card-frame">
		<div class="moon-phase tl">☽</div>
		<div class="moon-phase tr">☾</div>

		<div class="inner-content">
			<div class="celestial-header">
				<span class="star-icon">✦</span>
				<h2 class="artifact-name">{artifact.name}</h2>
				<span class="star-icon">✦</span>
			</div>

			<div class="astral-divider">
				<span class="orbit-dot"></span>
				<span class="orbit-line"></span>
				<span class="sun-icon">☀</span>
				<span class="orbit-line"></span>
				<span class="orbit-dot"></span>
			</div>

			<p class="benefit">{artifact.benefit}</p>

			{#if recipeIcons.length > 0}
				<div class="recipe-row">
					{#each recipeIcons as icon, i (i)}
						<div class="star-socket">
							<img src={icon} alt="rune" class="rune-icon" />
						</div>
					{/each}
				</div>
			{/if}

			<div class="footer">
				{#if guardianName}
					<span class="guardian">⋆ {guardianName}</span>
				{/if}
				{#if tagNames.length > 0}
					<span class="tags">{tagNames.join(' ✧ ')}</span>
				{/if}
			</div>
		</div>
	</div>

	<div class="glow-ring"></div>
</div>

<style>
	.celestial-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		border-radius: 8px;
		overflow: hidden;
	}

	.cosmic-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			160deg,
			#0a0520 0%,
			#150a30 25%,
			#1a1040 50%,
			#0f0825 75%,
			#050210 100%
		);
	}

	.nebula {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 30%, rgba(100, 50, 150, 0.2) 0%, transparent 50%),
			radial-gradient(ellipse at 80% 70%, rgba(50, 100, 180, 0.15) 0%, transparent 40%),
			radial-gradient(ellipse at 60% 20%, rgba(180, 100, 150, 0.1) 0%, transparent 30%);
		pointer-events: none;
	}

	.star-field {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.star {
		position: absolute;
		width: var(--size);
		height: var(--size);
		background: white;
		border-radius: 50%;
		animation: twinkle 2s ease-in-out infinite;
		animation-delay: var(--delay);
		box-shadow: 0 0 4px rgba(255, 255, 255, 0.5);
	}

	@keyframes twinkle {
		0%, 100% { opacity: 0.4; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.3); }
	}

	.constellation {
		position: absolute;
		top: 10px;
		right: 10px;
		width: 80px;
		height: 60px;
		opacity: 0.3;
	}

	.constellation-svg {
		width: 100%;
		height: 100%;
	}

	.constellation-svg line {
		stroke: rgba(200, 180, 255, 0.5);
		stroke-width: 0.5;
	}

	.constellation-svg circle {
		fill: rgba(200, 180, 255, 0.8);
	}

	.card-frame {
		position: absolute;
		inset: 6px;
		border: 1px solid rgba(180, 160, 220, 0.3);
		border-radius: 6px;
		background: rgba(20, 15, 40, 0.6);
		backdrop-filter: blur(2px);
		padding: 10px 16px;
		display: flex;
		flex-direction: column;
	}

	.moon-phase {
		position: absolute;
		font-size: 18px;
		color: rgba(220, 200, 255, 0.4);
		text-shadow: 0 0 10px rgba(200, 180, 255, 0.3);
	}

	.moon-phase.tl { top: 8px; left: 12px; }
	.moon-phase.tr { top: 8px; right: 12px; }

	.inner-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding-top: 20px;
	}

	.celestial-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 6px;
	}

	.star-icon {
		color: rgba(255, 220, 150, 0.7);
		font-size: 12px;
		animation: pulse-star 3s ease-in-out infinite;
	}

	@keyframes pulse-star {
		0%, 100% { opacity: 0.7; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 600;
		background: linear-gradient(
			180deg,
			#ffffff 0%,
			#d4c8f0 50%,
			#a090d0 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0;
		text-align: center;
		letter-spacing: 1px;
	}

	.astral-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 10px;
	}

	.orbit-dot {
		width: 4px;
		height: 4px;
		background: rgba(200, 180, 255, 0.6);
		border-radius: 50%;
	}

	.orbit-line {
		flex: 1;
		max-width: 40px;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(180, 160, 220, 0.5),
			transparent
		);
	}

	.sun-icon {
		font-size: 14px;
		color: rgba(255, 220, 150, 0.8);
		text-shadow: 0 0 12px rgba(255, 200, 100, 0.6);
	}

	.benefit {
		font-size: 11px;
		color: #c8c0e0;
		text-align: center;
		line-height: 1.45;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 10px 0;
	}

	.star-socket {
		width: 26px;
		height: 26px;
		background: rgba(40, 30, 80, 0.6);
		border: 1px solid rgba(180, 160, 220, 0.4);
		clip-path: polygon(
			50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%
		);
		padding: 4px;
		box-shadow: 0 0 10px rgba(150, 130, 200, 0.3);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		object-fit: cover;
		clip-path: polygon(
			50% 5%, 59% 36%, 95% 36%, 67% 56%, 77% 88%, 50% 68%, 23% 88%, 33% 56%, 5% 36%, 41% 36%
		);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: rgba(200, 190, 230, 0.8);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(180, 160, 220, 0.2);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}

	.glow-ring {
		position: absolute;
		inset: -5px;
		border-radius: 12px;
		background: radial-gradient(
			ellipse at center,
			transparent 60%,
			rgba(150, 130, 200, 0.1) 80%,
			rgba(100, 80, 180, 0.15) 100%
		);
		pointer-events: none;
		animation: ring-pulse 4s ease-in-out infinite;
	}

	@keyframes ring-pulse {
		0%, 100% { opacity: 0.5; }
		50% { opacity: 1; }
	}
</style>
