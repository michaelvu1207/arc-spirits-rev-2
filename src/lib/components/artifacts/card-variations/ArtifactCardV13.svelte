<script lang="ts">
	/**
	 * V13: Fairy/Fey Theme
	 * Sparkles, butterfly wings, ethereal pastels, whimsical magic
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="fairy-card">
	<div class="wing-pattern left"></div>
	<div class="wing-pattern right"></div>
	<div class="sparkle-field">
		{#each Array(12) as _, i (i)}
			<span
				class="sparkle"
				style="
					left: {10 + Math.random() * 80}%;
					top: {10 + Math.random() * 80}%;
					--delay: {Math.random() * 2}s;
					--size: {4 + Math.random() * 4}px;
				"
			>✦</span>
		{/each}
	</div>

	<div class="fairy-content">
		<div class="petal-border"></div>

		<div class="fairy-header">
			<span class="wing-icon left">❦</span>
			<div class="fairy-dust">✧</div>
			<span class="wing-icon right">❦</span>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="petal-divider">
			<span class="petal">❀</span>
			<span class="vine">~</span>
			<span class="petal">✿</span>
			<span class="vine">~</span>
			<span class="petal">❀</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="dewdrop-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">🦋 {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ❋ ')}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.fairy-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			160deg,
			#fef0f5 0%,
			#f0e8f8 30%,
			#e8f0ff 60%,
			#f0f8f0 100%
		);
		border-radius: 16px;
		overflow: hidden;
		box-shadow:
			0 0 20px rgba(255, 180, 220, 0.4),
			0 0 40px rgba(180, 200, 255, 0.2);
	}

	.wing-pattern {
		position: absolute;
		top: 10px;
		width: 40px;
		height: 60px;
		opacity: 0.15;
		background: radial-gradient(
			ellipse,
			rgba(200, 150, 220, 0.8) 0%,
			rgba(180, 200, 255, 0.4) 50%,
			transparent 70%
		);
	}

	.wing-pattern.left {
		left: 10px;
		transform: rotate(-15deg);
	}

	.wing-pattern.right {
		right: 10px;
		transform: rotate(15deg) scaleX(-1);
	}

	.sparkle-field {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.sparkle {
		position: absolute;
		font-size: var(--size);
		color: rgba(255, 200, 240, 0.8);
		animation: sparkle-float 3s ease-in-out infinite;
		animation-delay: var(--delay);
		text-shadow: 0 0 6px rgba(255, 180, 220, 0.8);
	}

	@keyframes sparkle-float {
		0%, 100% { opacity: 0.3; transform: scale(0.8) translateY(0); }
		50% { opacity: 1; transform: scale(1.2) translateY(-5px); }
	}

	.fairy-content {
		position: absolute;
		inset: 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.petal-border {
		position: absolute;
		inset: 0;
		border: 2px solid rgba(220, 180, 220, 0.4);
		border-radius: 12px;
		pointer-events: none;
	}

	.fairy-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 4px;
	}

	.wing-icon {
		font-size: 16px;
		color: rgba(200, 150, 200, 0.6);
	}

	.wing-icon.right {
		transform: scaleX(-1);
	}

	.fairy-dust {
		font-size: 20px;
		color: rgba(255, 200, 100, 0.8);
		text-shadow: 0 0 10px rgba(255, 200, 100, 0.6);
		animation: dust-glow 2s ease-in-out infinite;
	}

	@keyframes dust-glow {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 600;
		background: linear-gradient(
			180deg,
			#c080c0 0%,
			#a080c0 50%,
			#8080c0 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0 0 6px 0;
		text-align: center;
		letter-spacing: 0.5px;
	}

	.petal-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-bottom: 8px;
		color: rgba(200, 150, 200, 0.7);
	}

	.petal {
		font-size: 12px;
	}

	.vine {
		font-size: 14px;
		color: rgba(150, 200, 150, 0.6);
	}

	.benefit {
		font-size: 11px;
		color: #8a7a9a;
		text-align: center;
		line-height: 1.45;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 8px 0;
	}

	.dewdrop-socket {
		width: 26px;
		height: 26px;
		background: linear-gradient(
			180deg,
			rgba(255, 255, 255, 0.8) 0%,
			rgba(220, 240, 255, 0.6) 100%
		);
		border: 2px solid rgba(200, 180, 220, 0.5);
		border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
		padding: 2px;
		box-shadow:
			0 0 8px rgba(200, 180, 255, 0.4),
			inset 0 -2px 4px rgba(255, 255, 255, 0.8);
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
		color: rgba(160, 130, 180, 0.9);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(200, 180, 220, 0.3);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.9;
	}
</style>
