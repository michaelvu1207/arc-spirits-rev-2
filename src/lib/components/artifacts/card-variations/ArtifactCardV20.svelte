<script lang="ts">
	/**
	 * V20: Corner Anchor Layout
	 * Name anchored in top-left corner, content flows diagonally to bottom-right
	 * Strong diagonal axis, triangular composition
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="corner-card">
	<!-- Diagonal background split -->
	<div class="bg-upper"></div>
	<div class="bg-lower"></div>
	<div class="diagonal-line"></div>

	<!-- Top-left anchor: Name -->
	<div class="corner-anchor">
		<div class="anchor-accent"></div>
		<h2 class="artifact-name">{artifact.name}</h2>
		{#if guardianName}
			<span class="guardian">{guardianName}</span>
		{/if}
	</div>

	<!-- Diagonal flow: Runes cascade down -->
	<div class="rune-cascade">
		{#if recipeIcons.length > 0}
			{#each recipeIcons as icon, i (i)}
				<div class="cascade-rune" style="--offset: {i}">
					<img src={icon} alt="rune" class="rune-icon" />
				</div>
			{/each}
		{/if}
	</div>

	<!-- Bottom-right: Description & tags -->
	<div class="content-flow">
		<p class="benefit">{artifact.benefit}</p>
		{#if tagNames.length > 0}
			<div class="tag-trail">
				{#each tagNames as tag, i (i)}
					<span class="tag">{tag}</span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Decorative corner accents -->
	<div class="corner-deco tr">◢</div>
	<div class="corner-deco bl">◣</div>
</div>

<style>
	.corner-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
	}

	.bg-upper {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #1a2a1f 0%, #0f1a14 100%);
		clip-path: polygon(0 0, 100% 0, 0 100%);
	}

	.bg-lower {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, #141f1a 0%, #0a100d 100%);
		clip-path: polygon(100% 0, 100% 100%, 0 100%);
	}

	.diagonal-line {
		position: absolute;
		top: 0;
		left: 0;
		width: 141.4%;
		height: 2px;
		background: linear-gradient(90deg, #5a9a70 0%, rgba(90, 154, 112, 0.3) 50%, transparent 100%);
		transform: rotate(36.87deg);
		transform-origin: top left;
		box-shadow: 0 0 10px rgba(90, 154, 112, 0.3);
	}

	.corner-anchor {
		position: absolute;
		top: 12px;
		left: 12px;
		max-width: 180px;
		z-index: 2;
	}

	.anchor-accent {
		position: absolute;
		top: -8px;
		left: -8px;
		width: 40px;
		height: 40px;
		border-left: 3px solid #5a9a70;
		border-top: 3px solid #5a9a70;
		opacity: 0.6;
	}

	.artifact-name {
		font-size: 20px;
		font-weight: 700;
		color: #b8e8c8;
		margin: 0 0 4px 0;
		text-shadow: 0 2px 10px rgba(90, 154, 112, 0.4);
		line-height: 1.2;
	}

	.guardian {
		font-size: 10px;
		color: #7ab890;
		display: block;
	}

	.rune-cascade {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		display: flex;
		gap: 8px;
	}

	.cascade-rune {
		width: 32px;
		height: 32px;
		background: rgba(20, 35, 28, 0.9);
		border: 2px solid rgba(90, 154, 112, 0.5);
		border-radius: 6px;
		padding: 2px;
		transform: translateY(calc(var(--offset) * 12px)) rotate(-5deg);
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.4),
			0 0 15px rgba(90, 154, 112, 0.2);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 4px;
		object-fit: cover;
	}

	.content-flow {
		position: absolute;
		bottom: 12px;
		right: 12px;
		max-width: 180px;
		text-align: right;
		z-index: 2;
	}

	.benefit {
		font-size: 11px;
		color: #90b8a0;
		line-height: 1.5;
		margin: 0 0 8px 0;
	}

	.tag-trail {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}

	.tag {
		font-size: 9px;
		color: #5a9a70;
		background: rgba(90, 154, 112, 0.15);
		padding: 3px 8px;
		border-radius: 3px;
		border: 1px solid rgba(90, 154, 112, 0.3);
	}

	.corner-deco {
		position: absolute;
		font-size: 20px;
		color: rgba(90, 154, 112, 0.2);
	}

	.corner-deco.tr {
		top: 10px;
		right: 12px;
	}

	.corner-deco.bl {
		bottom: 10px;
		left: 12px;
	}
</style>
