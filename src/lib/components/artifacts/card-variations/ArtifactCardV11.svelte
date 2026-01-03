<script lang="ts">
	/**
	 * V11: Enchanted Mirror
	 * Magical glass, reflective surface, ornate frame, mystical reflections
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="mirror-card">
	<div class="ornate-frame">
		<div class="frame-corner tl"></div>
		<div class="frame-corner tr"></div>
		<div class="frame-corner bl"></div>
		<div class="frame-corner br"></div>

		<div class="frame-accent top"></div>
		<div class="frame-accent bottom"></div>
	</div>

	<div class="mirror-surface">
		<div class="reflection-layer"></div>
		<div class="shimmer-effect"></div>
		<div class="mist-overlay"></div>

		<div class="mirror-content">
			<div class="mystical-eye">◎</div>

			<h2 class="artifact-name">{artifact.name}</h2>

			<div class="mirror-divider">
				<span class="sparkle">✧</span>
				<span class="line"></span>
				<span class="gem">◇</span>
				<span class="line"></span>
				<span class="sparkle">✧</span>
			</div>

			<p class="benefit">{artifact.benefit}</p>

			{#if recipeIcons.length > 0}
				<div class="recipe-row">
					{#each recipeIcons as icon, i (i)}
						<div class="mirror-socket">
							<img src={icon} alt="rune" class="rune-icon" />
						</div>
					{/each}
				</div>
			{/if}

			<div class="footer">
				{#if guardianName}
					<span class="guardian">✦ {guardianName}</span>
				{/if}
				{#if tagNames.length > 0}
					<span class="tags">{tagNames.join(' ✧ ')}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.mirror-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		filter: drop-shadow(0 4px 15px rgba(100, 80, 140, 0.4));
	}

	.ornate-frame {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			145deg,
			#c9a962 0%,
			#a08040 20%,
			#8a6d30 50%,
			#a08040 80%,
			#c9a962 100%
		);
		border-radius: 8px;
		padding: 8px;
		box-sizing: border-box;
	}

	.frame-corner {
		position: absolute;
		width: 20px;
		height: 20px;
		background: radial-gradient(circle at center, #e8d090 0%, #a08040 100%);
		border-radius: 50%;
		box-shadow:
			inset 0 1px 3px rgba(255, 255, 255, 0.5),
			0 2px 4px rgba(0, 0, 0, 0.3);
		z-index: 5;
	}

	.frame-corner.tl { top: 4px; left: 4px; }
	.frame-corner.tr { top: 4px; right: 4px; }
	.frame-corner.bl { bottom: 4px; left: 4px; }
	.frame-corner.br { bottom: 4px; right: 4px; }

	.frame-corner::after {
		content: '✦';
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		color: #6a5020;
	}

	.frame-accent {
		position: absolute;
		left: 30px;
		right: 30px;
		height: 6px;
		background: linear-gradient(
			90deg,
			transparent,
			#e8d090 30%,
			#fff8dc 50%,
			#e8d090 70%,
			transparent
		);
		border-radius: 3px;
	}

	.frame-accent.top { top: 9px; }
	.frame-accent.bottom { bottom: 9px; }

	.mirror-surface {
		position: absolute;
		inset: 12px;
		background: linear-gradient(
			160deg,
			#d8e8f8 0%,
			#c0d4ea 20%,
			#a8c0dc 50%,
			#b8d0e8 80%,
			#d0e4f4 100%
		);
		border-radius: 4px;
		overflow: hidden;
		box-shadow:
			inset 0 0 20px rgba(100, 80, 140, 0.2),
			inset 0 0 40px rgba(255, 255, 255, 0.3);
	}

	.reflection-layer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.4) 0%,
			transparent 40%,
			transparent 60%,
			rgba(255, 255, 255, 0.2) 100%
		);
		pointer-events: none;
	}

	.shimmer-effect {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 0%,
			rgba(255, 255, 255, 0.3) 50%,
			transparent 100%
		);
		animation: mirror-shimmer 4s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes mirror-shimmer {
		0%, 100% { transform: translateX(-100%); opacity: 0; }
		50% { transform: translateX(100%); opacity: 1; }
	}

	.mist-overlay {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at 50% 120%,
			rgba(180, 160, 200, 0.3) 0%,
			transparent 60%
		);
		pointer-events: none;
	}

	.mirror-content {
		position: absolute;
		inset: 10px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.mystical-eye {
		font-size: 22px;
		color: rgba(100, 80, 140, 0.6);
		text-shadow: 0 0 10px rgba(140, 120, 180, 0.5);
		margin-bottom: 2px;
		animation: eye-pulse 3s ease-in-out infinite;
	}

	@keyframes eye-pulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.1); }
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 600;
		color: #4a4060;
		margin: 0 0 6px 0;
		text-align: center;
		text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
		letter-spacing: 0.5px;
	}

	.mirror-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 6px;
		color: rgba(100, 80, 140, 0.6);
	}

	.sparkle {
		font-size: 10px;
		animation: sparkle-twinkle 2s ease-in-out infinite;
	}

	@keyframes sparkle-twinkle {
		0%, 100% { opacity: 0.5; }
		50% { opacity: 1; }
	}

	.line {
		flex: 1;
		max-width: 40px;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(100, 80, 140, 0.4), transparent);
	}

	.gem {
		font-size: 12px;
	}

	.benefit {
		font-size: 11px;
		color: #5a5070;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin: 8px 0;
	}

	.mirror-socket {
		width: 26px;
		height: 26px;
		background: rgba(255, 255, 255, 0.5);
		border: 2px solid rgba(160, 128, 64, 0.6);
		border-radius: 50%;
		padding: 2px;
		box-shadow:
			0 0 8px rgba(200, 180, 140, 0.4),
			inset 0 0 4px rgba(255, 255, 255, 0.5);
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
		color: rgba(80, 60, 100, 0.8);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(100, 80, 140, 0.2);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}
</style>
