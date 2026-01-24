<script lang="ts">
	import type { TravelerQuestRow } from '$lib/types/gameData';
	import TravelerQuestGrid from '$lib/components/travelers/TravelerQuestGrid.svelte';

	// Sample quest data for preview
	const sampleQuests: TravelerQuestRow[] = [
		{
			id: 'quest-1',
			title: 'The Lost Cartographer',
			description: 'Seek the wandering mapmaker who charts paths between forgotten realms. His knowledge of the shadow roads may prove invaluable.',
			reward_text: null,
			reward_icon_ids: ['icon-1', 'icon-2', 'icon-3'],
			order_num: 0,
			tags: [],
			quantity: 1,
			card_image_path: null,
			created_at: null,
			updated_at: null
		},
		{
			id: 'quest-2',
			title: 'Echoes of the Void',
			description: 'Strange whispers emanate from the crystal caves. Investigate the source before the corruption spreads further.',
			reward_text: 'Gain 3 Spirit Essence',
			reward_icon_ids: [],
			order_num: 1,
			tags: [],
			quantity: 1,
			card_image_path: null,
			created_at: null,
			updated_at: null
		},
		{
			id: 'quest-3',
			title: 'The Merchant\'s Bargain',
			description: 'A peculiar trader offers wares from distant lands. But every deal comes with hidden costs...',
			reward_text: null,
			reward_icon_ids: ['icon-4', 'icon-5'],
			order_num: 2,
			tags: [],
			quantity: 1,
			card_image_path: null,
			created_at: null,
			updated_at: null
		},
		{
			id: 'quest-4',
			title: 'Starfall Prophecy',
			description: 'When the seventh star descends, the gate shall open. Prepare the ritual before the celestial alignment passes.',
			reward_text: null,
			reward_icon_ids: ['icon-1', 'icon-3', 'icon-5', 'icon-2'],
			order_num: 3,
			tags: [],
			quantity: 1,
			card_image_path: null,
			created_at: null,
			updated_at: null
		}
	];

	function handleEdit(e: CustomEvent<TravelerQuestRow>) {
		console.log('Edit quest:', e.detail.title);
	}
</script>

<div class="preview-page">
	<header class="preview-header">
		<h1>Traveler Quest Grid Preview</h1>
		<p>Rustic horizontal scroll with aged parchment and wooden rolls</p>
	</header>

	<main class="preview-content">
		<div class="grid-container">
			<TravelerQuestGrid quests={sampleQuests} on:edit={handleEdit} />
		</div>
	</main>
</div>

<style>
	.preview-page {
		min-height: 100vh;
		background: #0a0a0f;
		color: #f8fafc;
	}

	.preview-header {
		padding: 2rem;
		text-align: center;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		background: linear-gradient(180deg, rgba(15, 23, 42, 0.8) 0%, transparent 100%);
	}

	.preview-header h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		background: linear-gradient(135deg, #c084fc, #818cf8);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.preview-header p {
		color: #94a3b8;
		margin: 0;
		font-size: 0.9rem;
	}

	.preview-content {
		padding: 1rem;
	}

	.grid-container {
		border-radius: 16px;
		padding: 1rem;
		min-height: 500px;
		background: linear-gradient(180deg, #2a2418 0%, #1a1610 100%);
	}
</style>
