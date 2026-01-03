<script lang="ts">
	/**
	 * V23: Frame-in-Frame Nested Layout
	 * Concentric frames with info at different depth layers
	 * Russian nesting doll aesthetic, each layer has purpose
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="nested-card">
	<!-- Outermost frame: Tags & Guardian -->
	<div class="frame frame-outer">
		<div class="frame-label top-left">{tagNames[0] || 'Artifact'}</div>
		<div class="frame-label top-right">{tagNames[1] || ''}</div>
		<div class="frame-label bottom-left">{guardianName || 'Unbound'}</div>
		<div class="frame-label bottom-right">◆</div>

		<!-- Middle frame: Runes -->
		<div class="frame frame-middle">
			<div class="rune-corners">
				{#if recipeIcons.length > 0}
					{#each recipeIcons as icon, i (i)}
						<div class="corner-rune" style="--pos: {i}">
							<img src={icon} alt="rune" class="rune-icon" />
						</div>
					{/each}
				{/if}
			</div>

			<!-- Inner frame: Name & Description -->
			<div class="frame frame-inner">
				<div class="inner-glow"></div>

				<div class="center-content">
					<div class="title-ornament">❖</div>
					<h2 class="artifact-name">{artifact.name}</h2>
					<div class="ornament-line"></div>
					<p class="benefit">{artifact.benefit}</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.nested-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		background: #08060a;
		border-radius: 8px;
		padding: 6px;
		box-sizing: border-box;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
	}

	.frame {
		width: 100%;
		height: 100%;
		position: relative;
		box-sizing: border-box;
	}

	/* Outer frame */
	.frame-outer {
		background: linear-gradient(135deg, #1a1420 0%, #12101a 100%);
		border: 2px solid #4a3a5a;
		border-radius: 6px;
		padding: 16px;
	}

	.frame-label {
		position: absolute;
		font-size: 8px;
		letter-spacing: 1px;
		color: #6a5a7a;
		text-transform: uppercase;
	}

	.frame-label.top-left { top: 4px; left: 8px; }
	.frame-label.top-right { top: 4px; right: 8px; }
	.frame-label.bottom-left { bottom: 4px; left: 8px; }
	.frame-label.bottom-right { bottom: 4px; right: 8px; font-size: 10px; }

	/* Middle frame */
	.frame-middle {
		background: linear-gradient(135deg, #201828 0%, #181420 100%);
		border: 2px solid #6a5a3a;
		border-radius: 5px;
		padding: 20px;
	}

	.rune-corners {
		position: absolute;
		inset: 6px;
		pointer-events: none;
	}

	.corner-rune {
		position: absolute;
		width: 26px;
		height: 26px;
		background: rgba(106, 90, 58, 0.3);
		border: 1px solid rgba(106, 90, 58, 0.6);
		border-radius: 4px;
		padding: 2px;
	}

	.corner-rune[style*="--pos: 0"] { top: 0; left: 0; }
	.corner-rune[style*="--pos: 1"] { top: 0; right: 0; }
	.corner-rune[style*="--pos: 2"] { bottom: 0; left: 0; }
	.corner-rune[style*="--pos: 3"] { bottom: 0; right: 0; }

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 2px;
		object-fit: cover;
	}

	/* Inner frame */
	.frame-inner {
		background: linear-gradient(180deg, #281830 0%, #1a1020 50%, #201428 100%);
		border: 2px solid #8a6a4a;
		border-radius: 4px;
		padding: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.inner-glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(ellipse at center, rgba(138, 106, 74, 0.15) 0%, transparent 60%);
		pointer-events: none;
	}

	.center-content {
		position: relative;
		z-index: 1;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.title-ornament {
		font-size: 14px;
		color: #c4a060;
		text-shadow: 0 0 10px rgba(196, 160, 96, 0.5);
	}

	.artifact-name {
		font-size: 15px;
		font-weight: 700;
		color: #e8d4b8;
		margin: 0;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
	}

	.ornament-line {
		width: 60px;
		height: 1px;
		background: linear-gradient(90deg, transparent, #c4a060, transparent);
		margin: 4px 0;
	}

	.benefit {
		font-size: 10px;
		color: #a89888;
		line-height: 1.4;
		margin: 0;
		max-width: 180px;
	}
</style>
