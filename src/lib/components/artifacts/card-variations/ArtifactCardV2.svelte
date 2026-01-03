<script lang="ts">
	/**
	 * V2: Ornate Gilded Frame
	 * Luxurious gold frame with gemstone corners, metallic gradients, embossed patterns
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="gilded-card">
	<div class="outer-frame">
		<div class="gem-corner tl"><div class="gem"></div></div>
		<div class="gem-corner tr"><div class="gem"></div></div>
		<div class="gem-corner bl"><div class="gem"></div></div>
		<div class="gem-corner br"><div class="gem"></div></div>

		<div class="frame-edge top"></div>
		<div class="frame-edge right"></div>
		<div class="frame-edge bottom"></div>
		<div class="frame-edge left"></div>

		<div class="inner-panel">
			<div class="filigree-pattern"></div>

			<div class="name-plate">
				<div class="plate-wing left"></div>
				<h2 class="artifact-name">{artifact.name}</h2>
				<div class="plate-wing right"></div>
			</div>

			<div class="content-area">
				<p class="benefit">{artifact.benefit}</p>

				{#if recipeIcons.length > 0}
					<div class="recipe-row">
						{#each recipeIcons as icon, i (i)}
							<div class="rune-setting">
								<img src={icon} alt="rune" class="rune-icon" />
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="footer-bar">
				{#if guardianName}
					<span class="guardian">⚜ {guardianName}</span>
				{/if}
				{#if tagNames.length > 0}
					<span class="tags">{tagNames.join(' ✧ ')}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.gilded-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.5));
	}

	.outer-frame {
		width: 100%;
		height: 100%;
		background: linear-gradient(145deg, #2a1810 0%, #1a0f08 50%, #2a1810 100%);
		border-radius: 6px;
		position: relative;
		padding: 10px;
		box-sizing: border-box;
	}

	.gem-corner {
		position: absolute;
		width: 24px;
		height: 24px;
		z-index: 10;
	}

	.gem-corner.tl { top: 3px; left: 3px; }
	.gem-corner.tr { top: 3px; right: 3px; }
	.gem-corner.bl { bottom: 3px; left: 3px; }
	.gem-corner.br { bottom: 3px; right: 3px; }

	.gem {
		width: 18px;
		height: 18px;
		margin: 3px;
		background: radial-gradient(ellipse at 30% 30%, #ff6b6b 0%, #c41e3a 40%, #8b0000 70%, #5c0000 100%);
		clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
		box-shadow:
			inset 0 0 8px rgba(255, 200, 200, 0.5),
			0 0 10px rgba(196, 30, 58, 0.6);
		animation: gem-sparkle 3s ease-in-out infinite;
	}

	@keyframes gem-sparkle {
		0%, 100% { filter: brightness(1); }
		50% { filter: brightness(1.3); }
	}

	.frame-edge {
		position: absolute;
		background: linear-gradient(
			90deg,
			#8b6914 0%,
			#d4a424 15%,
			#f5d54a 30%,
			#fff8dc 50%,
			#f5d54a 70%,
			#d4a424 85%,
			#8b6914 100%
		);
	}

	.frame-edge.top,
	.frame-edge.bottom {
		height: 8px;
		left: 24px;
		right: 24px;
	}

	.frame-edge.top {
		top: 4px;
		border-radius: 4px 4px 0 0;
	}

	.frame-edge.bottom {
		bottom: 4px;
		border-radius: 0 0 4px 4px;
	}

	.frame-edge.left,
	.frame-edge.right {
		width: 8px;
		top: 24px;
		bottom: 24px;
		background: linear-gradient(
			180deg,
			#8b6914 0%,
			#d4a424 15%,
			#f5d54a 30%,
			#fff8dc 50%,
			#f5d54a 70%,
			#d4a424 85%,
			#8b6914 100%
		);
	}

	.frame-edge.left {
		left: 4px;
		border-radius: 4px 0 0 4px;
	}

	.frame-edge.right {
		right: 4px;
		border-radius: 0 4px 4px 0;
	}

	.inner-panel {
		width: 100%;
		height: 100%;
		background: linear-gradient(180deg, #1e0a04 0%, #2d1208 30%, #3d180c 70%, #2d1208 100%);
		border-radius: 4px;
		border: 2px solid #8b6914;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	.filigree-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.08;
		background-image: repeating-linear-gradient(
				45deg,
				transparent,
				transparent 10px,
				#d4a424 10px,
				#d4a424 11px
			),
			repeating-linear-gradient(
				-45deg,
				transparent,
				transparent 10px,
				#d4a424 10px,
				#d4a424 11px
			);
		pointer-events: none;
	}

	.name-plate {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 10px 16px 6px;
		gap: 8px;
	}

	.plate-wing {
		flex: 1;
		height: 2px;
		background: linear-gradient(90deg, transparent, #d4a424, transparent);
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 700;
		background: linear-gradient(180deg, #fff8dc 0%, #d4a424 50%, #8b6914 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
		margin: 0;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
	}

	.content-area {
		flex: 1;
		padding: 6px 16px;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.benefit {
		font-size: 11px;
		color: #e8d4b0;
		text-align: center;
		line-height: 1.45;
		margin: 0 0 8px 0;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 8px;
	}

	.rune-setting {
		width: 28px;
		height: 28px;
		background: linear-gradient(145deg, #d4a424 0%, #8b6914 100%);
		border-radius: 4px;
		padding: 2px;
		box-shadow:
			inset 0 1px 2px rgba(255, 255, 255, 0.3),
			0 2px 4px rgba(0, 0, 0, 0.4);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 2px;
		object-fit: cover;
	}

	.footer-bar {
		display: flex;
		justify-content: space-between;
		padding: 6px 14px 8px;
		font-size: 9px;
		color: #d4a424;
		border-top: 1px solid rgba(212, 164, 36, 0.3);
		background: linear-gradient(180deg, transparent 0%, rgba(139, 105, 20, 0.1) 100%);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}
</style>
