<script lang="ts">
	/**
	 * V3: Mystical Crystal/Gem Card
	 * Faceted crystalline edges, inner prismatic glow, ethereal transparency
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="crystal-card">
	<div class="crystal-glow"></div>
	<div class="facet-layer">
		<div class="facet top-left"></div>
		<div class="facet top-right"></div>
		<div class="facet bottom-left"></div>
		<div class="facet bottom-right"></div>
	</div>

	<div class="inner-crystal">
		<div class="prismatic-shimmer"></div>
		<div class="frost-texture"></div>

		<div class="crystal-header">
			<div class="gem-icon">◇</div>
			<h2 class="artifact-name">{artifact.name}</h2>
			<div class="gem-icon">◇</div>
		</div>

		<div class="crystal-divider">
			<span class="shard">▽</span>
			<span class="line"></span>
			<span class="center-gem">❖</span>
			<span class="line"></span>
			<span class="shard">▽</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="crystal-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">✧ {guardianName} ✧</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ◈ ')}</span>
			{/if}
		</div>
	</div>

	<div class="edge-highlight top"></div>
	<div class="edge-highlight right"></div>
	<div class="edge-highlight bottom"></div>
	<div class="edge-highlight left"></div>
</div>

<style>
	.crystal-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		clip-path: polygon(
			8px 0,
			calc(100% - 8px) 0,
			100% 8px,
			100% calc(100% - 8px),
			calc(100% - 8px) 100%,
			8px 100%,
			0 calc(100% - 8px),
			0 8px
		);
	}

	.crystal-glow {
		position: absolute;
		inset: -20px;
		background: radial-gradient(
			ellipse at center,
			rgba(138, 180, 248, 0.4) 0%,
			rgba(99, 155, 255, 0.2) 40%,
			transparent 70%
		);
		filter: blur(15px);
		animation: pulse-glow 4s ease-in-out infinite;
		pointer-events: none;
	}

	@keyframes pulse-glow {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.05); }
	}

	.facet-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.facet {
		position: absolute;
		width: 40px;
		height: 40px;
		background: linear-gradient(
			135deg,
			rgba(255, 255, 255, 0.3) 0%,
			rgba(138, 180, 248, 0.2) 50%,
			transparent 100%
		);
	}

	.facet.top-left {
		top: 0;
		left: 0;
		clip-path: polygon(0 0, 100% 0, 0 100%);
	}

	.facet.top-right {
		top: 0;
		right: 0;
		clip-path: polygon(0 0, 100% 0, 100% 100%);
		background: linear-gradient(
			-135deg,
			rgba(255, 255, 255, 0.2) 0%,
			rgba(138, 180, 248, 0.15) 50%,
			transparent 100%
		);
	}

	.facet.bottom-left {
		bottom: 0;
		left: 0;
		clip-path: polygon(0 0, 0 100%, 100% 100%);
		background: linear-gradient(
			45deg,
			rgba(100, 120, 180, 0.2) 0%,
			transparent 100%
		);
	}

	.facet.bottom-right {
		bottom: 0;
		right: 0;
		clip-path: polygon(100% 0, 0 100%, 100% 100%);
		background: linear-gradient(
			-45deg,
			rgba(100, 120, 180, 0.15) 0%,
			transparent 100%
		);
	}

	.inner-crystal {
		width: 100%;
		height: 100%;
		background: linear-gradient(
			160deg,
			rgba(200, 220, 255, 0.95) 0%,
			rgba(170, 195, 245, 0.9) 20%,
			rgba(140, 170, 230, 0.85) 50%,
			rgba(120, 150, 220, 0.9) 80%,
			rgba(100, 130, 200, 0.95) 100%
		);
		display: flex;
		flex-direction: column;
		padding: 14px 18px;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.prismatic-shimmer {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			120deg,
			transparent 0%,
			rgba(255, 200, 220, 0.15) 20%,
			rgba(200, 255, 220, 0.15) 40%,
			rgba(220, 200, 255, 0.15) 60%,
			rgba(255, 255, 200, 0.15) 80%,
			transparent 100%
		);
		animation: shimmer 6s linear infinite;
		pointer-events: none;
	}

	@keyframes shimmer {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}

	.frost-texture {
		position: absolute;
		inset: 0;
		opacity: 0.1;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M50 0 L50 100 M0 50 L100 50 M25 25 L75 75 M75 25 L25 75' stroke='white' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
		background-size: 30px 30px;
		pointer-events: none;
	}

	.crystal-header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 6px;
	}

	.gem-icon {
		color: rgba(60, 80, 140, 0.6);
		font-size: 12px;
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 600;
		color: #2a3a6a;
		margin: 0;
		text-align: center;
		text-shadow:
			0 1px 0 rgba(255, 255, 255, 0.8),
			0 2px 8px rgba(100, 130, 200, 0.3);
		letter-spacing: 0.5px;
	}

	.crystal-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin-bottom: 8px;
		color: rgba(60, 80, 140, 0.5);
	}

	.shard {
		font-size: 8px;
	}

	.line {
		flex: 1;
		max-width: 40px;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(60, 80, 140, 0.4),
			transparent
		);
	}

	.center-gem {
		font-size: 10px;
		color: rgba(60, 80, 140, 0.7);
	}

	.benefit {
		font-size: 11px;
		color: #3a4a7a;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin: 10px 0;
	}

	.crystal-socket {
		width: 26px;
		height: 26px;
		background: rgba(255, 255, 255, 0.4);
		border: 2px solid rgba(100, 130, 200, 0.5);
		border-radius: 6px;
		padding: 2px;
		box-shadow:
			inset 0 0 8px rgba(138, 180, 248, 0.4),
			0 2px 4px rgba(60, 80, 140, 0.2);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 4px;
		object-fit: cover;
	}

	.footer {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: #4a5a8a;
		margin-top: auto;
		padding-top: 4px;
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}

	.edge-highlight {
		position: absolute;
		background: linear-gradient(
			90deg,
			transparent,
			rgba(255, 255, 255, 0.6),
			transparent
		);
		pointer-events: none;
	}

	.edge-highlight.top {
		top: 0;
		left: 20px;
		right: 20px;
		height: 1px;
	}

	.edge-highlight.bottom {
		bottom: 0;
		left: 20px;
		right: 20px;
		height: 1px;
		opacity: 0.3;
	}

	.edge-highlight.left {
		left: 0;
		top: 20px;
		bottom: 20px;
		width: 1px;
		background: linear-gradient(
			180deg,
			transparent,
			rgba(255, 255, 255, 0.5),
			transparent
		);
	}

	.edge-highlight.right {
		right: 0;
		top: 20px;
		bottom: 20px;
		width: 1px;
		background: linear-gradient(
			180deg,
			transparent,
			rgba(255, 255, 255, 0.3),
			transparent
		);
	}
</style>
