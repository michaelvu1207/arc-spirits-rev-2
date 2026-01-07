<script lang="ts">
	import MonsterCardPreview from '$lib/components/monsters/MonsterCardPreview.svelte';
	import EventCardV1 from '$lib/components/events/card-variations/EventCardV1.svelte';
	import EventCardV2 from '$lib/components/events/card-variations/EventCardV2.svelte';
	import EventCardV3 from '$lib/components/events/card-variations/EventCardV3.svelte';
	import EventCardV4 from '$lib/components/events/card-variations/EventCardV4.svelte';

	import { REWARD_ROW_CONFIG } from '$lib/types/gameData';

	// Sample reward row data for preview (using placeholder colored boxes)
	const sampleRewardRows = {
		allInCombat: {
			type: 'all_in_combat' as const,
			icon_ids: ['1', '2', '3'],
			icon_urls: [
				'https://placehold.co/32x32/fbbf24/000?text=R1',
				'https://placehold.co/32x32/fbbf24/000?text=R2',
				'https://placehold.co/32x32/fbbf24/000?text=R3'
			]
		},
		allWinners: {
			type: 'all_winners' as const,
			icon_ids: ['1', '2'],
			icon_urls: [
				'https://placehold.co/32x32/4ade80/000?text=W1',
				'https://placehold.co/32x32/4ade80/000?text=W2'
			]
		},
		oneWinner: {
			type: 'one_winner' as const,
			icon_ids: ['1'],
			icon_urls: [
				'https://placehold.co/32x32/38bdf8/000?text=1W'
			]
		},
		tournament: {
			type: 'tournament' as const,
			icon_ids: ['1', '2', '3', '4', '5'],
			icon_urls: [
				'https://placehold.co/32x32/fbbf24/000?text=T1',
				'https://placehold.co/32x32/fbbf24/000?text=T2',
				'https://placehold.co/32x32/fbbf24/000?text=T3',
				'https://placehold.co/32x32/fbbf24/000?text=T4',
				'https://placehold.co/32x32/fbbf24/000?text=T5'
			]
		}
	};

		// Sample monster data for preview
		const sampleMonsters = [
			{
				id: 'preview-monster-1',
				name: 'Blood Fiend',
				damage: 9,
				barrier: 4,
				state: 'fallen' as const,
				monster_classification: 'boss' as const,
				icon: '',
				image_path: null,
				reward_rows: [],
				order_num: 0,
				card_image_path: null,
				special_conditions: null,
				invade_location_id: null,
				invade_location_name: 'Dark Forest',
				quantity: 1,
				created_at: null,
				updated_at: null,
				effects: [
					{
						id: 'preview-effect-1',
						name: 'Bloodlust',
						description: 'Heals 2 HP on kill',
						icon: null,
						color: '#dc2626',
						effect_type: 'after_combat' as const,
						created_at: null,
						updated_at: null
					},
					{
						id: 'preview-effect-2',
						name: 'Crimson Rage',
						description: 'Gains +1 damage when below 50% HP',
						icon: null,
						color: '#dc2626',
						effect_type: 'during_combat' as const,
						created_at: null,
						updated_at: null
					}
				],
				resolved_reward_rows: [sampleRewardRows.allInCombat, sampleRewardRows.oneWinner]
			}
		];

	// Sample event data for preview
	const sampleEvents = [
		{
			name: 'mysterious_storm',
			title: 'The Gathering Storm',
			description: 'Dark clouds roll across the horizon as arcane energy crackles through the air. All players must discard one card or take 2 damage. Those who weather the storm gain 1 spirit essence.',
			order_num: 1
		},
		{
			name: 'crystal_resonance',
			title: 'Crystal Resonance',
			description: 'Ancient crystals hidden beneath the earth begin to hum with power. Each player may sacrifice 3 health to draw 2 cards from any deck. The crystals grant clarity to those willing to pay the price.',
			order_num: 2
		},
		{
			name: 'stone_awakening',
			title: 'The Stone Awakening',
			description: 'The ground trembles as forgotten guardians stir from their slumber. All monsters gain +1 barrier until the end of the round. Players may spend 2 actions to commune with the awakened spirits.',
			order_num: 3
		},
		{
			name: 'celestial_alignment',
			title: 'Celestial Alignment',
			description: 'The stars align in a pattern not seen for millennia. All spells cost 1 less to cast. Players gain vision of the top 3 cards of any deck. The cosmos reveals hidden truths to those who look.',
			order_num: 4
		}
	];

	// Component mapping for easier iteration
	const monsterVariations = [
		{ component: MonsterCardPreview, name: 'Blood Crimson', description: 'Dark red with dripping blood effects' }
	];

	const eventVariations = [
		{ component: EventCardV1, name: 'V1: Mystical Tome', description: 'Open book with aged pages' },
		{ component: EventCardV2, name: 'V2: Crystal Portal', description: 'Ethereal energy portal aesthetic' },
		{ component: EventCardV3, name: 'V3: Ancient Tablet', description: 'Weathered stone with carved runes' },
		{ component: EventCardV4, name: 'V4: Celestial Cosmic', description: 'Starfield with nebula effects' }
	];

	let activeSection: 'monsters' | 'events' | 'all' = $state('all');
</script>

<svelte:head>
	<title>Events & Monsters Preview | Arc Spirits</title>
</svelte:head>

<div class="preview-page">
	<header class="page-header">
		<h1>Events & Monsters Card Preview</h1>
		<p class="subtitle">New card variations inspired by artifact card styling</p>

		<div class="section-tabs">
			<button
				class="tab"
				class:active={activeSection === 'all'}
				onclick={() => activeSection = 'all'}
			>
				All Cards
			</button>
			<button
				class="tab"
				class:active={activeSection === 'monsters'}
				onclick={() => activeSection = 'monsters'}
			>
				Monsters
			</button>
			<button
				class="tab"
				class:active={activeSection === 'events'}
				onclick={() => activeSection = 'events'}
			>
				Events
			</button>
		</div>
	</header>

	{#if activeSection === 'all' || activeSection === 'monsters'}
		<section class="card-section">
			<h2 class="section-title">
				<span class="icon"></span>
				Monster Card Variations
			</h2>
			<p class="section-description">
				Blood Crimson monster card design with striking dark red graphics
			</p>

			<div class="cards-grid">
				{#each monsterVariations as variation, i (variation.name)}
					<div class="card-wrapper">
						<div class="card-label">
							<span class="label-name">{variation.name}</span>
							<span class="label-desc">{variation.description}</span>
						</div>
						<div class="card-container">
							<variation.component monster={sampleMonsters[i]} />
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if activeSection === 'all' || activeSection === 'events'}
		<section class="card-section">
			<h2 class="section-title">
				<span class="icon"></span>
				Event Card Variations
			</h2>
			<p class="section-description">
				Four unique event card designs with thematic visual treatments
			</p>

			<div class="cards-grid">
				{#each eventVariations as variation, i (variation.name)}
					<div class="card-wrapper">
						<div class="card-label">
							<span class="label-name">{variation.name}</span>
							<span class="label-desc">{variation.description}</span>
						</div>
						<div class="card-container">
							<variation.component event={sampleEvents[i]} />
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<footer class="page-footer">
		<p>Card variations reference the artifact card styling from <code>ArtifactCardV1-V24</code></p>
	</footer>
</div>

<style>
	.preview-page {
		min-height: 100vh;
		background: linear-gradient(180deg, #0c0a12 0%, #1a1424 50%, #0c0a12 100%);
		padding: 40px 20px;
	}

	.page-header {
		max-width: 1400px;
		margin: 0 auto 48px;
		text-align: center;
	}

	.page-header h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: #f8fafc;
		margin: 0 0 8px;
		letter-spacing: -0.02em;
	}

	.subtitle {
		font-size: 1.1rem;
		color: #94a3b8;
		margin: 0 0 32px;
	}

	.section-tabs {
		display: flex;
		justify-content: center;
		gap: 8px;
	}

	.tab {
		padding: 10px 24px;
		background: rgba(148, 163, 184, 0.1);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		color: #94a3b8;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab:hover {
		background: rgba(148, 163, 184, 0.15);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.tab.active {
		background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(99, 102, 241, 0.2));
		border-color: rgba(139, 92, 246, 0.4);
		color: #c4b5fd;
	}

	.card-section {
		max-width: 1400px;
		margin: 0 auto 64px;
	}

	.section-title {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		font-size: 1.75rem;
		font-weight: 700;
		color: #f8fafc;
		margin: 0 0 8px;
	}

	.section-title .icon {
		font-size: 1.5rem;
	}

	.section-description {
		text-align: center;
		color: #94a3b8;
		margin: 0 0 40px;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
		gap: 48px;
		justify-items: center;
	}

	.card-wrapper {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.card-label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		text-align: center;
	}

	.label-name {
		font-size: 1.1rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.label-desc {
		font-size: 0.85rem;
		color: #64748b;
	}

	.card-container {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 16px;
	}

	.page-footer {
		max-width: 1400px;
		margin: 0 auto;
		padding-top: 40px;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		text-align: center;
		color: #64748b;
		font-size: 0.9rem;
	}

	.page-footer code {
		background: rgba(148, 163, 184, 0.1);
		padding: 2px 8px;
		border-radius: 4px;
		font-family: 'JetBrains Mono', 'Fira Code', monospace;
	}

	@media (max-width: 700px) {
		.cards-grid {
			grid-template-columns: 1fr;
		}

		.card-container {
			overflow-x: auto;
			justify-content: flex-start;
		}
	}
</style>
