<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/api/supabaseClient';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { getErrorMessage } from '$lib/utils';
	import { generateEventCardPNG } from '$lib/generators/cards';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button } from '$lib/components/ui';
	import { MonsterCardGallery } from '$lib/components/monsters';
	import type { Event } from '$lib/components/abyss-deck';
	import AbyssDeckWorkspace from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
	import type {
		DeckOrderItem,
		EventFormData as AbyssEventFormData
	} from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';

	type CardItem = {
		id: string;
		name: string;
		order_num: number;
		card_image_path: string | null;
		data: Event;
	};

	const tabs: Tab[] = [
		{ id: 'deck', label: 'Deck Builder', icon: '🃏' },
		{ id: 'gallery', label: 'Card Gallery', icon: '🖼️' }
	];
	let activeTab = $state('deck');

	let events = $state<Event[]>([]);
	let allCards = $state<CardItem[]>([]);
	let filteredCards = $state<CardItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
	let selectedCardIds = $state(new Set<string>());
	let generatingCards = $state(new Set<string>());
	let progressMessage = $state('');
	let showGalleryModal = $state(false);

	const selectedCount = $derived(selectedCardIds.size);
	const generatedCount = $derived(allCards.filter((c) => c.card_image_path).length);
	const totalCount = $derived(allCards.length);

	onMount(loadData);

	async function loadData() {
		loading = true;
		error = null;
		try {
			await loadEvents();
			updateFilteredCards();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadEvents() {
		const { data, error: err } = await supabase.from('events').select('*').order('order_num');
		if (err) throw new Error(err.message);

		events = (data ?? []).map((event) => ({
			...event,
			art_url: getEventImageUrl(event.image_path, event.updated_at)
		}));

		allCards = events.map((e) => ({
			id: e.id,
			name: e.title,
			order_num: e.order_num ?? 999,
			card_image_path: e.card_image_path,
			data: e
		}));
	}

	function getEventImageUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
		if (!imagePath) return null;
		const path = imagePath.startsWith('events/') ? imagePath : `events/${imagePath}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function getCardImageUrl(card: CardItem): string | null {
		if (!card.card_image_path) return null;
		const { data } = supabase.storage.from('game_assets').getPublicUrl(card.card_image_path);
		return data?.publicUrl || null;
	}

	async function saveDeckOrder(order: DeckOrderItem[]) {
		const updates = order
			.map((item, order_num) => (item.type === 'event' ? { id: item.id, order_num } : null))
			.filter((x): x is { id: string; order_num: number } => x !== null);

		if (updates.length === 0) return;
		for (const update of updates) {
			const { error: err } = await supabase
				.from('events')
				.update({ order_num: update.order_num })
				.eq('id', update.id);
			if (err) throw err;
		}

		await loadEvents();
		updateFilteredCards();
	}

	async function handleWorkspaceEventSave(formData: AbyssEventFormData, id: string | null): Promise<string> {
		if (!formData.name.trim() || !formData.title.trim()) {
			throw new Error('Event name and title are required.');
		}

		if (id) {
			const { error: err } = await supabase
				.from('events')
				.update({
					name: formData.name,
					title: formData.title,
					description: formData.description,
					image_path: formData.image_path,
					order_num: formData.order_num,
					updated_at: new Date().toISOString()
				})
				.eq('id', id);
			if (err) throw err;

			await loadEvents();
			updateFilteredCards();
			return id;
		}

		const { data, error: err } = await supabase
			.from('events')
			.insert({
				name: formData.name,
				title: formData.title,
				description: formData.description,
				image_path: formData.image_path,
				order_num: formData.order_num
			})
			.select('id')
			.single();
		if (err) throw err;

		await loadEvents();
		updateFilteredCards();
		return data.id;
	}

	async function handleWorkspaceEventDelete(id: string) {
		const { error: err } = await supabase.from('events').delete().eq('id', id);
		if (err) throw err;
		await loadEvents();
		updateFilteredCards();
	}

	function updateFilteredCards() {
		filteredCards = allCards.filter((card) => {
			if (statusFilter === 'generated' && !card.card_image_path) return false;
			if (statusFilter === 'not-generated' && card.card_image_path) return false;
			if (searchQuery.trim() && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false;
			}
			return true;
		});
	}

	$effect(() => {
		updateFilteredCards();
	});

	function toggleSelection(cardId: string) {
		if (selectedCardIds.has(cardId)) {
			selectedCardIds.delete(cardId);
		} else {
			selectedCardIds.add(cardId);
		}
		selectedCardIds = new Set(selectedCardIds);
	}

	function selectAll() {
		selectedCardIds = new Set(filteredCards.map((c) => c.id));
	}

	function deselectAll() {
		selectedCardIds.clear();
		selectedCardIds = new Set(selectedCardIds);
	}

	async function generateCard(card: CardItem) {
		generatingCards.add(card.id);
		generatingCards = new Set(generatingCards);
		progressMessage = `Generating card for ${card.name}...`;

		try {
			const event = card.data;
			const blob = await generateEventCardPNG(event, event.art_url);

			const { data, error: uploadError } = await processAndUploadImage(blob, {
				folder: 'event_cards',
				filename: card.id,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) throw uploadError;

			const uploadedPath = data?.path ?? '';
			const { error: updateError } = await supabase
				.from('events')
				.update({ card_image_path: uploadedPath })
				.eq('id', card.id);

			if (updateError) throw updateError;

			card.card_image_path = uploadedPath;
			allCards = [...allCards];
			updateFilteredCards();

			progressMessage = `✓ Generated card for ${card.name}`;
		} catch (err) {
			console.error('Failed to generate card:', err);
			progressMessage = `✗ Failed to generate card for ${card.name}`;
		} finally {
			generatingCards.delete(card.id);
			generatingCards = new Set(generatingCards);
		}
	}

	async function generateSelected() {
		const selectedCards = filteredCards.filter((c) => selectedCardIds.has(c.id));
		if (selectedCards.length === 0) {
			alert('No cards selected');
			return;
		}

		progressMessage = `Generating ${selectedCards.length} cards...`;

		for (let i = 0; i < selectedCards.length; i++) {
			const card = selectedCards[i];
			progressMessage = `Generating card ${i + 1}/${selectedCards.length}: ${card.name}...`;
			await generateCard(card);
		}

		progressMessage = `✓ Generated ${selectedCards.length} cards`;
		deselectAll();
	}

	async function generateAll() {
		if (!confirm(`Generate cards for all ${filteredCards.length} items?`)) return;

		progressMessage = `Generating ${filteredCards.length} cards...`;

		for (let i = 0; i < filteredCards.length; i++) {
			const card = filteredCards[i];
			progressMessage = `Generating card ${i + 1}/${filteredCards.length}: ${card.name}...`;
			await generateCard(card);
		}

		progressMessage = `✓ Generated ${filteredCards.length} cards`;
	}

	async function handleWorkspaceMonsterSave(): Promise<string> {
		throw new Error('Monsters are managed on the Arcane Abyss page.');
	}

	async function handleWorkspaceMonsterDelete(): Promise<void> {
		throw new Error('Monsters are managed on the Arcane Abyss page.');
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}
</script>

<PageLayout
	title="Abyss Events"
	subtitle="Events and card generation for the abyss deck"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		<Button variant="secondary" onclick={() => goto('/arcane-abyss')}>View Monsters</Button>
		{#if activeTab === 'gallery'}
			<Button variant="secondary" onclick={() => (showGalleryModal = true)}>View Gallery</Button>
		{/if}
	{/snippet}

	{#snippet tabActions()}
		{#if activeTab === 'deck'}
			<span class="count">{events.length} events</span>
		{:else if activeTab === 'gallery'}
			<span class="count">{generatedCount}/{totalCount} generated</span>
		{/if}
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'deck'}
		<AbyssDeckWorkspace
			monsters={[]}
			{events}
			locations={[]}
			specialEffects={[]}
			monsterSpecialEffects={{}}
			onMonsterSave={handleWorkspaceMonsterSave}
			onMonsterDelete={handleWorkspaceMonsterDelete}
			onEventSave={handleWorkspaceEventSave}
			onEventDelete={handleWorkspaceEventDelete}
			onSaveDeckOrder={saveDeckOrder}
			defaultShowCardPreviews={false}
			showMonsters={false}
			showEvents={true}
			showStats={false}
			showInvadeLocation={false}
			showSpecialEffects={false}
			showRewardRows={false}
		/>
	{:else if activeTab === 'gallery'}
		<div class="gallery-container">
			<div class="controls-bar">
				<div class="filters">
					<input
						type="text"
						placeholder="Search cards..."
						bind:value={searchQuery}
						class="search-input"
					/>

					<select bind:value={statusFilter} class="filter-select">
						<option value="all">All Status</option>
						<option value="generated">Generated</option>
						<option value="not-generated">Not Generated</option>
					</select>
				</div>

				<div class="actions">
					{#if selectedCount > 0}
						<Button variant="secondary" onclick={deselectAll}>
							Deselect All
						</Button>
						<Button variant="primary" onclick={generateSelected}>
							Generate Selected ({selectedCount})
						</Button>
					{:else}
						<Button variant="secondary" onclick={selectAll}>
							Select All ({filteredCards.length})
						</Button>
					{/if}

					<Button variant="primary" onclick={generateAll}>
						Generate All
					</Button>
				</div>
			</div>

			{#if progressMessage}
				<div class="progress-message">{progressMessage}</div>
			{/if}

			<div class="cards-grid">
				{#each filteredCards as card (card.id)}
					{@const isSelected = selectedCardIds.has(card.id)}
					{@const isGenerating = generatingCards.has(card.id)}
					{@const hasCardImage = !!card.card_image_path}
					{@const cardImageUrl = getCardImageUrl(card)}

					<div class="card-item" class:selected={isSelected}>
						<div class="card-checkbox">
							<input
								type="checkbox"
								checked={isSelected}
								onchange={() => toggleSelection(card.id)}
								disabled={isGenerating}
							/>
						</div>

						<div class="card-preview">
							{#if hasCardImage && cardImageUrl}
								<img src={cardImageUrl} alt={card.name} loading="lazy" />
								<div class="card-status generated">
									<span class="status-icon">✓</span>
								</div>
							{:else}
								<div class="card-placeholder">
									<span class="placeholder-text">{card.name}</span>
								</div>
							{/if}

							{#if isGenerating}
								<div class="card-generating">
									<div class="spinner"></div>
								</div>
							{/if}
						</div>

						<div class="card-info">
							<div class="card-header">
								<h3 class="card-name">{card.name}</h3>
								<span class="card-badge">Event</span>
							</div>

							<div class="card-footer">
								<span class="card-order">#{card.order_num}</span>
								<Button
									variant="secondary"
									size="sm"
									onclick={() => generateCard(card)}
									disabled={isGenerating}
								>
									{isGenerating ? 'Generating...' : hasCardImage ? 'Regenerate' : 'Generate'}
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if filteredCards.length === 0}
				<div class="empty-state">No cards match the current filters</div>
			{/if}
		</div>
	{/if}
</PageLayout>

<MonsterCardGallery bind:isOpen={showGalleryModal} monsters={[]} {events} />

<style>
	.count {
		font-size: 0.7rem;
		color: #64748b;
	}

	.loading-state,
	.error-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.error-state {
		color: #f87171;
	}

	.gallery-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.controls-bar {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.search-input {
		flex: 1;
		min-width: 160px;
		padding: 0.35rem 0.5rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.75rem;
	}

	.search-input:focus {
		outline: none;
		border-color: #a855f7;
	}

	.filter-select {
		padding: 0.35rem 0.5rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.filter-select:focus {
		outline: none;
		border-color: #a855f7;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.progress-message {
		padding: 0.5rem;
		background: rgba(59, 130, 246, 0.1);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 6px;
		color: #60a5fa;
		text-align: center;
		font-size: 0.7rem;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 0.5rem;
	}

	.card-item {
		background: rgba(30, 41, 59, 0.6);
		border: 2px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		overflow: hidden;
		transition: all 0.15s;
		position: relative;
	}

	.card-item:hover {
		border-color: rgba(168, 85, 247, 0.5);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
	}

	.card-item.selected {
		border-color: #a855f7;
		box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.2);
	}

	.card-checkbox {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 2;
	}

	.card-checkbox input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: #a855f7;
	}

	.card-preview {
		aspect-ratio: 3 / 4;
		background: rgba(15, 23, 42, 0.8);
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card-preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.card-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
		text-align: center;
	}

	.placeholder-text {
		font-size: 0.75rem;
		color: #cbd5e1;
		font-weight: 500;
	}

	.card-status {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: rgba(34, 197, 94, 0.2);
		border: 1px solid rgba(34, 197, 94, 0.4);
		border-radius: 50%;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status-icon {
		color: #22c55e;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.card-generating {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top-color: #a855f7;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.card-info {
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.card-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.4rem;
	}

	.card-name {
		font-size: 0.75rem;
		font-weight: 600;
		color: #f8fafc;
		margin: 0;
		line-height: 1.2;
		flex: 1;
	}

	.card-badge {
		font-size: 0.65rem;
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		text-transform: uppercase;
		font-weight: 700;
		letter-spacing: 0.05em;
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
		flex-shrink: 0;
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.card-order {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.75rem;
	}
</style>

