<script lang="ts">
	/**
	 * V18: Radial/Circular Layout
	 * Name in center medallion, runes orbit around, info in arc segments
	 * Mystical compass-like design
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="radial-card">
	<div class="outer-ring"></div>
	<div class="compass-lines">
		<div class="line n"></div>
		<div class="line e"></div>
		<div class="line s"></div>
		<div class="line w"></div>
	</div>

	<!-- Orbiting runes -->
	<div class="rune-orbit">
		{#if recipeIcons.length > 0}
			{#each recipeIcons as icon, i (i)}
				<div
					class="orbit-rune"
					style="--angle: {-60 + i * 40}deg; --delay: {i * 0.2}s"
				>
					<img src={icon} alt="rune" class="rune-icon" />
				</div>
			{/each}
		{/if}
	</div>

	<!-- Center medallion -->
	<div class="center-medallion">
		<div class="medallion-ring"></div>
		<div class="medallion-inner">
			<span class="center-sigil">✦</span>
			<h2 class="artifact-name">{artifact.name}</h2>
		</div>
	</div>

	<!-- Benefit arc at bottom -->
	<div class="info-arc bottom">
		<p class="benefit">{artifact.benefit}</p>
	</div>

	<!-- Top arc with tags/guardian -->
	<div class="info-arc top">
		{#if guardianName}
			<span class="guardian">{guardianName}</span>
		{/if}
		{#if tagNames.length > 0}
			<span class="tags">{tagNames.join(' ◆ ')}</span>
		{/if}
	</div>

	<!-- Corner accents -->
	<div class="corner-glyph tl">⌜</div>
	<div class="corner-glyph tr">⌝</div>
	<div class="corner-glyph bl">⌞</div>
	<div class="corner-glyph br">⌟</div>
</div>

<style>
	.radial-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: radial-gradient(ellipse at center, #1e1a28 0%, #0f0c14 100%);
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
	}

	.outer-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 180px;
		height: 180px;
		transform: translate(-50%, -50%);
		border: 1px solid rgba(200, 180, 140, 0.2);
		border-radius: 50%;
		box-shadow: 0 0 20px rgba(200, 180, 140, 0.1);
	}

	.compass-lines {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
	}

	.line {
		position: absolute;
		width: 1px;
		height: 90px;
		background: linear-gradient(to bottom, transparent, rgba(200, 180, 140, 0.3), transparent);
		transform-origin: center bottom;
	}

	.line.n { transform: translateX(-0.5px) translateY(-90px); }
	.line.s { transform: translateX(-0.5px) rotate(180deg) translateY(-90px); }
	.line.e { transform: translateY(-45px) rotate(90deg); }
	.line.w { transform: translateY(-45px) rotate(-90deg); }

	.rune-orbit {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 160px;
		height: 160px;
		transform: translate(-50%, -50%);
	}

	.orbit-rune {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 28px;
		height: 28px;
		transform: translate(-50%, -50%) rotate(var(--angle)) translateY(-70px) rotate(calc(-1 * var(--angle)));
		background: rgba(30, 26, 40, 0.9);
		border: 2px solid rgba(200, 180, 140, 0.5);
		border-radius: 50%;
		padding: 2px;
		box-shadow: 0 0 10px rgba(200, 180, 140, 0.3);
		animation: orbit-pulse 3s ease-in-out infinite;
		animation-delay: var(--delay);
	}

	@keyframes orbit-pulse {
		0%, 100% { box-shadow: 0 0 10px rgba(200, 180, 140, 0.3); }
		50% { box-shadow: 0 0 20px rgba(200, 180, 140, 0.6); }
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.center-medallion {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100px;
		height: 100px;
	}

	.medallion-ring {
		position: absolute;
		inset: 0;
		border: 2px solid rgba(200, 180, 140, 0.4);
		border-radius: 50%;
		background: radial-gradient(ellipse at center, rgba(40, 35, 55, 0.95) 0%, rgba(25, 22, 35, 0.98) 100%);
	}

	.medallion-inner {
		position: absolute;
		inset: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}

	.center-sigil {
		font-size: 14px;
		color: #d4c4a0;
		margin-bottom: 2px;
	}

	.artifact-name {
		font-size: 12px;
		font-weight: 700;
		color: #e8dcc8;
		margin: 0;
		line-height: 1.2;
		text-shadow: 0 0 10px rgba(200, 180, 140, 0.4);
	}

	.info-arc {
		position: absolute;
		left: 15px;
		right: 15px;
		text-align: center;
		padding: 8px 12px;
	}

	.info-arc.top {
		top: 8px;
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: #a09890;
	}

	.info-arc.bottom {
		bottom: 8px;
	}

	.guardian {
		color: #d4c4a0;
		font-weight: 600;
	}

	.benefit {
		font-size: 10px;
		color: #908888;
		margin: 0;
		line-height: 1.4;
	}

	.corner-glyph {
		position: absolute;
		font-size: 16px;
		color: rgba(200, 180, 140, 0.25);
	}

	.corner-glyph.tl { top: 6px; left: 8px; }
	.corner-glyph.tr { top: 6px; right: 8px; }
	.corner-glyph.bl { bottom: 6px; left: 8px; }
	.corner-glyph.br { bottom: 6px; right: 8px; }
</style>
