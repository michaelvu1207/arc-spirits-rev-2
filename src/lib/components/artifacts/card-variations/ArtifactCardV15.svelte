<script lang="ts">
	/**
	 * V15: Ocean/Aquatic Theme
	 * Waves, shells, coral, deep sea blues, maritime magic
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="ocean-card">
	<div class="water-layer"></div>
	<div class="wave-pattern"></div>
	<div class="bubbles">
		{#each Array(8) as _, i (i)}
			<span
				class="bubble"
				style="
					left: {10 + Math.random() * 80}%;
					--delay: {Math.random() * 3}s;
					--size: {3 + Math.random() * 5}px;
				"
			></span>
		{/each}
	</div>

	<div class="shell-border">
		<span class="shell tl">🐚</span>
		<span class="shell tr">🐚</span>
		<span class="coral bl">🪸</span>
		<span class="coral br">🪸</span>
	</div>

	<div class="ocean-content">
		<div class="trident-header">
			<span class="trident">🔱</span>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="wave-divider">
			<span class="droplet">💧</span>
			<span class="wave-line">〰</span>
			<span class="pearl">◉</span>
			<span class="wave-line">〰</span>
			<span class="droplet">💧</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="pearl-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">⚓ {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' 🌊 ')}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.ocean-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			180deg,
			#0a2540 0%,
			#0f3050 25%,
			#1a4060 50%,
			#0f3050 75%,
			#082030 100%
		);
		border-radius: 8px;
		overflow: hidden;
		box-shadow:
			0 0 25px rgba(0, 100, 150, 0.4),
			inset 0 0 40px rgba(0, 150, 200, 0.1);
	}

	.water-layer {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at 50% 0%,
			rgba(100, 200, 255, 0.15) 0%,
			transparent 50%
		);
		pointer-events: none;
	}

	.wave-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.08;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q25 0 50 10 T100 10' stroke='%2380c0e0' stroke-width='1' fill='none'/%3E%3C/svg%3E");
		background-size: 60px 15px;
		animation: wave-drift 8s linear infinite;
		pointer-events: none;
	}

	@keyframes wave-drift {
		0% { background-position: 0 0; }
		100% { background-position: 60px 0; }
	}

	.bubbles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.bubble {
		position: absolute;
		bottom: -10px;
		width: var(--size);
		height: var(--size);
		background: radial-gradient(
			circle at 30% 30%,
			rgba(200, 240, 255, 0.8) 0%,
			rgba(100, 180, 220, 0.4) 100%
		);
		border-radius: 50%;
		animation: bubble-rise 4s ease-in-out infinite;
		animation-delay: var(--delay);
	}

	@keyframes bubble-rise {
		0% { transform: translateY(0) scale(1); opacity: 0.8; }
		100% { transform: translateY(-220px) scale(0.5); opacity: 0; }
	}

	.shell-border {
		position: absolute;
		inset: 8px;
	}

	.shell, .coral {
		position: absolute;
		font-size: 18px;
	}

	.shell.tl { top: 0; left: 4px; transform: rotate(-20deg); }
	.shell.tr { top: 0; right: 4px; transform: rotate(20deg) scaleX(-1); }
	.coral.bl { bottom: 0; left: 4px; }
	.coral.br { bottom: 0; right: 4px; transform: scaleX(-1); }

	.ocean-content {
		position: absolute;
		inset: 20px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.trident-header {
		margin-bottom: 2px;
	}

	.trident {
		font-size: 24px;
		animation: trident-glow 3s ease-in-out infinite;
	}

	@keyframes trident-glow {
		0%, 100% { filter: drop-shadow(0 0 4px rgba(100, 200, 255, 0.4)); }
		50% { filter: drop-shadow(0 0 12px rgba(100, 200, 255, 0.8)); }
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 600;
		background: linear-gradient(
			180deg,
			#ffffff 0%,
			#a0d8f0 50%,
			#60a0c0 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0 0 6px 0;
		text-align: center;
		letter-spacing: 0.5px;
	}

	.wave-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-bottom: 8px;
		color: rgba(100, 180, 220, 0.8);
	}

	.droplet {
		font-size: 10px;
	}

	.wave-line {
		font-size: 16px;
		opacity: 0.6;
	}

	.pearl {
		font-size: 10px;
		color: rgba(220, 240, 255, 0.9);
		text-shadow: 0 0 6px rgba(200, 230, 255, 0.6);
	}

	.benefit {
		font-size: 11px;
		color: #a0d0e8;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 8px 0;
	}

	.pearl-socket {
		width: 26px;
		height: 26px;
		background: linear-gradient(
			135deg,
			rgba(220, 240, 255, 0.6) 0%,
			rgba(180, 220, 240, 0.4) 50%,
			rgba(200, 230, 250, 0.6) 100%
		);
		border: 2px solid rgba(150, 200, 230, 0.5);
		border-radius: 50%;
		padding: 2px;
		box-shadow:
			0 0 10px rgba(100, 180, 220, 0.4),
			inset 0 0 8px rgba(255, 255, 255, 0.4);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		width: 100%;
		font-size: 9px;
		color: rgba(160, 210, 240, 0.9);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(100, 180, 220, 0.3);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.9;
	}
</style>
