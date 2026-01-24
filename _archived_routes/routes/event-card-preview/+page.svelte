<script lang="ts">
	import EventCardV6 from '$lib/components/events/card-variations/EventCardV6.svelte';
	import EventCardV6a from '$lib/components/events/card-variations/EventCardV6a.svelte';
	import EventCardV6b from '$lib/components/events/card-variations/EventCardV6b.svelte';
	import EventCardV6c from '$lib/components/events/card-variations/EventCardV6c.svelte';
	import EventCardV6d from '$lib/components/events/card-variations/EventCardV6d.svelte';
	import MonsterCardPreview from '$lib/components/monsters/MonsterCardPreview.svelte';

	// Sample event data
	const sampleEvent = {
		name: 'veil_of_shadows',
		title: 'Veil of Shadows',
		description: 'Darkness descends as the boundary between realms weakens. Hidden truths emerge from the depths. All players must face what lurks within their own shadows.',
		order_num: 7,
		art_url: null
	};

	// Card variations
	const variations = [
		{ component: EventCardV6, name: 'V6: Violet Arcane', description: 'Deep purple mystical theme', color: '#8b5cf6' },
		{ component: EventCardV6a, name: 'V6a: Ocean Depths', description: 'Teal/ocean mystical theme', color: '#14b8a6' },
		{ component: EventCardV6b, name: 'V6b: Crimson Mist', description: 'Deep red blood mystical theme', color: '#dc2626' },
		{ component: EventCardV6c, name: 'V6c: Emerald Grove', description: 'Forest/nature mystical theme', color: '#22c55e' },
		{ component: EventCardV6d, name: 'V6d: Golden Relic', description: 'Ancient gold/amber theme', color: '#d4a943' }
	];

	// Sample monster for comparison
	const sampleMonster = {
		id: 'preview-monster-1',
		name: 'Shadow Fiend',
		damage: 7,
		barrier: 3,
		state: 'corrupt' as const,
		monster_classification: 'monster' as const,
		icon: '',
		image_path: null,
		reward_rows: [],
		order_num: 0,
		card_image_path: null,
		special_conditions: null,
		invade_location_id: null,
		quantity: 1,
		created_at: null,
		updated_at: null,
		effects: [
			{
				id: 'e1',
				name: 'Shadow Strike',
				description: 'Deals +2 damage to spirits with less than 3 barrier',
				icon: null,
				color: '#dc2626',
				effect_type: 'during_combat' as const,
				created_at: null,
				updated_at: null
			}
		],
		resolved_reward_rows: []
	};
</script>

<svelte:head>
	<title>Event Card Preview | Arc Spirits</title>
</svelte:head>

<div class="preview-page">
	<header class="page-header">
		<h1>Event Card Design Preview</h1>
		<p class="subtitle">Symmetrical centered layout with 4 color variations</p>
	</header>

	<section class="comparison-section">
		<h2>Monster Card Reference</h2>
		<div class="single-card">
			<div class="card-wrapper">
				<div class="card-label">
					<span class="label-name">Monster Card</span>
					<span class="label-desc">Current design for reference</span>
				</div>
				<div class="card-container">
					<MonsterCardPreview monster={sampleMonster} />
				</div>
			</div>
		</div>
	</section>

	<section class="variations-section">
		<h2>Event Card Variations</h2>
		<p class="section-desc">All variations use the same symmetrical centered layout</p>

		<div class="cards-grid">
			{#each variations as variation (variation.name)}
				<div class="card-wrapper">
					<div class="card-label">
						<span class="label-name" style="color: {variation.color}">{variation.name}</span>
						<span class="label-desc">{variation.description}</span>
					</div>
					<div class="card-container">
						<variation.component event={sampleEvent} />
					</div>
				</div>
			{/each}
		</div>
	</section>
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
	}

	.subtitle {
		font-size: 1.1rem;
		color: #94a3b8;
		margin: 0;
	}

	.comparison-section,
	.variations-section {
		max-width: 1600px;
		margin: 0 auto 64px;
	}

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #e2e8f0;
		margin: 0 0 12px;
		text-align: center;
	}

	.section-desc {
		text-align: center;
		color: #64748b;
		margin: 0 0 32px;
		font-size: 0.95rem;
	}

	.single-card {
		display: flex;
		justify-content: center;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(640px, 1fr));
		gap: 40px;
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
		font-size: 1.2rem;
		font-weight: 700;
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
