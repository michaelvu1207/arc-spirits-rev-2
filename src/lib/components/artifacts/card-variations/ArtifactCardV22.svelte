<script lang="ts">
	/**
	 * V22: Asymmetric Puzzle Layout
	 * Interlocking irregular sections, each containing different info
	 * Jigsaw-like composition with overlapping edges
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="puzzle-card">
	<!-- Large piece: Name (top-left, L-shaped) -->
	<div class="piece piece-name">
		<div class="piece-inner">
			<div class="name-sigil">◈</div>
			<h2 class="artifact-name">{artifact.name}</h2>
		</div>
		<div class="piece-notch right"></div>
		<div class="piece-notch bottom"></div>
	</div>

	<!-- Rune piece (top-right, small square) -->
	<div class="piece piece-runes">
		<div class="piece-inner">
			{#if recipeIcons.length > 0}
				{#each recipeIcons as icon, i (i)}
					<div class="rune-slot">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			{:else}
				<span class="no-runes">✧</span>
			{/if}
		</div>
		<div class="piece-tab left"></div>
	</div>

	<!-- Description piece (bottom, wide) -->
	<div class="piece piece-desc">
		<div class="piece-inner">
			<p class="benefit">{artifact.benefit}</p>
		</div>
		<div class="piece-tab top"></div>
	</div>

	<!-- Tags piece (bottom-right corner) -->
	<div class="piece piece-tags">
		<div class="piece-inner">
			{#if tagNames.length > 0}
				{#each tagNames as tag, i (i)}
					<span class="tag">{tag}</span>
				{/each}
			{/if}
			{#if guardianName}
				<span class="guardian">⚔ {guardianName}</span>
			{/if}
		</div>
	</div>

	<!-- Connection lines -->
	<svg class="connection-lines" viewBox="0 0 300 225">
		<path d="M170 0 L170 65" class="conn-line" />
		<path d="M0 80 L170 80" class="conn-line" />
		<path d="M170 80 L170 145" class="conn-line" />
		<path d="M200 145 L300 145" class="conn-line" />
	</svg>
</div>

<style>
	.puzzle-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: #0c0a0f;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
	}

	.piece {
		position: absolute;
		background: linear-gradient(135deg, #1a1520 0%, #252030 100%);
		overflow: hidden;
	}

	.piece-inner {
		position: relative;
		z-index: 1;
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 10px;
		box-sizing: border-box;
	}

	/* Name piece - L-shaped, top-left */
	.piece-name {
		top: 0;
		left: 0;
		width: 170px;
		height: 80px;
		border-right: 2px solid #c97b3a;
		border-bottom: 2px solid #c97b3a;
		border-radius: 6px 0 0 0;
		clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
	}

	.piece-name .piece-inner {
		flex-direction: row;
		align-items: center;
		gap: 10px;
	}

	.name-sigil {
		font-size: 24px;
		color: #c97b3a;
		text-shadow: 0 0 15px rgba(201, 123, 58, 0.5);
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 700;
		color: #e8d0b8;
		margin: 0;
		line-height: 1.2;
	}

	.piece-notch {
		position: absolute;
		background: #0c0a0f;
	}

	.piece-notch.right {
		right: -12px;
		top: 50%;
		transform: translateY(-50%);
		width: 12px;
		height: 24px;
		border-radius: 0 12px 12px 0;
	}

	.piece-notch.bottom {
		bottom: -12px;
		left: 50%;
		transform: translateX(-50%);
		width: 24px;
		height: 12px;
		border-radius: 0 0 12px 12px;
	}

	/* Runes piece - top-right */
	.piece-runes {
		top: 0;
		right: 0;
		width: 130px;
		height: 65px;
		border-left: 2px solid #7a5a9a;
		border-bottom: 2px solid #7a5a9a;
		border-radius: 0 6px 0 0;
	}

	.piece-runes .piece-inner {
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: 6px;
	}

	.piece-tab {
		position: absolute;
		background: linear-gradient(135deg, #1a1520 0%, #252030 100%);
		border: 2px solid;
	}

	.piece-tab.left {
		left: -12px;
		top: 50%;
		transform: translateY(-50%);
		width: 14px;
		height: 20px;
		border-radius: 8px 0 0 8px;
		border-color: #7a5a9a;
		border-right: none;
	}

	.rune-slot {
		width: 28px;
		height: 28px;
		background: rgba(122, 90, 154, 0.2);
		border: 1px solid rgba(122, 90, 154, 0.5);
		border-radius: 4px;
		padding: 2px;
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 2px;
		object-fit: cover;
	}

	.no-runes {
		font-size: 20px;
		color: rgba(122, 90, 154, 0.4);
	}

	/* Description piece - bottom wide */
	.piece-desc {
		bottom: 35px;
		left: 0;
		right: 100px;
		height: 70px;
		border-top: 2px solid #5a7a6a;
		border-right: 2px solid #5a7a6a;
	}

	.piece-desc .piece-inner {
		justify-content: center;
	}

	.piece-tab.top {
		top: -12px;
		left: 30%;
		width: 20px;
		height: 14px;
		border-radius: 8px 8px 0 0;
		border-color: #5a7a6a;
		border-bottom: none;
	}

	.benefit {
		font-size: 10px;
		color: #a0b8a8;
		line-height: 1.5;
		margin: 0;
	}

	/* Tags piece - bottom-right */
	.piece-tags {
		bottom: 0;
		right: 0;
		width: 100px;
		height: 110px;
		border-left: 2px solid #9a7a5a;
		border-top: 2px solid #9a7a5a;
		border-radius: 0 0 6px 0;
	}

	.piece-tags .piece-inner {
		justify-content: flex-end;
		align-items: flex-end;
		gap: 4px;
	}

	.tag {
		font-size: 9px;
		color: #c8b090;
		background: rgba(154, 122, 90, 0.2);
		padding: 2px 6px;
		border-radius: 3px;
	}

	.guardian {
		font-size: 9px;
		color: #9a7a5a;
		margin-top: 4px;
	}

	/* Connection lines */
	.connection-lines {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 0;
	}

	.conn-line {
		stroke: rgba(255, 255, 255, 0.05);
		stroke-width: 1;
		fill: none;
		stroke-dasharray: 4 4;
	}
</style>
