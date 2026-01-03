<script lang="ts">
	/**
	 * Preview component displaying all 24 artifact card variations
	 * Organized into Theme Variations (V1-V16) and Layout Variations (V17-V24)
	 */

	import ArtifactCardV1 from './ArtifactCardV1.svelte';
	import ArtifactCardV2 from './ArtifactCardV2.svelte';
	import ArtifactCardV3 from './ArtifactCardV3.svelte';
	import ArtifactCardV4 from './ArtifactCardV4.svelte';
	import ArtifactCardV5 from './ArtifactCardV5.svelte';
	import ArtifactCardV6 from './ArtifactCardV6.svelte';
	import ArtifactCardV7 from './ArtifactCardV7.svelte';
	import ArtifactCardV8 from './ArtifactCardV8.svelte';
	import ArtifactCardV9 from './ArtifactCardV9.svelte';
	import ArtifactCardV10 from './ArtifactCardV10.svelte';
	import ArtifactCardV11 from './ArtifactCardV11.svelte';
	import ArtifactCardV12 from './ArtifactCardV12.svelte';
	import ArtifactCardV13 from './ArtifactCardV13.svelte';
	import ArtifactCardV14 from './ArtifactCardV14.svelte';
	import ArtifactCardV15 from './ArtifactCardV15.svelte';
	import ArtifactCardV16 from './ArtifactCardV16.svelte';
	import ArtifactCardV17 from './ArtifactCardV17.svelte';
	import ArtifactCardV18 from './ArtifactCardV18.svelte';
	import ArtifactCardV19 from './ArtifactCardV19.svelte';
	import ArtifactCardV20 from './ArtifactCardV20.svelte';
	import ArtifactCardV21 from './ArtifactCardV21.svelte';
	import ArtifactCardV22 from './ArtifactCardV22.svelte';
	import ArtifactCardV23 from './ArtifactCardV23.svelte';
	import ArtifactCardV24 from './ArtifactCardV24.svelte';

	// Sample artifact data for preview
	const sampleArtifact = {
		name: 'Crystal Aegis',
		benefit: 'Grants the bearer immunity to magical damage for one turn when activated. Recharges after 3 rounds.'
	};

	const sampleRecipeIcons = [
		'/icons/rune-fire.png',
		'/icons/rune-water.png',
		'/icons/rune-earth.png'
	];

	const sampleTagNames = ['Defense', 'Legendary'];
	const sampleGuardianName = 'Crystallos';

	const themeVariations = [
		{ component: ArtifactCardV1, name: 'V1: Ancient Scroll', description: 'Wax seal & parchment' },
		{ component: ArtifactCardV2, name: 'V2: Gilded Frame', description: 'Gold & gemstones' },
		{ component: ArtifactCardV3, name: 'V3: Crystal Gem', description: 'Faceted & prismatic' },
		{ component: ArtifactCardV4, name: 'V4: Arcane Tome', description: 'Runic & occult' },
		{ component: ArtifactCardV5, name: 'V5: Elven Nature', description: 'Vines & leaves' },
		{ component: ArtifactCardV6, name: 'V6: Dwarven Forge', description: 'Metal & rivets' },
		{ component: ArtifactCardV7, name: 'V7: Celestial', description: 'Stars & cosmos' },
		{ component: ArtifactCardV8, name: 'V8: Dragon Scale', description: 'Fire & scales' },
		{ component: ArtifactCardV9, name: 'V9: Heraldic Banner', description: 'Royal & noble' },
		{ component: ArtifactCardV10, name: 'V10: Stone Tablet', description: 'Carved & ancient' },
		{ component: ArtifactCardV11, name: 'V11: Enchanted Mirror', description: 'Reflective & mystical' },
		{ component: ArtifactCardV12, name: 'V12: Alchemist Recipe', description: 'Potions & ingredients' },
		{ component: ArtifactCardV13, name: 'V13: Fairy Fey', description: 'Sparkles & whimsy' },
		{ component: ArtifactCardV14, name: 'V14: Necromancer', description: 'Bones & shadows' },
		{ component: ArtifactCardV15, name: 'V15: Ocean Depths', description: 'Waves & shells' },
		{ component: ArtifactCardV16, name: 'V16: Phoenix Rebirth', description: 'Flames & renewal' }
	];

	const layoutVariations = [
		{ component: ArtifactCardV17, name: 'V17: Diagonal Sidebar', description: 'Angled rune column' },
		{ component: ArtifactCardV18, name: 'V18: Radial Compass', description: 'Circular orbiting layout' },
		{ component: ArtifactCardV19, name: 'V19: Split Horizontal', description: 'Two-zone columns' },
		{ component: ArtifactCardV20, name: 'V20: Corner Anchor', description: 'Diagonal content flow' },
		{ component: ArtifactCardV21, name: 'V21: Ribbon Bands', description: 'Stacked banner strips' },
		{ component: ArtifactCardV22, name: 'V22: Puzzle Pieces', description: 'Interlocking sections' },
		{ component: ArtifactCardV23, name: 'V23: Nested Frames', description: 'Concentric layers' },
		{ component: ArtifactCardV24, name: 'V24: Vertical Scroll', description: 'Wide margin document' }
	];
</script>

<div class="preview-container">
	<h1 class="preview-title">Artifact Card Variations</h1>
	<p class="preview-subtitle">24 distinct fantasy styles using Opsilon font</p>

	<section class="section">
		<h2 class="section-title">Theme Variations (V1-V16)</h2>
		<p class="section-desc">Different visual themes with standard layout</p>
		<div class="cards-grid">
			{#each themeVariations as variation (variation.name)}
				<div class="card-wrapper">
					<div class="card-label">
						<span class="label-name">{variation.name}</span>
						<span class="label-desc">{variation.description}</span>
					</div>
					<variation.component
						artifact={sampleArtifact}
						recipeIcons={sampleRecipeIcons}
						tagNames={sampleTagNames}
						guardianName={sampleGuardianName}
					/>
				</div>
			{/each}
		</div>
	</section>

	<section class="section">
		<h2 class="section-title">Layout Variations (V17-V24)</h2>
		<p class="section-desc">Fundamentally different structural layouts</p>
		<div class="cards-grid">
			{#each layoutVariations as variation (variation.name)}
				<div class="card-wrapper">
					<div class="card-label">
						<span class="label-name">{variation.name}</span>
						<span class="label-desc">{variation.description}</span>
					</div>
					<variation.component
						artifact={sampleArtifact}
						recipeIcons={sampleRecipeIcons}
						tagNames={sampleTagNames}
						guardianName={sampleGuardianName}
					/>
				</div>
			{/each}
		</div>
	</section>
</div>

<style>
	.preview-container {
		min-height: 100vh;
		background: linear-gradient(180deg, #1a1520 0%, #0f0a15 100%);
		padding: 40px;
		font-family: 'Opsilon', serif;
	}

	.preview-title {
		text-align: center;
		font-size: 36px;
		font-weight: 700;
		color: #e8d4c0;
		margin: 0 0 8px 0;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
	}

	.preview-subtitle {
		text-align: center;
		font-size: 16px;
		color: #a090a0;
		margin: 0 0 40px 0;
	}

	.section {
		margin-bottom: 60px;
	}

	.section-title {
		font-size: 24px;
		font-weight: 600;
		color: #c8b8a0;
		text-align: center;
		margin: 0 0 8px 0;
	}

	.section-desc {
		font-size: 14px;
		color: #8a7a6a;
		text-align: center;
		margin: 0 0 30px 0;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 40px;
		max-width: 1600px;
		margin: 0 auto;
	}

	.card-wrapper {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.card-label {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
	}

	.label-name {
		font-size: 14px;
		font-weight: 600;
		color: #c8b8a0;
	}

	.label-desc {
		font-size: 12px;
		color: #8a7a6a;
		font-style: italic;
	}
</style>
