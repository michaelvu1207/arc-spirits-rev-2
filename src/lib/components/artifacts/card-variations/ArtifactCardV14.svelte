<script lang="ts">
	/**
	 * V14: Necromancer/Undead Theme
	 * Bones, skulls, ghostly wisps, dark shadows, death magic
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="necro-card">
	<div class="shadow-mist"></div>
	<div class="bone-border">
		<div class="bone top-left"></div>
		<div class="bone top-right"></div>
		<div class="bone bottom-left"></div>
		<div class="bone bottom-right"></div>
	</div>

	<div class="ghostly-wisps">
		<div class="wisp w1"></div>
		<div class="wisp w2"></div>
		<div class="wisp w3"></div>
	</div>

	<div class="necro-content">
		<div class="skull-header">
			<span class="skull">💀</span>
		</div>

		<h2 class="artifact-name">{artifact.name}</h2>

		<div class="death-divider">
			<span class="cross">✝</span>
			<span class="chain"></span>
			<span class="eye">👁</span>
			<span class="chain"></span>
			<span class="cross">✝</span>
		</div>

		<p class="benefit">{artifact.benefit}</p>

		{#if recipeIcons.length > 0}
			<div class="recipe-row">
				{#each recipeIcons as icon, i (i)}
					<div class="soul-socket">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			</div>
		{/if}

		<div class="footer">
			{#if guardianName}
				<span class="guardian">☠ {guardianName}</span>
			{/if}
			{#if tagNames.length > 0}
				<span class="tags">{tagNames.join(' ⚰ ')}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.necro-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		background: linear-gradient(
			180deg,
			#0a080c 0%,
			#151018 30%,
			#1a141f 60%,
			#0f0a12 100%
		);
		border-radius: 4px;
		overflow: hidden;
		box-shadow:
			0 0 30px rgba(0, 0, 0, 0.8),
			inset 0 0 40px rgba(60, 40, 80, 0.1);
	}

	.shadow-mist {
		position: absolute;
		inset: 0;
		background:
			radial-gradient(ellipse at 30% 80%, rgba(80, 60, 100, 0.15) 0%, transparent 50%),
			radial-gradient(ellipse at 70% 20%, rgba(60, 80, 60, 0.1) 0%, transparent 40%);
		pointer-events: none;
	}

	.bone-border {
		position: absolute;
		inset: 8px;
		border: 2px solid rgba(200, 190, 170, 0.3);
		border-radius: 2px;
	}

	.bone {
		position: absolute;
		width: 30px;
		height: 8px;
		background: linear-gradient(
			180deg,
			#d8d0c0 0%,
			#c0b8a8 50%,
			#a8a090 100%
		);
		border-radius: 4px;
	}

	.bone::before,
	.bone::after {
		content: '';
		position: absolute;
		width: 10px;
		height: 10px;
		background: inherit;
		border-radius: 50%;
		top: -1px;
	}

	.bone::before { left: -3px; }
	.bone::after { right: -3px; }

	.bone.top-left { top: -4px; left: 20px; transform: rotate(-20deg); }
	.bone.top-right { top: -4px; right: 20px; transform: rotate(20deg); }
	.bone.bottom-left { bottom: -4px; left: 20px; transform: rotate(20deg); }
	.bone.bottom-right { bottom: -4px; right: 20px; transform: rotate(-20deg); }

	.ghostly-wisps {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.wisp {
		position: absolute;
		width: 40px;
		height: 60px;
		background: radial-gradient(
			ellipse,
			rgba(180, 200, 180, 0.15) 0%,
			transparent 70%
		);
		animation: wisp-float 4s ease-in-out infinite;
	}

	.wisp.w1 { left: 15%; top: 30%; animation-delay: 0s; }
	.wisp.w2 { right: 20%; top: 50%; animation-delay: 1.5s; }
	.wisp.w3 { left: 40%; bottom: 20%; animation-delay: 3s; }

	@keyframes wisp-float {
		0%, 100% { opacity: 0.3; transform: translateY(0) scale(1); }
		50% { opacity: 0.8; transform: translateY(-10px) scale(1.1); }
	}

	.necro-content {
		position: absolute;
		inset: 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.skull-header {
		margin-bottom: 2px;
	}

	.skull {
		font-size: 24px;
		filter: grayscale(0.3);
		animation: skull-glow 3s ease-in-out infinite;
	}

	@keyframes skull-glow {
		0%, 100% { filter: grayscale(0.3) drop-shadow(0 0 0 transparent); }
		50% { filter: grayscale(0) drop-shadow(0 0 8px rgba(100, 200, 100, 0.4)); }
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 700;
		color: #b8c0b8;
		margin: 0 0 6px 0;
		text-align: center;
		text-shadow: 0 0 10px rgba(100, 150, 100, 0.3);
		letter-spacing: 1px;
	}

	.death-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
		color: rgba(180, 170, 160, 0.6);
	}

	.cross {
		font-size: 10px;
	}

	.chain {
		flex: 1;
		max-width: 30px;
		height: 2px;
		background: repeating-linear-gradient(
			90deg,
			rgba(180, 170, 160, 0.4) 0px,
			rgba(180, 170, 160, 0.4) 4px,
			transparent 4px,
			transparent 8px
		);
	}

	.eye {
		font-size: 12px;
		animation: eye-blink 4s ease-in-out infinite;
	}

	@keyframes eye-blink {
		0%, 45%, 55%, 100% { opacity: 1; }
		50% { opacity: 0.2; }
	}

	.benefit {
		font-size: 11px;
		color: #90a090;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
		font-style: italic;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 8px 0;
	}

	.soul-socket {
		width: 26px;
		height: 26px;
		background: rgba(30, 25, 35, 0.8);
		border: 2px solid rgba(180, 200, 180, 0.4);
		border-radius: 50%;
		padding: 2px;
		box-shadow:
			0 0 10px rgba(100, 150, 100, 0.2),
			inset 0 0 8px rgba(0, 0, 0, 0.5);
		animation: soul-pulse 3s ease-in-out infinite;
	}

	@keyframes soul-pulse {
		0%, 100% { box-shadow: 0 0 10px rgba(100, 150, 100, 0.2), inset 0 0 8px rgba(0, 0, 0, 0.5); }
		50% { box-shadow: 0 0 15px rgba(100, 180, 100, 0.4), inset 0 0 8px rgba(0, 0, 0, 0.5); }
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		filter: grayscale(0.2);
	}

	.footer {
		display: flex;
		justify-content: space-between;
		width: 100%;
		font-size: 9px;
		color: rgba(160, 180, 160, 0.8);
		margin-top: auto;
		padding-top: 4px;
		border-top: 1px solid rgba(180, 170, 160, 0.2);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}
</style>
