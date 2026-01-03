<script lang="ts">
	/**
	 * V8: Dragon Scale Pattern
	 * Fiery accents, claw marks, scale texture, draconic power
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="dragon-card">
	<div class="scale-layer"></div>
	<div class="fire-glow"></div>

	<div class="claw-marks">
		<div class="claw claw-1"></div>
		<div class="claw claw-2"></div>
		<div class="claw claw-3"></div>
	</div>

	<div class="card-content">
		<div class="corner-fang tl">◢</div>
		<div class="corner-fang tr">◣</div>
		<div class="corner-fang bl">◥</div>
		<div class="corner-fang br">◤</div>

		<div class="dragon-header">
			<span class="flame">🔥</span>
			<h2 class="artifact-name">{artifact.name}</h2>
			<span class="flame">🔥</span>
		</div>

		<div class="fire-divider">
			<span class="ember">◆</span>
			<span class="flame-bar"></span>
			<span class="dragon-eye">◉</span>
			<span class="flame-bar"></span>
			<span class="ember">◆</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="scale-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">🐉 {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ⬥ ')}</span>
			{/if}
		</div>
	</div>

	<div class="heat-shimmer"></div>
</div>

<style>
	.dragon-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			160deg,
			#1a0a0a 0%,
			#2d1010 25%,
			#3a1515 50%,
			#2d1010 75%,
			#1a0a0a 100%
		);
		border-radius: 4px;
		overflow: hidden;
		box-shadow:
			0 0 30px rgba(255, 80, 0, 0.3),
			inset 0 0 40px rgba(255, 50, 0, 0.1);
	}

	.scale-layer {
		position: absolute;
		inset: 0;
		opacity: 0.15;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 30 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cellipse cx='15' cy='10' rx='14' ry='9' stroke='%23ff6030' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
		background-size: 25px 18px;
		background-position: 0 0, 12.5px 9px;
		pointer-events: none;
	}

	.fire-glow {
		position: absolute;
		bottom: -30px;
		left: 50%;
		transform: translateX(-50%);
		width: 200px;
		height: 100px;
		background: radial-gradient(
			ellipse,
			rgba(255, 100, 0, 0.25) 0%,
			rgba(255, 60, 0, 0.15) 40%,
			transparent 70%
		);
		animation: fire-flicker 2s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes fire-flicker {
		0%, 100% { opacity: 0.8; transform: translateX(-50%) scaleY(1); }
		50% { opacity: 1; transform: translateX(-50%) scaleY(1.1); }
	}

	.claw-marks {
		position: absolute;
		top: 15px;
		right: 20px;
		width: 40px;
		height: 50px;
		opacity: 0.25;
	}

	.claw {
		position: absolute;
		width: 3px;
		height: 35px;
		background: linear-gradient(
			to bottom,
			rgba(80, 30, 30, 0.8) 0%,
			rgba(60, 20, 20, 0.4) 100%
		);
		border-radius: 2px;
		transform: rotate(15deg);
	}

	.claw-1 { left: 0; top: 0; }
	.claw-2 { left: 12px; top: 4px; height: 38px; }
	.claw-3 { left: 24px; top: 2px; height: 32px; }

	.card-content {
		position: absolute;
		inset: 8px;
		background: linear-gradient(
			180deg,
			rgba(30, 15, 15, 0.9) 0%,
			rgba(40, 20, 20, 0.85) 50%,
			rgba(30, 15, 15, 0.9) 100%
		);
		border: 2px solid rgba(255, 100, 50, 0.4);
		border-radius: 4px;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.corner-fang {
		position: absolute;
		font-size: 14px;
		color: rgba(255, 100, 50, 0.5);
	}

	.corner-fang.tl { top: 2px; left: 4px; }
	.corner-fang.tr { top: 2px; right: 4px; }
	.corner-fang.bl { bottom: 2px; left: 4px; }
	.corner-fang.br { bottom: 2px; right: 4px; }

	.dragon-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 6px;
	}

	.flame {
		font-size: 14px;
		filter: brightness(1.2);
		animation: flame-dance 1s ease-in-out infinite alternate;
	}

	@keyframes flame-dance {
		0% { transform: scale(1) rotate(-5deg); }
		100% { transform: scale(1.1) rotate(5deg); }
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 700;
		background: linear-gradient(
			180deg,
			#ffd080 0%,
			#ff8040 50%,
			#cc4020 100%
		);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.fire-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.ember {
		font-size: 8px;
		color: #ff6030;
		animation: ember-glow 1.5s ease-in-out infinite;
	}

	@keyframes ember-glow {
		0%, 100% { opacity: 0.6; text-shadow: none; }
		50% { opacity: 1; text-shadow: 0 0 8px rgba(255, 100, 50, 0.8); }
	}

	.flame-bar {
		flex: 1;
		max-width: 35px;
		height: 3px;
		background: linear-gradient(
			90deg,
			transparent,
			#ff6030 30%,
			#ff9040 50%,
			#ff6030 70%,
			transparent
		);
		border-radius: 1px;
	}

	.dragon-eye {
		font-size: 12px;
		color: #ff4020;
		text-shadow: 0 0 10px rgba(255, 80, 0, 0.8);
		animation: eye-glow 3s ease-in-out infinite;
	}

	@keyframes eye-glow {
		0%, 100% { opacity: 0.8; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.15); }
	}

	.benefit {
		font-size: 11px;
		color: #d8a080;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 10px 0;
	}

	.scale-socket {
		width: 28px;
		height: 28px;
		background: linear-gradient(145deg, #4a2020 0%, #2a1010 100%);
		border: 2px solid rgba(255, 100, 50, 0.5);
		clip-path: polygon(
			50% 0%, 90% 25%, 90% 75%, 50% 100%, 10% 75%, 10% 25%
		);
		padding: 3px;
		box-shadow:
			0 0 10px rgba(255, 80, 0, 0.3),
			inset 0 0 6px rgba(255, 100, 50, 0.2);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		object-fit: cover;
		clip-path: polygon(
			50% 5%, 85% 27%, 85% 73%, 50% 95%, 15% 73%, 15% 27%
		);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: rgba(255, 160, 100, 0.8);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(255, 100, 50, 0.2);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}

	.heat-shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			transparent 0%,
			rgba(255, 100, 0, 0.02) 50%,
			transparent 100%
		);
		animation: shimmer-wave 3s linear infinite;
		pointer-events: none;
	}

	@keyframes shimmer-wave {
		0% { transform: translateY(100%); }
		100% { transform: translateY(-100%); }
	}
</style>
