<script lang="ts">
	/**
	 * V19: Split Horizontal Layout
	 * Bold header section on top, tabbed info section below
	 * Clear separation with contrasting zones
	 */

	interface Props {
		artifact: { name: string; benefit: string };
		recipeIcons?: string[];
		tagNames?: string[];
		guardianName?: string | null;
	}

	let { artifact, recipeIcons = [], tagNames = [], guardianName = null }: Props = $props();
</script>

<div class="split-card">
	<!-- Top Header Zone -->
	<div class="header-zone">
		<div class="header-pattern"></div>
		<div class="header-content">
			<div class="title-block">
				<div class="icon-badge">⬡</div>
				<h2 class="artifact-name">{artifact.name}</h2>
			</div>
			{#if guardianName}
				<div class="guardian-tag">{guardianName}</div>
			{/if}
		</div>
		<div class="zone-divider">
			<span class="divider-notch left"></span>
			<span class="divider-center">◇</span>
			<span class="divider-notch right"></span>
		</div>
	</div>

	<!-- Bottom Info Zone -->
	<div class="info-zone">
		<div class="columns">
			<!-- Left column: Description -->
			<div class="desc-column">
				<div class="column-header">EFFECT</div>
				<p class="benefit">{artifact.benefit}</p>
			</div>

			<!-- Right column: Runes & Tags -->
			<div class="meta-column">
				<div class="column-header">REQUIRES</div>
				<div class="rune-grid">
					{#if recipeIcons.length > 0}
						{#each recipeIcons as icon, i (i)}
							<div class="rune-cell">
								<img src={icon} alt="rune" class="rune-icon" />
							</div>
						{/each}
					{:else}
						<span class="no-cost">—</span>
					{/if}
				</div>
				{#if tagNames.length > 0}
					<div class="tag-row">
						{#each tagNames as tag, i (i)}
							<span class="tag-chip">{tag}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.split-card {
		width: 300px;
		height: 225px;
		font-family: 'Opsilon', serif;
		display: flex;
		flex-direction: column;
		border-radius: 6px;
		overflow: hidden;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
	}

	.header-zone {
		height: 75px;
		background: linear-gradient(135deg, #2d1f3d 0%, #1a1228 100%);
		position: relative;
		display: flex;
		flex-direction: column;
	}

	.header-pattern {
		position: absolute;
		inset: 0;
		opacity: 0.05;
		background-image: repeating-linear-gradient(
			45deg,
			transparent,
			transparent 10px,
			rgba(255, 255, 255, 0.1) 10px,
			rgba(255, 255, 255, 0.1) 11px
		);
	}

	.header-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		position: relative;
		z-index: 1;
	}

	.title-block {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.icon-badge {
		width: 32px;
		height: 32px;
		background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		color: white;
		box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
	}

	.artifact-name {
		font-size: 17px;
		font-weight: 700;
		color: #f0e8ff;
		margin: 0;
		letter-spacing: 0.5px;
	}

	.guardian-tag {
		font-size: 10px;
		color: #a78bfa;
		background: rgba(139, 92, 246, 0.2);
		padding: 4px 10px;
		border-radius: 12px;
		border: 1px solid rgba(139, 92, 246, 0.3);
	}

	.zone-divider {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 12px;
		background: #0f0a14;
		position: relative;
	}

	.divider-notch {
		flex: 1;
		height: 2px;
		background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.4));
	}

	.divider-notch.right {
		background: linear-gradient(90deg, rgba(139, 92, 246, 0.4), transparent);
	}

	.divider-center {
		font-size: 10px;
		color: #8b5cf6;
		padding: 0 8px;
	}

	.info-zone {
		flex: 1;
		background: linear-gradient(180deg, #12101a 0%, #0a0810 100%);
		padding: 12px;
	}

	.columns {
		display: flex;
		gap: 12px;
		height: 100%;
	}

	.desc-column {
		flex: 1.5;
		display: flex;
		flex-direction: column;
	}

	.meta-column {
		flex: 1;
		display: flex;
		flex-direction: column;
		border-left: 1px solid rgba(139, 92, 246, 0.2);
		padding-left: 12px;
	}

	.column-header {
		font-size: 8px;
		letter-spacing: 1.5px;
		color: #6d5a8a;
		margin-bottom: 6px;
		text-transform: uppercase;
	}

	.benefit {
		font-size: 10px;
		color: #9890a8;
		line-height: 1.5;
		margin: 0;
		flex: 1;
	}

	.rune-grid {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 8px;
	}

	.rune-cell {
		width: 26px;
		height: 26px;
		background: rgba(139, 92, 246, 0.15);
		border: 1px solid rgba(139, 92, 246, 0.3);
		border-radius: 4px;
		padding: 2px;
	}

	.rune-icon {
		width: 100%;
		height: 100%;
		border-radius: 2px;
		object-fit: cover;
	}

	.no-cost {
		color: #5a4a6a;
		font-size: 14px;
	}

	.tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: auto;
	}

	.tag-chip {
		font-size: 8px;
		color: #a78bfa;
		background: rgba(139, 92, 246, 0.1);
		padding: 2px 6px;
		border-radius: 3px;
	}
</style>
