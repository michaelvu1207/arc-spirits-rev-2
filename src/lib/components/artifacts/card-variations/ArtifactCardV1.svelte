<script lang="ts">
	/**
	 * V1: Ancient Scroll with Wax Seal
	 * Aged parchment texture, rolled edges, crimson wax seal, calligraphic flourishes
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="scroll-card">
	<div class="scroll-top"></div>
	<div class="parchment">
		<div class="parchment-stains"></div>
		<div class="corner-flourish tl"></div>
		<div class="corner-flourish tr"></div>
		<div class="corner-flourish bl"></div>
		<div class="corner-flourish br"></div>

		<div class="wax-seal">
			<div class="seal-inner">✦</div>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="divider">
			<span class="divider-wing left">❧</span>
			<span class="divider-center">◆</span>
			<span class="divider-wing right">☙</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<img src={icon} alt="rune" class="rune-icon" />
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">{guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' • ')}</span>
			{/if}
		</div>
	</div>
	<div class="scroll-bottom"></div>
</div>

<style>
	.scroll-card {
		width: 300px;
		height: 225px;
		position: relative;
		font-family: 'Opsilon', serif;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
	}

	.scroll-top,
	.scroll-bottom {
		height: 14px;
		background: linear-gradient(
			to bottom,
			#8b7355 0%,
			#a08060 20%,
			#c4a882 40%,
			#d4b896 50%,
			#c4a882 60%,
			#a08060 80%,
			#8b7355 100%
		);
		border-radius: 50%;
		box-shadow:
			inset 0 2px 4px rgba(255, 255, 255, 0.3),
			inset 0 -2px 4px rgba(0, 0, 0, 0.3),
			0 2px 4px rgba(0, 0, 0, 0.3);
		position: relative;
		z-index: 2;
	}

	.scroll-top::before,
	.scroll-bottom::before {
		content: '';
		position: absolute;
		left: 5px;
		right: 5px;
		top: 3px;
		height: 2px;
		background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.4), transparent);
	}

	.parchment {
		height: calc(100% - 28px);
		background: linear-gradient(135deg, #f4e4c1 0%, #e8d4a8 25%, #dcc89a 50%, #e8d4a8 75%, #f0deb0 100%);
		position: relative;
		padding: 16px 20px 12px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.parchment-stains {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 20% 30%, rgba(139, 90, 43, 0.08) 0%, transparent 50%),
			radial-gradient(ellipse at 80% 70%, rgba(101, 67, 33, 0.06) 0%, transparent 40%),
			radial-gradient(ellipse at 50% 90%, rgba(139, 90, 43, 0.05) 0%, transparent 30%);
		pointer-events: none;
	}

	.corner-flourish {
		position: absolute;
		width: 24px;
		height: 24px;
		opacity: 0.4;
		font-size: 18px;
		color: #8b5a2b;
	}

	.corner-flourish.tl { top: 4px; left: 6px; }
	.corner-flourish.tr { top: 4px; right: 6px; transform: scaleX(-1); }
	.corner-flourish.bl { bottom: 4px; left: 6px; transform: scaleY(-1); }
	.corner-flourish.br { bottom: 4px; right: 6px; transform: scale(-1); }

	.corner-flourish::before {
		content: '❦';
	}

	.wax-seal {
		position: absolute;
		top: 8px;
		right: 16px;
		width: 32px;
		height: 32px;
		background: radial-gradient(circle at 30% 30%, #c41e3a 0%, #8b0000 60%, #5c0000 100%);
		border-radius: 50%;
		box-shadow:
			inset 2px 2px 4px rgba(255, 100, 100, 0.4),
			inset -1px -1px 3px rgba(0, 0, 0, 0.5),
			2px 2px 6px rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.seal-inner {
		color: #ffd700;
		font-size: 14px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 600;
		color: #4a3520;
		margin: 0 0 6px 0;
		text-align: center;
		text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
		letter-spacing: 0.5px;
		padding-right: 30px;
	}

	.divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
		color: #8b5a2b;
		font-size: 12px;
		opacity: 0.7;
	}

	.divider-wing {
		font-size: 10px;
	}

	.divider-center {
		font-size: 8px;
	}

	.benefit {
		font-size: 11px;
		color: #5a4030;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
		font-style: italic;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 6px;
		margin: 8px 0;
	}

	.rune-icon {
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: 1px solid #8b5a2b;
		background: rgba(255, 255, 255, 0.3);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: #6b5030;
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px dashed rgba(139, 90, 43, 0.3);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}
</style>
