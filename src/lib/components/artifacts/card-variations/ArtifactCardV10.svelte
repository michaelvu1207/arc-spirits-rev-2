<script lang="ts">
	/**
	 * V10: Ancient Stone Tablet
	 * Carved stone, weathered surface, ancient runes, archaeological artifact
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="stone-card">
	<div class="stone-texture"></div>
	<div class="cracks"></div>
	<div class="moss-patches"></div>

	<div class="carved-border">
		<div class="corner-rune tl">ᛟ</div>
		<div class="corner-rune tr">ᛗ</div>
		<div class="corner-rune bl">ᛉ</div>
		<div class="corner-rune br">ᛞ</div>
	</div>

	<div class="inner-content">
		<div class="carved-symbol">☉</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="stone-divider">
			<span class="glyph">◈</span>
			<span class="line"></span>
			<span class="glyph">◈</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="rune-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">⌘ {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ◇ ')}</span>
			{/if}
		</div>
	</div>

	<div class="chisel-marks"></div>
</div>

<style>
	.stone-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			160deg,
			#6b6b60 0%,
			#5a5a50 20%,
			#4a4a40 50%,
			#5a5a50 80%,
			#6b6b60 100%
		);
		border-radius: 6px;
		overflow: hidden;
		box-shadow:
			inset 0 2px 4px rgba(255, 255, 255, 0.1),
			inset 0 -2px 4px rgba(0, 0, 0, 0.3),
			0 4px 12px rgba(0, 0, 0, 0.5);
	}

	.stone-texture {
		position: absolute;
		inset: 0;
		opacity: 0.3;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)'/%3E%3C/svg%3E");
		background-size: 150px 150px;
		pointer-events: none;
	}

	.cracks {
		position: absolute;
		inset: 0;
		opacity: 0.15;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 20 L30 25 L45 15 M60 80 L70 75 L85 82 M20 60 L35 55' stroke='%23000' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
		background-size: 120px 100px;
		pointer-events: none;
	}

	.moss-patches {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 10% 90%, rgba(60, 90, 50, 0.2) 0%, transparent 20%),
			radial-gradient(ellipse at 95% 15%, rgba(50, 80, 40, 0.15) 0%, transparent 15%);
		pointer-events: none;
	}

	.carved-border {
		position: absolute;
		inset: 8px;
		border: 3px solid rgba(80, 80, 70, 0.6);
		border-radius: 4px;
		box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.3);
	}

	.corner-rune {
		position: absolute;
		font-size: 14px;
		color: rgba(40, 40, 35, 0.6);
		text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.1);
	}

	.corner-rune.tl { top: -2px; left: 4px; }
	.corner-rune.tr { top: -2px; right: 4px; }
	.corner-rune.bl { bottom: -2px; left: 4px; }
	.corner-rune.br { bottom: -2px; right: 4px; }

	.inner-content {
		position: absolute;
		inset: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.carved-symbol {
		font-size: 24px;
		color: rgba(60, 60, 55, 0.7);
		text-shadow:
			1px 1px 0 rgba(255, 255, 255, 0.15),
			-1px -1px 0 rgba(0, 0, 0, 0.2);
		margin-bottom: 2px;
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 700;
		color: #3a3a35;
		margin: 0 0 6px 0;
		text-align: center;
		text-shadow:
			1px 1px 0 rgba(255, 255, 255, 0.2),
			-1px -1px 0 rgba(0, 0, 0, 0.15);
		letter-spacing: 1px;
	}

	.stone-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 6px;
		width: 100%;
	}

	.glyph {
		font-size: 10px;
		color: rgba(60, 60, 55, 0.6);
	}

	.line {
		flex: 1;
		max-width: 80px;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(60, 60, 55, 0.4), transparent);
	}

	.benefit {
		font-size: 11px;
		color: #4a4a45;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.1);
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 8px 0;
	}

	.rune-socket {
		width: 26px;
		height: 26px;
		background: rgba(50, 50, 45, 0.5);
		border: 2px solid rgba(70, 70, 65, 0.6);
		border-radius: 50%;
		padding: 2px;
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.4),
			0 1px 0 rgba(255, 255, 255, 0.1);
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
		color: rgba(60, 60, 55, 0.8);
		margin-top: auto;
		padding-top: 4px;
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}

	.chisel-marks {
		position: absolute;
		bottom: 10px;
		right: 15px;
		width: 30px;
		height: 20px;
		opacity: 0.1;
		background: repeating-linear-gradient(
			-45deg,
			transparent,
			transparent 2px,
			rgba(0, 0, 0, 0.3) 2px,
			rgba(0, 0, 0, 0.3) 3px
		);
	}
</style>
