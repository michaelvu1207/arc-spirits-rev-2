<script lang="ts">
	/**
	 * V17: Diagonal Sidebar Layout
	 * Rune costs stacked diagonally on right edge, main content flows left
	 * Angular, asymmetric composition with slanted dividers
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="diagonal-card">
	<div class="main-area">
		<div class="diagonal-accent"></div>

		<div class="content-zone">
			<div class="header-row">
				<span class="sigil">◆</span>
				<h2 class="artifact-name">{artifact.name}</h2>
			</div>

			<div class="slant-divider"></div>

			<p class="benefit">{artifact.benefit}</p>

			<div class="bottom-info">
				{#if guardianName}
					<span class="guardian">⚔ {guardianName}</span>
				{/if}
				{#if tagNames.length > 0}
					<span class="tags">{tagNames.join(' • ')}</span>
				{/if}
			</div>
		</div>
	</div>

	<div class="diagonal-sidebar">
		<div class="sidebar-bg"></div>
		<div class="rune-stack">
			{#if recipeIcons.length > 0}
				{#each recipeIcons as icon, i (i)}
					<div class="rune-slot" style="--index: {i}">
						<img src={icon} alt="rune" class="rune-icon" />
					</div>
				{/each}
			{:else}
				<div class="empty-slot">✧</div>
			{/if}
		</div>
		<div class="sidebar-label">COST</div>
	</div>
</div>

<style>
	.diagonal-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		position: relative;
		display: flex;
		background: #1a1520;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
	}

	.main-area {
		flex: 1;
		position: relative;
		padding: 12px;
		padding-right: 93px;
		display: flex;
		flex-direction: column;
		clip-path: polygon(0 0, 100% 0, 80% 100%, 0 100%);
		background: linear-gradient(135deg, #2a2035 0%, #1a1520 100%);
	}

	.diagonal-accent {
		position: absolute;
		top: 0;
		right: 0;
		width: 60px;
		height: 100%;
		background: linear-gradient(135deg, transparent 40%, rgba(180, 140, 100, 0.1) 100%);
		pointer-events: none;
	}

	.content-zone {
		flex: 1;
		display: flex;
		flex-direction: column;
		position: relative;
		z-index: 1;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}

	.sigil {
		font-size: 24px;
		color: #c4a060;
		text-shadow: 0 0 8px rgba(196, 160, 96, 0.5);
	}

	.artifact-name {
		font-size: 22px;
		font-weight: 700;
		color: #e8d4b8;
		margin: 0;
		letter-spacing: 0.5px;
	}

	.slant-divider {
		width: 80%;
		height: 4px;
		background: linear-gradient(90deg, #c4a060 0%, transparent 100%);
		transform: skewX(-6deg);
		margin-bottom: 10px;
	}

	.benefit {
		font-size: 13px;
		color: #a8a0b0;
		line-height: 1.4;
		margin: 0;
		flex: 1;
	}

	.bottom-info {
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: #908898;
		padding-top: 9px;
		border-top: 1px solid rgba(180, 140, 100, 0.2);
	}

	.guardian {
		font-weight: 600;
		color: #c4a060;
	}

	.diagonal-sidebar {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 59px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		z-index: 2;
	}

	.sidebar-bg {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, #3a2a40 0%, #2a1a30 100%);
		clip-path: polygon(30% 0, 100% 0, 100% 100%, 0% 100%);
		border-left: 2px solid #c4a060;
		transform: skewX(-8deg);
		transform-origin: bottom;
	}

	.rune-stack {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-left: 0px;
		margin-top: 9px;
	}

	.rune-slot {
		width: 48px;
		height: 48px;
		background: rgba(0, 0, 0, 0.4);
		border: 2px solid rgba(196, 160, 96, 0.6);
		border-radius: 50%;
		padding: 2px;
		transform: translateX(calc(var(--index) * -9px));
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.4),
			inset 0 0 10px rgba(196, 160, 96, 0.1);
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
	}

	.empty-slot {
		font-size: 18px;
		color: rgba(196, 160, 96, 0.4);
	}

	.sidebar-label {
		position: absolute;
		bottom: 8px;
		right: 8px;
		font-size: 8px;
		letter-spacing: 2px;
		color: rgba(196, 160, 96, 0.6);
		transform: rotate(-90deg);
		transform-origin: right bottom;
		white-space: nowrap;
	}
</style>
