<script lang="ts">
	/**
	 * V21: Ribbon Bands Layout
	 * Horizontal ribbon strips layered like banners
	 * Each band contains different info, overlapping edges
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="ribbon-card">
	<div class="card-bg"></div>

	<!-- Top ribbon: Tags -->
	<div class="ribbon ribbon-top">
		<div class="ribbon-end left"></div>
		<div class="ribbon-content">
			{#if tagNames.length > 0}
				{#each tagNames as tag, i (i)}
					<span class="tag-text">{tag}</span>
					{#if i < tagNames.length - 1}
						<span class="tag-sep">◆</span>
					{/if}
				{/each}
			{:else}
				<span class="tag-text">Artifact</span>
			{/if}
		</div>
		<div class="ribbon-end right"></div>
	</div>

	<!-- Main ribbon: Name (largest) -->
	<div class="ribbon ribbon-main">
		<div class="ribbon-end left"></div>
		<div class="ribbon-content">
			<span class="name-icon">✦</span>
			<h2 class="artifact-name">{artifact.name}</h2>
			<span class="name-icon">✦</span>
		</div>
		<div class="ribbon-end right"></div>
	</div>

	<!-- Middle ribbon: Runes -->
	<div class="ribbon ribbon-runes">
		<div class="ribbon-end left"></div>
		<div class="ribbon-content">
			{#if recipeIcons.length > 0}
				<span class="rune-label">COST:</span>
				{#each recipeIcons as icon, i (i)}
					<div class="inline-rune">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			{:else}
				<span class="rune-label">NO COST</span>
			{/if}
		</div>
		<div class="ribbon-end right"></div>
	</div>

	<!-- Description band -->
	<div class="desc-band">
		<p class="benefit">{artifact.benefit}</p>
	</div>

	<!-- Bottom ribbon: Guardian -->
	<div class="ribbon ribbon-bottom">
		<div class="ribbon-end left"></div>
		<div class="ribbon-content">
			{#if guardianName}
				<span class="guardian-text">⚔ {guardianName}</span>
			{:else}
				<span class="guardian-text">⚔ Unbound</span>
			{/if}
		</div>
		<div class="ribbon-end right"></div>
	</div>
</div>

<style>
	.ribbon-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 6px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
	}

	.card-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, #1f1a25 0%, #151218 50%, #1a1520 100%);
	}

	.ribbon {
		position: relative;
		display: flex;
		align-items: center;
		z-index: 1;
	}

	.ribbon-end {
		width: 15px;
		height: 100%;
		position: relative;
	}

	.ribbon-end.left::after,
	.ribbon-end.right::after {
		content: '';
		position: absolute;
		top: 0;
		width: 0;
		height: 0;
		border-style: solid;
	}

	.ribbon-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 0 8px;
	}

	/* Top ribbon - small, accent color */
	.ribbon-top {
		height: 22px;
		margin-top: 8px;
	}

	.ribbon-top .ribbon-content {
		background: linear-gradient(90deg, #4a3a5a 0%, #5a4a6a 50%, #4a3a5a 100%);
	}

	.ribbon-top .ribbon-end.left::after {
		right: 0;
		border-width: 11px 15px 11px 0;
		border-color: transparent #4a3a5a transparent transparent;
	}

	.ribbon-top .ribbon-end.right::after {
		left: 0;
		border-width: 11px 0 11px 15px;
		border-color: transparent transparent transparent #4a3a5a;
	}

	.tag-text {
		font-size: 9px;
		color: #c8b8d8;
		letter-spacing: 1px;
		text-transform: uppercase;
	}

	.tag-sep {
		font-size: 6px;
		color: #8a7a9a;
	}

	/* Main ribbon - largest, gold */
	.ribbon-main {
		height: 40px;
		margin-top: -4px;
		z-index: 3;
	}

	.ribbon-main .ribbon-content {
		background: linear-gradient(90deg, #8b6914 0%, #c9a020 25%, #dab830 50%, #c9a020 75%, #8b6914 100%);
		box-shadow: 0 4px 12px rgba(139, 105, 20, 0.4);
	}

	.ribbon-main .ribbon-end.left::after {
		right: 0;
		border-width: 20px 15px 20px 0;
		border-color: transparent #8b6914 transparent transparent;
	}

	.ribbon-main .ribbon-end.right::after {
		left: 0;
		border-width: 20px 0 20px 15px;
		border-color: transparent transparent transparent #8b6914;
	}

	.name-icon {
		font-size: 12px;
		color: #3a2a10;
	}

	.artifact-name {
		font-size: 16px;
		font-weight: 700;
		color: #1a0f00;
		margin: 0;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3);
	}

	/* Runes ribbon - medium, copper */
	.ribbon-runes {
		height: 32px;
		margin-top: -4px;
		z-index: 2;
	}

	.ribbon-runes .ribbon-content {
		background: linear-gradient(90deg, #6a4a3a 0%, #8a6a5a 50%, #6a4a3a 100%);
	}

	.ribbon-runes .ribbon-end.left::after {
		right: 0;
		border-width: 16px 15px 16px 0;
		border-color: transparent #6a4a3a transparent transparent;
	}

	.ribbon-runes .ribbon-end.right::after {
		left: 0;
		border-width: 16px 0 16px 15px;
		border-color: transparent transparent transparent #6a4a3a;
	}

	.rune-label {
		font-size: 9px;
		color: #d8c8b8;
		letter-spacing: 1px;
	}

	.inline-rune {
		width: 22px;
		height: 22px;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 3px;
		padding: 2px;
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 2px;
		object-fit: cover;
	}

	/* Description band */
	.desc-band {
		flex: 1;
		display: flex;
		align-items: center;
		padding: 8px 24px;
		position: relative;
		z-index: 0;
	}

	.benefit {
		font-size: 11px;
		color: #a898a8;
		line-height: 1.5;
		margin: 0;
		text-align: center;
	}

	/* Bottom ribbon - small, dark */
	.ribbon-bottom {
		height: 24px;
		margin-bottom: 8px;
	}

	.ribbon-bottom .ribbon-content {
		background: linear-gradient(90deg, #2a2530 0%, #3a3540 50%, #2a2530 100%);
	}

	.ribbon-bottom .ribbon-end.left::after {
		right: 0;
		border-width: 12px 15px 12px 0;
		border-color: transparent #2a2530 transparent transparent;
	}

	.ribbon-bottom .ribbon-end.right::after {
		left: 0;
		border-width: 12px 0 12px 15px;
		border-color: transparent transparent transparent #2a2530;
	}

	.guardian-text {
		font-size: 10px;
		color: #a898a8;
	}
</style>
