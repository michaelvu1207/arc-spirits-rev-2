<script lang="ts">
	/**
	 * V9: Medieval Heraldic Banner
	 * Royal shields, banners, coats of arms, noble crests
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="heraldic-card">
	<div class="banner-top">
		<div class="banner-fold left"></div>
		<div class="banner-fold right"></div>
	</div>

	<div class="shield-body">
		<div class="shield-pattern"></div>
		<div class="shield-border"></div>

		<div class="crest-header">
			<span class="crown">♔</span>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="royal-divider">
			<span class="fleur">⚜</span>
			<span class="line"></span>
			<span class="fleur">⚜</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="sigil-mount">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">⚔ {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ◆ ')}</span>
			{/if}
		</div>
	</div>

	<div class="banner-tail">
		<div class="tail-left"></div>
		<div class="tail-right"></div>
	</div>
</div>

<style>
	.heraldic-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5));
	}

	.banner-top {
		height: 12px;
		background: linear-gradient(180deg, #8b0000 0%, #6b0000 100%);
		border-radius: 4px 4px 0 0;
		position: relative;
		display: flex;
		justify-content: space-between;
	}

	.banner-fold {
		width: 20px;
		height: 100%;
		background: linear-gradient(180deg, #5a0000 0%, #3a0000 100%);
	}

	.banner-fold.left {
		border-radius: 4px 0 0 0;
		clip-path: polygon(0 0, 100% 0, 80% 100%, 0 100%);
	}

	.banner-fold.right {
		border-radius: 0 4px 0 0;
		clip-path: polygon(20% 100%, 100% 100%, 100% 0, 0 0);
	}

	.shield-body {
		height: calc(100% - 24px);
		background: linear-gradient(180deg, #1a1428 0%, #241a35 50%, #1a1428 100%);
		border-left: 4px solid #d4af37;
		border-right: 4px solid #d4af37;
		position: relative;
		padding: 14px 18px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.shield-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.06;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0 L40 20 L20 40 L0 20 Z' stroke='%23d4af37' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
		background-size: 30px 30px;
		pointer-events: none;
	}

	.shield-border {
		position: absolute;
		inset: 8px;
		border: 1px solid rgba(212, 175, 55, 0.3);
		pointer-events: none;
	}

	.crest-header {
		text-align: center;
		margin-bottom: 4px;
	}

	.crown {
		font-size: 20px;
		color: #d4af37;
		text-shadow: 0 2px 8px rgba(212, 175, 55, 0.5);
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 700;
		color: #d4af37;
		margin: 0 0 6px 0;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 2px;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}

	.royal-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 8px;
	}

	.fleur {
		font-size: 12px;
		color: #d4af37;
		opacity: 0.8;
	}

	.line {
		flex: 1;
		max-width: 60px;
		height: 2px;
		background: linear-gradient(90deg, transparent, #d4af37, transparent);
	}

	.benefit {
		font-size: 11px;
		color: #c8b8a0;
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

	.sigil-mount {
		width: 26px;
		height: 26px;
		background: linear-gradient(145deg, #3a2a1f 0%, #2a1a0f 100%);
		border: 2px solid #d4af37;
		clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
		padding: 2px;
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		object-fit: cover;
		clip-path: polygon(50% 5%, 95% 27%, 95% 73%, 50% 95%, 5% 73%, 5% 27%);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: rgba(212, 175, 55, 0.8);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(212, 175, 55, 0.2);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}

	.banner-tail {
		height: 12px;
		display: flex;
		justify-content: center;
		gap: 40px;
	}

	.tail-left,
	.tail-right {
		width: 80px;
		height: 100%;
		background: linear-gradient(180deg, #8b0000 0%, #6b0000 100%);
	}

	.tail-left {
		clip-path: polygon(0 0, 100% 0, 80% 100%, 0 100%);
	}

	.tail-right {
		clip-path: polygon(0 0, 100% 0, 100% 100%, 20% 100%);
	}
</style>
