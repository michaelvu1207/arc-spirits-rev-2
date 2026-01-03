<script lang="ts">
	/**
	 * V4: Dark Arcane Tome Page
	 * Ancient grimoire aesthetic, runic borders, occult symbols, dark mysticism
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="tome-card">
	<div class="page-edge"></div>
	<div class="rune-border">
		<span class="rune">ᚠ</span>
		<span class="rune">ᚢ</span>
		<span class="rune">ᚦ</span>
		<span class="rune">ᚨ</span>
		<span class="rune">ᚱ</span>
		<span class="rune">ᚲ</span>
		<span class="rune">ᚷ</span>
		<span class="rune">ᚹ</span>
	</div>

	<div class="page-content">
		<div class="arcane-pattern"></div>
		<div class="corner-sigil tl">⛧</div>
		<div class="corner-sigil tr">⛧</div>
		<div class="corner-sigil bl">⛧</div>
		<div class="corner-sigil br">⛧</div>

		<div class="header-circle">
			<div class="inner-circle">
				<span class="center-symbol">☽</span>
			</div>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="arcane-divider">
			<span class="sigil">◭</span>
			<span class="line"></span>
			<span class="eye">◉</span>
			<span class="line"></span>
			<span class="sigil">◮</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="rune-circle">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">⍟ {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ⦿ ')}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.tome-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		background: #0a0a0f;
		border-radius: 4px;
		position: relative;
		overflow: hidden;
		box-shadow:
			0 0 20px rgba(80, 40, 120, 0.4),
			inset 0 0 60px rgba(80, 40, 120, 0.1);
	}

	.page-edge {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 8px;
		background: linear-gradient(
			to right,
			#1a1520 0%,
			#2a2030 50%,
			#1a1520 100%
		);
		box-shadow: inset -2px 0 4px rgba(0, 0, 0, 0.5);
	}

	.page-edge::before {
		content: '';
		position: absolute;
		top: 10%;
		bottom: 10%;
		left: 2px;
		width: 1px;
		background: repeating-linear-gradient(
			to bottom,
			transparent,
			transparent 8px,
			rgba(150, 100, 180, 0.3) 8px,
			rgba(150, 100, 180, 0.3) 10px
		);
	}

	.rune-border {
		position: absolute;
		top: 6px;
		left: 14px;
		right: 6px;
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: rgba(150, 100, 180, 0.5);
		letter-spacing: 2px;
	}

	.rune {
		animation: rune-flicker 4s ease-in-out infinite;
		animation-delay: calc(var(--i, 0) * 0.5s);
	}

	.rune:nth-child(1) { --i: 1; }
	.rune:nth-child(2) { --i: 2; }
	.rune:nth-child(3) { --i: 3; }
	.rune:nth-child(4) { --i: 4; }
	.rune:nth-child(5) { --i: 5; }
	.rune:nth-child(6) { --i: 6; }
	.rune:nth-child(7) { --i: 7; }
	.rune:nth-child(8) { --i: 8; }

	@keyframes rune-flicker {
		0%, 100% { opacity: 0.5; text-shadow: none; }
		50% { opacity: 1; text-shadow: 0 0 8px rgba(150, 100, 180, 0.8); }
	}

	.page-content {
		position: absolute;
		inset: 18px 8px 8px 12px;
		background: linear-gradient(
			180deg,
			#12101a 0%,
			#18141f 50%,
			#12101a 100%
		);
		border: 1px solid rgba(150, 100, 180, 0.3);
		border-radius: 2px;
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.arcane-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.04;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='25' stroke='%239664b8' stroke-width='0.5' fill='none'/%3E%3Cpath d='M30 5 L30 55 M5 30 L55 30 M12 12 L48 48 M48 12 L12 48' stroke='%239664b8' stroke-width='0.3' fill='none'/%3E%3C/svg%3E");
		background-size: 60px 60px;
		pointer-events: none;
	}

	.corner-sigil {
		position: absolute;
		font-size: 10px;
		color: rgba(150, 100, 180, 0.4);
	}

	.corner-sigil.tl { top: 4px; left: 6px; }
	.corner-sigil.tr { top: 4px; right: 6px; }
	.corner-sigil.bl { bottom: 4px; left: 6px; }
	.corner-sigil.br { bottom: 4px; right: 6px; }

	.header-circle {
		width: 32px;
		height: 32px;
		margin: 0 auto 4px;
		border: 1px solid rgba(150, 100, 180, 0.5);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: radial-gradient(
			circle,
			rgba(80, 40, 120, 0.3) 0%,
			transparent 70%
		);
	}

	.inner-circle {
		width: 22px;
		height: 22px;
		border: 1px solid rgba(150, 100, 180, 0.3);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.center-symbol {
		font-size: 12px;
		color: rgba(180, 140, 220, 0.8);
		text-shadow: 0 0 10px rgba(150, 100, 180, 0.6);
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 600;
		color: #c8a8e8;
		margin: 0 0 6px 0;
		text-align: center;
		text-shadow: 0 0 15px rgba(150, 100, 180, 0.5);
		letter-spacing: 1px;
	}

	.arcane-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
		color: rgba(150, 100, 180, 0.6);
	}

	.sigil {
		font-size: 8px;
	}

	.line {
		flex: 1;
		max-width: 35px;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(150, 100, 180, 0.5),
			transparent
		);
	}

	.eye {
		font-size: 10px;
		animation: eye-pulse 3s ease-in-out infinite;
	}

	@keyframes eye-pulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}

	.benefit {
		font-size: 11px;
		color: #a090b8;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
		font-style: italic;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin: 8px 0;
	}

	.rune-circle {
		width: 26px;
		height: 26px;
		background: rgba(80, 40, 120, 0.3);
		border: 1px solid rgba(150, 100, 180, 0.5);
		border-radius: 50%;
		padding: 3px;
		box-shadow:
			0 0 10px rgba(80, 40, 120, 0.4),
			inset 0 0 6px rgba(150, 100, 180, 0.2);
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
		font-size: 9px;
		color: rgba(180, 140, 220, 0.7);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(150, 100, 180, 0.2);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}
</style>
