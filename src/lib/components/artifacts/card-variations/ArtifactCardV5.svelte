<script lang="ts">
	/**
	 * V5: Elven Nature Theme
	 * Organic vine borders, leaf patterns, forest greens, ethereal woodland magic
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="elven-card">
	<div class="vine-border top">
		<div class="vine-segment"></div>
		<div class="leaf left">🌿</div>
		<div class="leaf right">🌿</div>
	</div>
	<div class="vine-border left"></div>
	<div class="vine-border right"></div>
	<div class="vine-border bottom"></div>

	<div class="inner-panel">
		<div class="forest-mist"></div>
		<div class="leaf-pattern"></div>

		<div class="corner-leaf tl">❦</div>
		<div class="corner-leaf tr">❦</div>
		<div class="corner-leaf bl">❦</div>
		<div class="corner-leaf br">❦</div>

		<div class="header">
			<span class="leaf-icon">✿</span>
			<h2 class="artifact-name">{artifact.name}</h2>
			<span class="leaf-icon">✿</span>
		</div>

		<div class="vine-divider">
			<span class="tendril">⌇</span>
			<span class="flower">❁</span>
			<span class="tendril">⌇</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="acorn-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">❧ {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ❀ ')}</span>
			{/if}
		</div>
	</div>

	<div class="glow-particles">
		<span class="particle" style="--delay: 0s; --x: 20%; --y: 30%;">✦</span>
		<span class="particle" style="--delay: 1s; --x: 70%; --y: 50%;">✦</span>
		<span class="particle" style="--delay: 2s; --x: 40%; --y: 70%;">✦</span>
		<span class="particle" style="--delay: 0.5s; --x: 80%; --y: 25%;">✦</span>
	</div>
</div>

<style>
	.elven-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			160deg,
			#0d1f12 0%,
			#1a3020 30%,
			#0d1f12 60%,
			#152818 100%
		);
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 0 30px rgba(100, 200, 100, 0.2),
			inset 0 0 40px rgba(0, 0, 0, 0.5);
	}

	.vine-border {
		position: absolute;
		background: linear-gradient(
			90deg,
			#3d5c30 0%,
			#5a8045 50%,
			#3d5c30 100%
		);
	}

	.vine-border.top {
		top: 0;
		left: 20px;
		right: 20px;
		height: 6px;
		border-radius: 0 0 3px 3px;
	}

	.vine-border.bottom {
		bottom: 0;
		left: 20px;
		right: 20px;
		height: 6px;
		border-radius: 3px 3px 0 0;
	}

	.vine-border.left {
		left: 0;
		top: 20px;
		bottom: 20px;
		width: 6px;
		border-radius: 0 3px 3px 0;
		background: linear-gradient(
			180deg,
			#3d5c30 0%,
			#5a8045 50%,
			#3d5c30 100%
		);
	}

	.vine-border.right {
		right: 0;
		top: 20px;
		bottom: 20px;
		width: 6px;
		border-radius: 3px 0 0 3px;
		background: linear-gradient(
			180deg,
			#3d5c30 0%,
			#5a8045 50%,
			#3d5c30 100%
		);
	}

	.vine-border.top .leaf {
		position: absolute;
		top: -2px;
		font-size: 14px;
		filter: hue-rotate(-10deg) brightness(0.8);
	}

	.vine-border.top .leaf.left {
		left: -8px;
		transform: rotate(-45deg);
	}

	.vine-border.top .leaf.right {
		right: -8px;
		transform: rotate(45deg) scaleX(-1);
	}

	.inner-panel {
		position: absolute;
		inset: 10px;
		background: linear-gradient(
			180deg,
			rgba(26, 48, 32, 0.9) 0%,
			rgba(20, 38, 25, 0.95) 50%,
			rgba(26, 48, 32, 0.9) 100%
		);
		border: 1px solid rgba(100, 160, 80, 0.3);
		border-radius: 8px;
		padding: 14px 18px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.forest-mist {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			ellipse at 50% 100%,
			rgba(100, 180, 100, 0.1) 0%,
			transparent 60%
		);
		pointer-events: none;
	}

	.leaf-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.03;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 50 50' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M25 5 Q35 15 25 30 Q15 15 25 5' stroke='%2390c070' stroke-width='0.5' fill='none'/%3E%3C/svg%3E");
		background-size: 40px 40px;
		pointer-events: none;
	}

	.corner-leaf {
		position: absolute;
		font-size: 14px;
		color: rgba(100, 160, 80, 0.4);
	}

	.corner-leaf.tl { top: 4px; left: 6px; transform: rotate(-45deg); }
	.corner-leaf.tr { top: 4px; right: 6px; transform: rotate(45deg); }
	.corner-leaf.bl { bottom: 4px; left: 6px; transform: rotate(-135deg); }
	.corner-leaf.br { bottom: 4px; right: 6px; transform: rotate(135deg); }

	.header {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 6px;
	}

	.leaf-icon {
		color: rgba(140, 200, 100, 0.6);
		font-size: 12px;
	}

	.artifact-name {
		font-size: 18px;
		font-weight: 600;
		color: #a8d890;
		margin: 0;
		text-align: center;
		text-shadow:
			0 0 10px rgba(100, 180, 100, 0.4),
			0 1px 2px rgba(0, 0, 0, 0.5);
		letter-spacing: 0.5px;
	}

	.vine-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-bottom: 8px;
		color: rgba(100, 160, 80, 0.6);
	}

	.tendril {
		font-size: 14px;
		opacity: 0.6;
	}

	.flower {
		font-size: 14px;
		color: rgba(200, 150, 180, 0.6);
	}

	.benefit {
		font-size: 11px;
		color: #90b880;
		text-align: center;
		line-height: 1.45;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 8px;
		margin: 10px 0;
	}

	.acorn-socket {
		width: 26px;
		height: 26px;
		background: linear-gradient(145deg, #5a4030 0%, #3d2a1f 100%);
		border: 2px solid rgba(100, 160, 80, 0.5);
		border-radius: 50% 50% 40% 40%;
		padding: 2px;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.4),
			inset 0 1px 2px rgba(255, 255, 255, 0.1);
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
		color: rgba(160, 200, 140, 0.8);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(100, 160, 80, 0.2);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}

	.glow-particles {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.particle {
		position: absolute;
		left: var(--x);
		top: var(--y);
		font-size: 6px;
		color: rgba(180, 255, 150, 0.6);
		animation: float-particle 4s ease-in-out infinite;
		animation-delay: var(--delay);
	}

	@keyframes float-particle {
		0%, 100% {
			opacity: 0;
			transform: translateY(0) scale(0.5);
		}
		50% {
			opacity: 1;
			transform: translateY(-10px) scale(1);
		}
	}
</style>
