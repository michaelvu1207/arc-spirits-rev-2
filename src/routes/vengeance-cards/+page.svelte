<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { VengeanceCardRow } from '$lib/types/gameData';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button } from '$lib/components/ui';
	import { getErrorMessage } from '$lib/utils';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { generateVengeanceCardPNG } from '$lib/generators/cards';
	import { VengeanceCardEditorModal, VengeanceCardGrid } from '$lib/components/vengeance';

	const tabs: Tab[] = [
		{ id: 'cards', label: 'Vengeance Cards', icon: '🩸' },
		{ id: 'gallery', label: 'Gallery', icon: '🖼️' }
	];
	let activeTab = $state('cards');

	let loading = $state(true);
	let error = $state<string | null>(null);

	let cards = $state<VengeanceCardRow[]>([]);
	let editorOpen = $state(false);
	let draft = $state<Partial<VengeanceCardRow>>({});
	let saving = $state(false);
	let deletingIds = $state(new Set<string>());

	// UI preference: rendered preview
	let showRenderedPreview = $state(false);
	let hasLoadedPreviewPreference = $state(false);
	$effect(() => {
		if (hasLoadedPreviewPreference) return;
		try {
			const saved = localStorage.getItem('vengeance-cards-rendered-preview');
			showRenderedPreview = saved === 'true';
		} catch {
			// ignore
		}
		hasLoadedPreviewPreference = true;
	});
	$effect(() => {
		if (!hasLoadedPreviewPreference) return;
		try {
			localStorage.setItem('vengeance-cards-rendered-preview', String(showRenderedPreview));
		} catch {
			// ignore
		}
	});

	// Gallery state
	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
	let selectedIds = $state(new Set<string>());
	let generatingIds = $state(new Set<string>());
	let progressMessage = $state('');

	const selectedCount = $derived(selectedIds.size);
	const generatedCount = $derived(cards.filter((c) => c.card_image_path).length);
	const totalCount = $derived(cards.length);

	const filteredCards = $derived.by(() => {
		return cards.filter((card) => {
			if (searchQuery.trim() && !card.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
			if (statusFilter === 'generated' && !card.card_image_path) return false;
			if (statusFilter === 'not-generated' && card.card_image_path) return false;
			return true;
		});
	});

	onMount(loadData);

	async function loadData() {
		loading = true;
		error = null;
		try {
			await loadCards();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadCards() {
		const { data, error: err } = await supabase
			.from('vengeance_cards')
			.select('*')
			.order('order_num')
			.order('title');
		if (err) throw err;

		cards = (data ?? []).map((row) => ({
			...row,
			reward_text: typeof (row as any).reward_text === 'string' ? (row as any).reward_text : null,
			reward_icon_ids: Array.isArray((row as any).reward_icon_ids) ? (row as any).reward_icon_ids : [],
			tags: Array.isArray((row as any).tags)
				? (row as any).tags.filter((tag: unknown): tag is string => typeof tag === 'string')
				: [],
			quantity: Number.isFinite(Number((row as any).quantity)) ? Math.max(1, Math.trunc(Number((row as any).quantity))) : 1
		}));
	}

	function openCreate() {
		draft = {
			title: '',
			description: null,
			reward_text: null,
			reward_icon_ids: [],
			tags: [],
			order_num: cards.length,
			quantity: 1
		};
		editorOpen = true;
	}

	function openEdit(card: VengeanceCardRow) {
		draft = JSON.parse(JSON.stringify(card));
		editorOpen = true;
	}

	async function saveCard(card: Partial<VengeanceCardRow>) {
		const title = (card.title ?? '').trim();
		if (!title) {
			alert('Title is required.');
			return;
		}

		const rewardText = (card.reward_text ?? '').trim();
		const rewardIconIds = Array.isArray(card.reward_icon_ids) ? card.reward_icon_ids : [];
		const tags = Array.isArray(card.tags) ? card.tags.filter((t): t is string => typeof t === 'string') : [];
		const quantity = Number.isFinite(Number((card as any).quantity)) ? Math.max(1, Math.trunc(Number((card as any).quantity))) : 1;

		const payload = {
			title,
			description: (card.description ?? null) || null,
			reward_text: rewardText ? rewardText : null,
			reward_icon_ids: rewardText ? [] : rewardIconIds,
			tags,
			order_num: card.order_num ?? 0,
			quantity,
			updated_at: new Date().toISOString()
		};

		saving = true;
		try {
			if (card.id) {
				const { error: err } = await supabase.from('vengeance_cards').update(payload).eq('id', card.id);
				if (err) throw err;
			} else {
				const { error: err } = await supabase.from('vengeance_cards').insert(payload);
				if (err) throw err;
			}
			await loadCards();
		} catch (err) {
			console.error('Failed to save vengeance card:', err);
			alert(`Failed to save: ${getErrorMessage(err)}`);
		} finally {
			saving = false;
		}
	}

	async function deleteCard(card: VengeanceCardRow) {
		if (!confirm(`Delete "${card.title}"?`)) return;
		deletingIds.add(card.id);
		deletingIds = new Set(deletingIds);
		try {
			const { error: err } = await supabase.from('vengeance_cards').delete().eq('id', card.id);
			if (err) throw err;
			cards = cards.filter((c) => c.id !== card.id);
		} catch (err) {
			console.error('Failed to delete vengeance card:', err);
			alert(`Failed to delete: ${getErrorMessage(err)}`);
		} finally {
			deletingIds.delete(card.id);
			deletingIds = new Set(deletingIds);
		}
	}

	function getCardImageUrl(card: VengeanceCardRow): string | null {
		if (!card.card_image_path) return null;
		return publicAssetUrl(card.card_image_path, { updatedAt: card.updated_at ?? undefined });
	}

	// Gallery selection helpers
	function toggleSelection(id: string) {
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
		selectedIds = new Set(selectedIds);
	}

	function selectAll() {
		selectedIds = new Set(filteredCards.map((c) => c.id));
	}

	function deselectAll() {
		selectedIds.clear();
		selectedIds = new Set(selectedIds);
	}

	// Generation
	async function generateCard(card: VengeanceCardRow) {
		generatingIds.add(card.id);
		generatingIds = new Set(generatingIds);
		progressMessage = `Generating card for "${card.title}"...`;

		try {
			const blob = await generateVengeanceCardPNG(card);
			const folder = 'vengeance_cards';

			const { data, error: uploadError } = await processAndUploadImage(blob, {
				folder,
				filename: card.id,
				cropTransparent: false,
				upsert: true
			});
			if (uploadError) throw uploadError;

			const uploadedPath = data?.path ?? '';
			const { error: updateError } = await supabase
				.from('vengeance_cards')
				.update({ card_image_path: uploadedPath, updated_at: new Date().toISOString() })
				.eq('id', card.id);
			if (updateError) throw updateError;

			const idx = cards.findIndex((c) => c.id === card.id);
			if (idx !== -1) {
				cards[idx] = { ...cards[idx], card_image_path: uploadedPath };
				cards = [...cards];
			}

			progressMessage = `✓ Generated card for "${card.title}"`;
		} catch (err) {
			console.error('Failed to generate vengeance card:', err);
			progressMessage = `✗ Failed to generate card for "${card.title}"`;
		} finally {
			generatingIds.delete(card.id);
			generatingIds = new Set(generatingIds);
		}
	}

	async function generateSelected() {
		const selected = filteredCards.filter((c) => selectedIds.has(c.id));
		if (selected.length === 0) {
			alert('No cards selected');
			return;
		}

		progressMessage = `Generating ${selected.length} cards...`;
		for (let i = 0; i < selected.length; i++) {
			const card = selected[i];
			progressMessage = `Generating card ${i + 1}/${selected.length}: "${card.title}"...`;
			await generateCard(card);
		}
		progressMessage = `✓ Generated ${selected.length} cards`;
		deselectAll();
	}

	async function generateAll() {
		if (!confirm(`Generate cards for all ${filteredCards.length} items?`)) return;
		progressMessage = `Generating ${filteredCards.length} cards...`;
		for (let i = 0; i < filteredCards.length; i++) {
			const card = filteredCards[i];
			progressMessage = `Generating card ${i + 1}/${filteredCards.length}: "${card.title}"...`;
			await generateCard(card);
		}
		progressMessage = `✓ Generated ${filteredCards.length} cards`;
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}
</script>

<PageLayout
	title="Vengeance Cards"
	subtitle="Quest-style scroll cards for vengeance content"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		{#if activeTab === 'cards'}
			<Button variant="primary" onclick={openCreate}>+ Vengeance Card</Button>
		{/if}
	{/snippet}

	{#snippet tabActions()}
		{#if activeTab === 'cards'}
			<span class="count">{cards.length} cards</span>
		{:else if activeTab === 'gallery'}
			<span class="count">{generatedCount}/{totalCount} generated</span>
		{/if}
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'cards'}
		<section class="quests">
			<div class="quests-toolbar">
				<Button variant="secondary" size="sm" onclick={() => (showRenderedPreview = !showRenderedPreview)}>
					{showRenderedPreview ? 'Disable Preview' : 'Enable Preview'}
				</Button>
			</div>

			{#if cards.length === 0}
				<div class="empty-state">No vengeance cards yet. Click “+ Vengeance Card” to create one.</div>
			{:else}
				{#if showRenderedPreview}
					<VengeanceCardGrid cards={cards} on:edit={(e) => openEdit(e.detail)} />
				{:else}
					<div class="quest-list" role="list">
						{#each cards as card (card.id)}
							{@const isDeleting = deletingIds.has(card.id)}
							{@const rewardSummary =
								card.reward_text && card.reward_text.trim()
									? `Reward: ${card.reward_text}`
									: card.reward_icon_ids && card.reward_icon_ids.length > 0
										? `Reward: ${card.reward_icon_ids.length} icon${card.reward_icon_ids.length === 1 ? '' : 's'}`
										: 'Reward: none'}

							<div class="quest-row" role="listitem">
								<button type="button" class="quest-row__main" onclick={() => openEdit(card)}>
									<div class="quest-row__title-line">
										<span class="quest-row__order">#{card.order_num}</span>
										{#if card.quantity > 1}
											<span class="quest-row__qty">×{card.quantity}</span>
										{/if}
										<span class="quest-row__title">{card.title}</span>
									</div>
									<div class="quest-row__meta">
										<span class="quest-row__reward">{rewardSummary}</span>
										{#if card.tags && card.tags.length > 0}
											<span class="quest-row__tags">Tags: {card.tags.join(', ')}</span>
										{/if}
									</div>
								</button>

								<div class="quest-row__actions">
									<Button variant="secondary" size="sm" onclick={() => openEdit(card)}>Edit</Button>
									<Button variant="danger" size="sm" onclick={() => deleteCard(card)} loading={isDeleting}>
										Delete
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			<VengeanceCardEditorModal bind:open={editorOpen} bind:card={draft} onsave={(c) => void saveCard(c)} />

			{#if saving}
				<div class="saving-banner">Saving…</div>
			{/if}
		</section>
	{:else if activeTab === 'gallery'}
		<div class="gallery-container">
			<div class="controls-bar">
				<div class="filters">
					<input type="text" placeholder="Search cards..." bind:value={searchQuery} class="search-input" />
					<select bind:value={statusFilter} class="filter-select">
						<option value="all">All Status</option>
						<option value="generated">Generated</option>
						<option value="not-generated">Not Generated</option>
					</select>
				</div>

				<div class="actions">
					{#if selectedCount > 0}
						<Button variant="secondary" onclick={deselectAll}>Deselect All</Button>
						<Button variant="primary" onclick={generateSelected}>Generate Selected ({selectedCount})</Button>
					{:else}
						<Button variant="secondary" onclick={selectAll}>Select All ({filteredCards.length})</Button>
					{/if}
					<Button variant="primary" onclick={generateAll}>Generate All</Button>
				</div>
			</div>

			{#if progressMessage}
				<div class="progress-message">{progressMessage}</div>
			{/if}

			<div class="cards-grid quest-cards-grid">
				{#each filteredCards as card (card.id)}
					{@const isSelected = selectedIds.has(card.id)}
					{@const isGenerating = generatingIds.has(card.id)}
					{@const hasCardImage = !!card.card_image_path}
					{@const cardImageUrl = getCardImageUrl(card)}

					<div class="card-item quest-card-item" class:selected={isSelected}>
						<div class="card-checkbox">
							<input
								type="checkbox"
								checked={isSelected}
								onchange={() => toggleSelection(card.id)}
								disabled={isGenerating}
							/>
						</div>

						<div class="card-preview quest-card-preview">
							{#if hasCardImage && cardImageUrl}
								<img src={cardImageUrl} alt={card.title} loading="lazy" />
								<div class="card-status generated">
									<span class="status-icon">✓</span>
								</div>
							{:else}
								<div class="card-placeholder quest-placeholder">
									<div class="placeholder-emoji">🩸</div>
									<span class="placeholder-text">{card.title}</span>
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
								<h3 class="card-name">{card.title}</h3>
							</div>

							<div class="card-footer">
								<span class="card-order">#{card.order_num}</span>
								<Button variant="secondary" size="sm" onclick={() => generateCard(card)} disabled={isGenerating}>
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

<style>
	/* Minimal styles reused from travelers page (quests + gallery blocks). */
	.loading-state,
	.error-state,
	.empty-state {
		padding: 1rem;
		color: rgba(226, 232, 240, 0.85);
	}

	.count {
		color: rgba(226, 232, 240, 0.75);
		font-weight: 600;
	}

	.quests-toolbar {
		display: flex;
		justify-content: flex-end;
		padding: 0 1.25rem;
	}

	.quest-list {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 1.25rem;
	}

	.quest-row {
		display: flex;
		justify-content: space-between;
		align-items: stretch;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(2, 6, 23, 0.18);
		border-radius: 12px;
	}

	.quest-row__main {
		flex: 1;
		text-align: left;
		background: transparent;
		border: none;
		padding: 0;
		color: inherit;
		cursor: pointer;
	}

	.quest-row__title-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.quest-row__order {
		color: rgba(226, 232, 240, 0.6);
		font-weight: 700;
	}

	.quest-row__qty {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: rgba(59, 130, 246, 0.12);
		border: 1px solid rgba(59, 130, 246, 0.22);
		font-weight: 800;
	}

	.quest-row__title {
		font-weight: 800;
		color: rgba(226, 232, 240, 0.92);
	}

	.quest-row__meta {
		margin-top: 0.3rem;
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		color: rgba(226, 232, 240, 0.65);
		font-size: 0.9rem;
	}

	.quest-row__actions {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
	}

	.saving-banner {
		position: fixed;
		right: 16px;
		bottom: 16px;
		padding: 0.65rem 0.85rem;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.85);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: rgba(226, 232, 240, 0.9);
		font-weight: 700;
	}

	.gallery-container {
		padding: 1.25rem;
	}

	.controls-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.filters {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.search-input,
	.filter-select {
		padding: 0.55rem 0.7rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.35);
		color: rgba(226, 232, 240, 0.9);
	}

	.actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.progress-message {
		margin: 0.5rem 0;
		color: rgba(226, 232, 240, 0.8);
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 1rem;
	}

	.card-item {
		display: grid;
		grid-template-columns: 28px 1fr;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(2, 6, 23, 0.18);
	}

	.card-item.selected {
		border-color: rgba(59, 130, 246, 0.5);
	}

	.card-preview {
		position: relative;
		aspect-ratio: 7 / 5;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.14);
		background: rgba(15, 23, 42, 0.35);
	}

	.card-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.35rem;
		color: rgba(226, 232, 240, 0.75);
	}

	.placeholder-emoji {
		font-size: 2rem;
	}

	.card-generating {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(2, 6, 23, 0.6);
	}

	.spinner {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 3px solid rgba(226, 232, 240, 0.25);
		border-top-color: rgba(226, 232, 240, 0.9);
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.card-info {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.card-name {
		margin: 0;
		font-size: 1rem;
		color: rgba(226, 232, 240, 0.92);
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.card-order {
		color: rgba(226, 232, 240, 0.6);
		font-weight: 700;
	}
</style>

