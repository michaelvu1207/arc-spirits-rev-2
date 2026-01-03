<script lang="ts">
	/**
	 * V12: Alchemist's Recipe
	 * Potion bottles, bubbling effects, stained parchment, mystical ingredients
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="alchemy-card">
	<div class="parchment-bg">
		<div class="stain-marks"></div>
		<div class="burn-edge top"></div>
		<div class="burn-edge bottom"></div>
	</div>

	<div class="card-content">
		<div class="flask-icon">
			<div class="flask-body">⚗</div>
			<div class="bubbles">
				<span class="bubble b1">○</span>
				<span class="bubble b2">○</span>
				<span class="bubble b3">○</span>
			</div>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="recipe-divider">
			<span class="symbol">⚶</span>
			<span class="dashed-line"></span>
			<span class="symbol">⚶</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="ingredients-label">Ingredients:</div>
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="ingredient-vial">
						<img src={icon} alt="ingredient" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">⚕ {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' • ')}</span>
			{/if}
		</div>
	</div>

	<div class="drip-stains">
		<div class="drip d1"></div>
		<div class="drip d2"></div>
	</div>
</div>

<style>
	.alchemy-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
	}

	.parchment-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			160deg,
			#e8dcc4 0%,
			#d8c8a8 30%,
			#c8b898 60%,
			#d8c8a8 100%
		);
		border-radius: 4px;
	}

	.stain-marks {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 75% 20%, rgba(80, 120, 80, 0.15) 0%, transparent 25%),
			radial-gradient(ellipse at 20% 70%, rgba(120, 60, 120, 0.12) 0%, transparent 20%),
			radial-gradient(ellipse at 60% 85%, rgba(60, 80, 140, 0.1) 0%, transparent 18%);
		pointer-events: none;
	}

	.burn-edge {
		position: absolute;
		left: 0;
		right: 0;
		height: 8px;
		background: linear-gradient(
			to bottom,
			rgba(80, 50, 20, 0.3) 0%,
			transparent 100%
		);
	}

	.burn-edge.top {
		top: 0;
		border-radius: 4px 4px 0 0;
	}

	.burn-edge.bottom {
		bottom: 0;
		transform: scaleY(-1);
		border-radius: 0 0 4px 4px;
	}

	.card-content {
		position: absolute;
		inset: 12px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.flask-icon {
		position: relative;
		margin-bottom: 4px;
	}

	.flask-body {
		font-size: 26px;
		color: #5a7a5a;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.bubbles {
		position: absolute;
		top: 4px;
		left: 50%;
		transform: translateX(-50%);
	}

	.bubble {
		position: absolute;
		font-size: 6px;
		color: rgba(100, 180, 100, 0.6);
		animation: bubble-rise 2s ease-in-out infinite;
	}

	.bubble.b1 { left: -8px; animation-delay: 0s; }
	.bubble.b2 { left: 0; animation-delay: 0.7s; }
	.bubble.b3 { left: 8px; animation-delay: 1.4s; }

	@keyframes bubble-rise {
		0%, 100% { transform: translateY(0); opacity: 0; }
		50% { transform: translateY(-8px); opacity: 1; }
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 600;
		color: #4a3a2a;
		margin: 0 0 4px 0;
		text-align: center;
		font-style: italic;
		text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.4);
	}

	.recipe-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 6px;
		width: 100%;
	}

	.symbol {
		font-size: 12px;
		color: #6a5a4a;
		opacity: 0.7;
	}

	.dashed-line {
		flex: 1;
		max-width: 80px;
		height: 0;
		border-top: 2px dashed rgba(100, 80, 60, 0.4);
	}

	.benefit {
		font-size: 11px;
		color: #5a4a3a;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
	}

	.ingredients-label {
		font-size: 9px;
		color: #6a5a4a;
		text-transform: uppercase;
		letter-spacing: 1px;
		margin-bottom: 4px;
		opacity: 0.8;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.ingredient-vial {
		width: 24px;
		height: 28px;
		background: linear-gradient(
			180deg,
			rgba(180, 220, 180, 0.4) 0%,
			rgba(100, 160, 100, 0.3) 100%
		);
		border: 1px solid rgba(80, 100, 80, 0.5);
		border-radius: 4px 4px 8px 8px;
		padding: 2px;
		position: relative;
	}

	.ingredient-vial::before {
		content: '';
		position: absolute;
		top: -4px;
		left: 50%;
		transform: translateX(-50%);
		width: 12px;
		height: 6px;
		background: #8a7a6a;
		border-radius: 2px;
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 2px 2px 6px 6px;
		object-fit: cover;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		width: 100%;
		font-size: 9px;
		color: #6a5a4a;
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(100, 80, 60, 0.3);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}

	.drip-stains {
		position: absolute;
		pointer-events: none;
	}

	.drip {
		position: absolute;
		width: 8px;
		background: linear-gradient(
			180deg,
			rgba(100, 160, 100, 0.3) 0%,
			rgba(80, 140, 80, 0.2) 100%
		);
		border-radius: 0 0 4px 4px;
	}

	.drip.d1 {
		top: 30px;
		right: 25px;
		height: 20px;
	}

	.drip.d2 {
		top: 45px;
		left: 35px;
		height: 15px;
		background: linear-gradient(
			180deg,
			rgba(140, 80, 140, 0.25) 0%,
			rgba(120, 60, 120, 0.15) 100%
		);
	}
</style>
