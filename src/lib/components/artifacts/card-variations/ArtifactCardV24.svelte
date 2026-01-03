<script lang="ts">
	/**
	 * V24: Vertical Scroll Layout
	 * Tall narrow content area, wide decorative margins on sides
	 * Scroll/document aesthetic with ornate sidebars
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="scroll-layout-card">
	<!-- Left decorative margin -->
	<div class="margin margin-left">
		<div class="margin-pattern"></div>
		<div class="margin-runes">
			{#if recipeIcons.length > 0}
				{#each recipeIcons as icon, i (i)}
					<div class="side-rune">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			{/if}
		</div>
		<div class="margin-ornament top">╔</div>
		<div class="margin-ornament bottom">╚</div>
	</div>

	<!-- Center scroll content -->
	<div class="scroll-content">
		<div class="scroll-header">
			<div class="header-deco">═══ ✦ ═══</div>
			<h2 class="artifact-name">{artifact.name}</h2>
		</div>

		<div class="scroll-body">
			<p class="benefit">{artifact.benefit}</p>
		</div>

		<div class="scroll-footer">
			<div class="footer-line"></div>
			{#if guardianName}
				<span class="guardian">{guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<div class="tag-list">
					{#each tagNames as tag, i (i)}
						<span class="tag">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right decorative margin -->
	<div class="margin margin-right">
		<div class="margin-pattern"></div>
		<div class="margin-text">
			<span class="vertical-text">ARTIFACT</span>
		</div>
		<div class="margin-ornament top">╗</div>
		<div class="margin-ornament bottom">╝</div>
	</div>
</div>

<style>
	.scroll-layout-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		display: flex;
		background: #0a0810;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
	}

	/* Margins */
	.margin {
		width: 50px;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.margin-left {
		background: linear-gradient(90deg, #1a1424 0%, #12101a 100%);
		border-right: 1px solid #3a2a4a;
	}

	.margin-right {
		background: linear-gradient(90deg, #12101a 0%, #1a1424 100%);
		border-left: 1px solid #3a2a4a;
	}

	.margin-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.1;
		background-image: repeating-linear-gradient(
			0deg,
			transparent,
			transparent 8px,
			rgba(180, 140, 200, 0.3) 8px,
			rgba(180, 140, 200, 0.3) 9px
		);
	}

	.margin-ornament {
		position: absolute;
		font-size: 16px;
		color: #5a4a6a;
	}

	.margin-ornament.top { top: 8px; }
	.margin-ornament.bottom { bottom: 8px; }

	.margin-runes {
		display: flex;
		flex-direction: column;
		gap: 8px;
		z-index: 1;
	}

	.side-rune {
		width: 28px;
		height: 28px;
		background: rgba(90, 74, 106, 0.3);
		border: 1px solid rgba(90, 74, 106, 0.6);
		border-radius: 4px;
		padding: 2px;
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 2px;
		object-fit: cover;
	}

	.margin-text {
		z-index: 1;
	}

	.vertical-text {
		writing-mode: vertical-rl;
		text-orientation: mixed;
		font-size: 10px;
		letter-spacing: 4px;
		color: #4a3a5a;
	}

	/* Scroll content */
	.scroll-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		background: linear-gradient(180deg, #181420 0%, #14101c 50%, #181420 100%);
		padding: 16px 14px;
		position: relative;
	}

	.scroll-content::before,
	.scroll-content::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 20px;
		pointer-events: none;
	}

	.scroll-content::before {
		top: 0;
		background: linear-gradient(to bottom, rgba(24, 20, 32, 1), transparent);
	}

	.scroll-content::after {
		bottom: 0;
		background: linear-gradient(to top, rgba(24, 20, 32, 1), transparent);
	}

	.scroll-header {
		text-align: center;
		margin-bottom: 10px;
		position: relative;
		z-index: 1;
	}

	.header-deco {
		font-size: 10px;
		color: #6a5a7a;
		margin-bottom: 4px;
		letter-spacing: 2px;
	}

	.artifact-name {
		font-size: 16px;
		font-weight: 700;
		color: #d8c8e8;
		margin: 0;
		text-shadow: 0 2px 10px rgba(180, 140, 200, 0.3);
	}

	.scroll-body {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 1;
	}

	.benefit {
		font-size: 11px;
		color: #a898b8;
		line-height: 1.6;
		margin: 0;
		text-align: center;
	}

	.scroll-footer {
		text-align: center;
		position: relative;
		z-index: 1;
	}

	.footer-line {
		width: 60%;
		height: 1px;
		background: linear-gradient(90deg, transparent, #5a4a6a, transparent);
		margin: 0 auto 8px;
	}

	.guardian {
		display: block;
		font-size: 10px;
		color: #8a7a9a;
		margin-bottom: 4px;
	}

	.tag-list {
		display: flex;
		justify-content: center;
		gap: 6px;
	}

	.tag {
		font-size: 8px;
		color: #6a5a7a;
		background: rgba(90, 74, 106, 0.2);
		padding: 2px 6px;
		border-radius: 3px;
	}
</style>
