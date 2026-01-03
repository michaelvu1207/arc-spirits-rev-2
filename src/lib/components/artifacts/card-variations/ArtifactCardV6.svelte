<script lang="ts">
	/**
	 * V6: Dwarven Forge Style
	 * Hammered metal, rivets, bronze/iron tones, rugged industrial craftsmanship
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="forge-card">
	<div class="metal-plate">
		<div class="hammer-texture"></div>

		<div class="rivet tl"></div>
		<div class="rivet tr"></div>
		<div class="rivet bl"></div>
		<div class="rivet br"></div>

		<div class="corner-bracket tl"></div>
		<div class="corner-bracket tr"></div>
		<div class="corner-bracket bl"></div>
		<div class="corner-bracket br"></div>

		<div class="inner-plate">
			<div class="forge-glow"></div>

			<div class="header-bar">
				<span class="hammer-icon">⚒</span>
				<h2 class="artifact-name">{artifact.name}</h2>
				<span class="hammer-icon">⚒</span>
			</div>

			<div class="metal-divider">
				<span class="bolt">◉</span>
				<span class="bar"></span>
				<span class="anvil">⚔</span>
				<span class="bar"></span>
				<span class="bolt">◉</span>
			</div>

			<p class="benefit">{artifact.benefit}</p>

			{#if recipeIcons.length > 0}
				<div class="recipe-row">
					{#each recipeIcons as icon, i (i)}
						<div class="gear-socket">
							<img src={icon} alt="rune" class="rune-icon" />
						</div>
					{/each}
				</div>
			{/if}

			<div class="footer-strip">
				{#if guardianName}
					<span class="guardian">⚙ {guardianName}</span>
				{/if}
				{#if tagNames.length > 0}
					<span class="tags">{tagNames.join(' • ')}</span>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.forge-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
	}

	.metal-plate {
		width: 100%;
		height: 100%;
		background: linear-gradient(
			150deg,
			#4a4035 0%,
			#5c5045 20%,
			#3d3530 50%,
			#4a4035 80%,
			#5c5045 100%
		);
		border-radius: 4px;
		position: relative;
		padding: 8px;
		box-sizing: border-box;
		border: 3px solid #2a2520;
	}

	.hammer-texture {
		position: absolute;
		inset: 0;
		opacity: 0.15;
		background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cellipse cx='10' cy='10' rx='8' ry='4' fill='%23000' opacity='0.3'/%3E%3C/svg%3E");
		background-size: 15px 10px;
		pointer-events: none;
	}

	.rivet {
		position: absolute;
		width: 12px;
		height: 12px;
		background: radial-gradient(
			circle at 35% 35%,
			#8a7050 0%,
			#5a4530 40%,
			#3a2a1a 100%
		);
		border-radius: 50%;
		box-shadow:
			inset 1px 1px 2px rgba(255, 255, 255, 0.3),
			inset -1px -1px 2px rgba(0, 0, 0, 0.5),
			0 2px 3px rgba(0, 0, 0, 0.4);
		z-index: 5;
	}

	.rivet.tl { top: 6px; left: 6px; }
	.rivet.tr { top: 6px; right: 6px; }
	.rivet.bl { bottom: 6px; left: 6px; }
	.rivet.br { bottom: 6px; right: 6px; }

	.corner-bracket {
		position: absolute;
		width: 24px;
		height: 24px;
		border: 2px solid #6a5a40;
	}

	.corner-bracket.tl {
		top: 16px;
		left: 16px;
		border-right: none;
		border-bottom: none;
	}

	.corner-bracket.tr {
		top: 16px;
		right: 16px;
		border-left: none;
		border-bottom: none;
	}

	.corner-bracket.bl {
		bottom: 16px;
		left: 16px;
		border-right: none;
		border-top: none;
	}

	.corner-bracket.br {
		bottom: 16px;
		right: 16px;
		border-left: none;
		border-top: none;
	}

	.inner-plate {
		width: 100%;
		height: 100%;
		background: linear-gradient(
			180deg,
			#2a2520 0%,
			#352f28 30%,
			#2a2520 70%,
			#1f1a15 100%
		);
		border: 2px solid #5a5040;
		border-radius: 2px;
		padding: 12px 16px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		position: relative;
		overflow: hidden;
	}

	.forge-glow {
		position: absolute;
		bottom: -20px;
		left: 50%;
		transform: translateX(-50%);
		width: 150px;
		height: 60px;
		background: radial-gradient(
			ellipse,
			rgba(255, 120, 40, 0.15) 0%,
			rgba(255, 80, 20, 0.08) 40%,
			transparent 70%
		);
		pointer-events: none;
	}

	.header-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-bottom: 6px;
	}

	.hammer-icon {
		color: #a89070;
		font-size: 14px;
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 700;
		color: #d4b896;
		margin: 0;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		text-shadow:
			0 1px 0 rgba(0, 0, 0, 0.8),
			0 0 10px rgba(255, 140, 60, 0.3);
	}

	.metal-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		margin-bottom: 8px;
		color: #8a7060;
	}

	.bolt {
		font-size: 8px;
	}

	.bar {
		flex: 1;
		max-width: 40px;
		height: 3px;
		background: linear-gradient(
			180deg,
			#6a5a40 0%,
			#4a3a28 50%,
			#6a5a40 100%
		);
		border-radius: 1px;
	}

	.anvil {
		font-size: 12px;
		color: #c4a070;
	}

	.benefit {
		font-size: 11px;
		color: #b0a090;
		text-align: center;
		line-height: 1.4;
		margin: 0;
		flex: 1;
	}

	.recipe-row {
		display: flex;
		justify-content: center;
		gap: 10px;
		margin: 10px 0;
	}

	.gear-socket {
		width: 28px;
		height: 28px;
		background: linear-gradient(145deg, #5a4a35 0%, #3a2a1f 100%);
		border: 2px solid #7a6a50;
		clip-path: polygon(
			30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%
		);
		padding: 3px;
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.5),
			0 2px 4px rgba(0, 0, 0, 0.4);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		object-fit: cover;
		clip-path: polygon(
			30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%
		);
	}

	.footer-strip {
		display: flex;
		justify-content: space-between;
		padding: 6px 8px 4px;
		margin: 0 -8px -4px;
		font-size: 9px;
		color: #a89070;
		background: linear-gradient(
			180deg,
			transparent 0%,
			rgba(90, 70, 50, 0.3) 100%
		);
		border-top: 1px solid rgba(138, 112, 80, 0.3);
	}

	.guardian {
		font-weight: 600;
	}

	.tags {
		opacity: 0.8;
	}
</style>
