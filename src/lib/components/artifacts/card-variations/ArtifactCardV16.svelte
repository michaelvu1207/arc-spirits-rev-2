<script lang="ts">
	/**
	 * V16: Phoenix/Rebirth Theme
	 * Feathers, ash, golden flames, rising motif, renewal magic
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="phoenix-card">
	<div class="ash-layer"></div>
	<div class="ember-field">
		{#each Array(10) as _, i (i)}
			<span
				class="ember"
				style="
					left: {10 + Math.random() * 80}%;
					--delay: {Math.random() * 2}s;
					--drift: {-10 + Math.random() * 20}px;
				"
			></span>
		{/each}
	</div>
	<div class="flame-glow"></div>

	<div class="feather-border">
		<div class="feather left">🪶</div>
		<div class="feather right">🪶</div>
	</div>

	<div class="phoenix-content">
		<div class="phoenix-header">
			<div class="rising-wings">
				<span class="wing left">༄</span>
				<span class="sun">☀</span>
				<span class="wing right">༄</span>
			</div>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="flame-divider">
			<span class="spark">✧</span>
			<span class="fire-line"></span>
			<span class="phoenix-eye">◉</span>
			<span class="fire-line"></span>
			<span class="spark">✧</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="flame-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">🔥 {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ✦ ')}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.phoenix-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			180deg,
			#1a0a05 0%,
			#2d1208 20%,
			#3d1810 50%,
			#2d1208 80%,
			#1a0a05 100%
		);
		border-radius: 6px;
		overflow: hidden;
		box-shadow:
			0 0 30px rgba(255, 100, 0, 0.3),
			0 0 60px rgba(255, 180, 0, 0.1),
			inset 0 0 40px rgba(255, 80, 0, 0.1);
	}

	.ash-layer {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 50% 100%, rgba(60, 60, 60, 0.2) 0%, transparent 50%);
		pointer-events: none;
	}

	.ember-field {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.ember {
		position: absolute;
		bottom: 20%;
		width: 4px;
		height: 4px;
		background: radial-gradient(
			circle,
			#ffcc00 0%,
			#ff8800 50%,
			#ff4400 100%
		);
		border-radius: 50%;
		animation: ember-rise 3s ease-out infinite;
		animation-delay: var(--delay);
	}

	@keyframes ember-rise {
		0% {
			transform: translateY(0) translateX(0) scale(1);
			opacity: 1;
		}
		100% {
			transform: translateY(-180px) translateX(var(--drift)) scale(0);
			opacity: 0;
		}
	}

	.flame-glow {
		position: absolute;
		bottom: -40px;
		left: 50%;
		transform: translateX(-50%);
		width: 200px;
		height: 120px;
		background: radial-gradient(
			ellipse,
			rgba(255, 150, 50, 0.25) 0%,
			rgba(255, 100, 0, 0.15) 40%,
			transparent 70%
		);
		animation: flame-dance 2s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes flame-dance {
		0%, 100% { opacity: 0.8; transform: translateX(-50%) scaleY(1); }
		50% { opacity: 1; transform: translateX(-50%) scaleY(1.1); }
	}

	.feather-border {
		position: absolute;
		inset: 8px;
	}

	.feather {
		position: absolute;
		font-size: 24px;
		top: 50%;
		transform: translateY(-50%);
		filter: sepia(1) saturate(3) hue-rotate(-10deg);
		opacity: 0.4;
	}

	.feather.left { left: 2px; transform: translateY(-50%) rotate(-15deg); }
	.feather.right { right: 2px; transform: translateY(-50%) rotate(15deg) scaleX(-1); }

	.phoenix-content {
		position: absolute;
		inset: 14px 24px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.phoenix-header {
		margin-bottom: 4px;
	}

	.rising-wings {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.wing {
		font-size: 18px;
		color: #ffaa40;
		text-shadow: 0 0 8px rgba(255, 150, 50, 0.6);
	}

	.wing.left { transform: scaleX(-1); }

	.sun {
		font-size: 22px;
		animation: sun-pulse 2s ease-in-out infinite;
		filter: drop-shadow(0 0 10px rgba(255, 200, 50, 0.8));
	}

	@keyframes sun-pulse {
		0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(255, 200, 50, 0.8)); }
		50% { transform: scale(1.1); filter: drop-shadow(0 0 20px rgba(255, 200, 50, 1)); }
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 700;
		background: linear-gradient(
			180deg,
			#fff8e0 0%,
			#ffc040 30%,
			#ff8020 70%,
			#cc4010 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0 0 6px 0;
		text-align: center;
		letter-spacing: 1px;
	}

	.flame-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.spark {
		font-size: 10px;
		color: #ffc060;
		animation: spark-flicker 1s ease-in-out infinite;
	}

	@keyframes spark-flicker {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}

	.fire-line {
		flex: 1;
		max-width: 40px;
		height: 3px;
		background: linear-gradient(
			90deg,
			transparent,
			#ff8040 30%,
			#ffc060 50%,
			#ff8040 70%,
			transparent
		);
		border-radius: 2px;
	}

	.phoenix-eye {
		font-size: 12px;
		color: #ff6020;
		text-shadow: 0 0 8px rgba(255, 100, 0, 0.8);
		animation: eye-burn 2s ease-in-out infinite;
	}

	@keyframes eye-burn {
		0%, 100% { color: #ff6020; text-shadow: 0 0 8px rgba(255, 100, 0, 0.8); }
		50% { color: #ffc060; text-shadow: 0 0 12px rgba(255, 200, 100, 1); }
	}

	.benefit {
		font-size: 11px;
		color: #e0c0a0;
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

	.flame-socket {
		width: 26px;
		height: 26px;
		background: linear-gradient(
			180deg,
			rgba(255, 180, 80, 0.3) 0%,
			rgba(255, 100, 40, 0.2) 100%
		);
		border: 2px solid rgba(255, 150, 60, 0.5);
		clip-path: polygon(
			50% 0%, 80% 20%, 100% 50%, 80% 80%, 50% 100%, 20% 80%, 0% 50%, 20% 20%
		);
		padding: 3px;
		box-shadow: 0 0 10px rgba(255, 100, 0, 0.4);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		object-fit: cover;
		clip-path: polygon(
			50% 5%, 78% 22%, 95% 50%, 78% 78%, 50% 95%, 22% 78%, 5% 50%, 22% 22%
		);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		width: 100%;
		font-size: 9px;
		color: rgba(255, 180, 120, 0.9);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(255, 150, 60, 0.3);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.9;
	}
</style>
