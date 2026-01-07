<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { SpecialEffectRow, GameLocationRow, SpecialEffectType } from '$lib/types/gameData';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { getErrorMessage } from '$lib/utils';
	import { generateMonsterCardPNG } from '$lib/generators/cards';
	import { loadAllIcons, getIconPoolUrl } from '$lib/utils/iconPool';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button, FormField, Input, Textarea } from '$lib/components/ui';
	import { MonsterCardGallery } from '$lib/components/monsters';
	import type { Monster } from '$lib/components/abyss-deck';
	import AbyssDeckWorkspace from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
	import type {
		DeckOrderItem,
		MonsterFormData as AbyssMonsterFormData
	} from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';

	// Card gallery types
	type CardItem = {
		id: string;
		name: string;
		order_num: number;
		card_image_path: string | null;
		data: Monster;
	};

	// Tab state
	const tabs: Tab[] = [
		{ id: 'deck', label: 'Deck Builder', icon: '🃏' },
		{ id: 'special-effects', label: 'Special Effects', icon: '✨' },
		{ id: 'gallery', label: 'Card Gallery', icon: '🖼️' }
	];
	let activeTab = $state('deck');

	// Data state
	let monsters = $state<Monster[]>([]);
	let allCards = $state<CardItem[]>([]);
	let filteredCards = $state<CardItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Lookups
	let specialEffects = $state<SpecialEffectRow[]>([]);
	let monsterSpecialEffects = $state<Record<string, string[]>>({});
	let invadeLocations = $state<Pick<GameLocationRow, 'id' | 'name'>[]>([]);

	// Gallery state
	let searchQuery = $state('');
	let stateFilter = $state<'all' | 'tainted' | 'corrupt' | 'fallen' | 'arcane' | 'inactive'>('all');
	let classificationFilter = $state<'all' | 'monster' | 'abyss_guardian' | 'boss'>('all');
	let statusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
	let selectedCardIds = $state(new Set<string>());
	let generatingCards = $state(new Set<string>());
	let progressMessage = $state('');
	let showGalleryModal = $state(false);

	// Special Effect editing state
	let showEffectDrawer = $state(false);
	let editingEffectId = $state<string | null>(null);
	let effectFormData = $state({
		name: '',
		description: null as string | null,
		icon: null as string | null,
		color: '#a855f7',
		effect_type: 'during_combat' as SpecialEffectType
	});

	const effectTypeOptions: { value: SpecialEffectType; label: string }[] = [
		{ value: 'before_combat', label: 'Before Combat' },
		{ value: 'during_combat', label: 'During Combat' },
		{ value: 'after_combat', label: 'After Combat' },
		{ value: 'combat_type', label: 'Combat Type' }
	];

	const effectTypeColors: Record<SpecialEffectType, string> = {
		before_combat: '#f59e0b',
		during_combat: '#ef4444',
		after_combat: '#22c55e',
		combat_type: '#8b5cf6'
	};

	const isEditingEffect = $derived(editingEffectId !== null);
	const selectedCount = $derived(selectedCardIds.size);
	const generatedCount = $derived(allCards.filter(c => c.card_image_path).length);
	const totalCount = $derived(allCards.length);

	onMount(loadData);

	async function loadData() {
		loading = true;
		error = null;
		try {
			await loadAllIcons();
			await Promise.all([loadSpecialEffects(), loadMonsterSpecialEffects(), loadInvadeLocations()]);
			await loadMonsters();
			updateFilteredCards();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadSpecialEffects() {
		const { data, error: err } = await supabase
			.from('special_effects')
			.select('*')
			.order('name');
		if (err) throw new Error(err.message);
		specialEffects = data ?? [];
	}

	async function loadMonsterSpecialEffects() {
		const { data, error: err } = await supabase
			.from('monster_special_effects')
			.select('monster_id, special_effect_id');
		if (err) throw new Error(err.message);

		monsterSpecialEffects = (data ?? []).reduce((acc, row) => {
			if (!acc[row.monster_id]) acc[row.monster_id] = [];
			acc[row.monster_id].push(row.special_effect_id);
			return acc;
		}, {} as Record<string, string[]>);
	}

	async function loadInvadeLocations() {
		const { data, error: err } = await supabase.from('game_locations').select('id, name').order('name');
		if (err) throw new Error(err.message);
		invadeLocations = (data ?? []) as Pick<GameLocationRow, 'id' | 'name'>[];
	}

		async function loadMonsters() {
			const { data, error: err } = await supabase.from('monsters').select('*').order('order_num');
			if (err) throw new Error(err.message);

			monsters = (data ?? []).map((monster) => {
				const effectIds = monsterSpecialEffects[monster.id] ?? [];
				const monsterEffects = effectIds
					.map(id => specialEffects.find(e => e.id === id))
				.filter((e): e is SpecialEffectRow => e !== undefined);

			const invadeLocation = monster.invade_location_id
				? invadeLocations.find(loc => loc.id === monster.invade_location_id)
				: null;

				return {
					...monster,
					icon_url: getMonsterIconUrl(monster.icon, monster.updated_at),
					art_url: getMonsterImageUrl(monster.image_path, monster.updated_at),
					effects: monsterEffects,
					invade_location_name: invadeLocation?.name ?? null
				};
			});

		allCards = [
			...monsters.map(m => ({
				id: m.id,
				name: m.name,
				order_num: m.order_num ?? 999,
				card_image_path: m.card_image_path,
				data: m
			}))
		];
	}

	function getMonsterIconUrl(icon: string | null | undefined, updatedAt?: string | null): string | null {
		if (!icon) return null;
		if (icon.includes('/')) {
			const path = icon.startsWith('monster_icons/') ? icon : `monster_icons/${icon}`;
			return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
		}
		return null;
	}

	function getMonsterImageUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
		if (!imagePath) return null;
		const path = imagePath.startsWith('monsters/') ? imagePath : `monsters/${imagePath}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function getStateColor(state: string | null | undefined): string {
		switch (state) {
			case 'tainted':
				return '#c084fc';
			case 'corrupt':
				return '#6b21a8';
			case 'fallen':
				return '#065f46';
			case 'arcane':
				return '#0ea5e9';
			case 'inactive':
				return '#64748b';
			default: return '#94a3b8';
		}
	}

		function normalizeRewardTrack(barrierValue: number, track: unknown): string[][] {
			const barrier = Math.max(0, Math.round(barrierValue));
			const killedIndex = Math.max(1, barrier);
			const targetLen = killedIndex + 1; // includes slot0 participation

			const safe: string[][] = Array.isArray(track)
				? track.map((slot) =>
						Array.isArray(slot)
							? slot
									.filter((id): id is string => typeof id === 'string')
									.map((id) => id.trim())
									.filter(Boolean)
							: []
					)
				: [];

			while (safe.length < targetLen) safe.push([]);
			return safe.slice(0, targetLen);
		}

	function getCardImageUrl(card: CardItem): string | null {
		if (!card.card_image_path) return null;
		const { data } = supabase.storage.from('game_assets').getPublicUrl(card.card_image_path);
		return data?.publicUrl || null;
	}

	async function saveDeckOrder(order: DeckOrderItem[]) {
		const monsterUpdates = order
			.map((item, order_num) => (item.type === 'monster' ? { id: item.id, order_num } : null))
			.filter((x): x is { id: string; order_num: number } => x !== null);

		if (monsterUpdates.length > 0) {
			for (const update of monsterUpdates) {
				const { error: err } = await supabase
					.from('monsters')
					.update({ order_num: update.order_num })
					.eq('id', update.id);
				if (err) throw err;
			}
		}

		await loadMonsters();
		updateFilteredCards();
	}

	async function handleWorkspaceMonsterSave(formData: AbyssMonsterFormData, id: string | null): Promise<string> {
		if (!formData.name.trim()) {
			throw new Error('Monster name is required.');
		}

			let monsterId: string;
			const rewardTrack = normalizeRewardTrack(formData.barrier ?? 0, (formData as any).reward_track);

			if (id) {
				const { error: err } = await supabase
					.from('monsters')
					.update({
					name: formData.name,
					damage: formData.damage,
					barrier: formData.barrier,
					state: formData.state,
					monster_classification: formData.monster_classification,
					icon: formData.icon,
					image_path: formData.image_path,
					show_tutorial: (formData as any).show_tutorial ?? true,
						invade_location_id: formData.invade_location_id,
						order_num: formData.order_num,
						reward_track: rewardTrack,
						quantity: formData.quantity,
						updated_at: new Date().toISOString()
					})
					.eq('id', id);
			if (err) throw err;
			monsterId = id;
			} else {
				const { data, error: err } = await supabase
					.from('monsters')
					.insert({
						name: formData.name,
						damage: formData.damage,
						barrier: formData.barrier,
					state: formData.state,
					monster_classification: formData.monster_classification,
					icon: formData.icon,
					image_path: formData.image_path,
					show_tutorial: (formData as any).show_tutorial ?? true,
						invade_location_id: formData.invade_location_id,
						order_num: formData.order_num,
						reward_track: rewardTrack,
						quantity: formData.quantity
					})
					.select('id')
					.single();
			if (err) throw err;
			monsterId = data.id;
		}

		const { error: deleteErr } = await supabase
			.from('monster_special_effects')
			.delete()
			.eq('monster_id', monsterId);
		if (deleteErr) throw deleteErr;

		if (formData.special_effect_ids.length > 0) {
			const effectRecords = formData.special_effect_ids.map((effectId) => ({
				monster_id: monsterId,
				special_effect_id: effectId
			}));
			const { error: insertErr } = await supabase.from('monster_special_effects').insert(effectRecords);
			if (insertErr) throw insertErr;
		}

		await Promise.all([loadMonsterSpecialEffects(), loadMonsters()]);
		updateFilteredCards();

		return monsterId;
	}

	async function handleWorkspaceMonsterDelete(id: string) {
		const { error: err } = await supabase.from('monsters').delete().eq('id', id);
		if (err) throw err;
		await Promise.all([loadMonsterSpecialEffects(), loadMonsters()]);
		updateFilteredCards();
	}

	// Special Effect CRUD
	function openEffectForm() {
		editingEffectId = null;
		effectFormData = {
			name: '',
			description: null,
			icon: null,
			color: '#a855f7',
			effect_type: 'during_combat'
		};
		showEffectDrawer = true;
	}

	function openEffectEditForm(effect: SpecialEffectRow) {
		editingEffectId = effect.id;
		effectFormData = {
			name: effect.name,
			description: effect.description,
			icon: effect.icon,
			color: effect.color || '#a855f7',
			effect_type: effect.effect_type || 'during_combat'
		};
		showEffectDrawer = true;
	}

	async function saveEffect() {
		if (!effectFormData.name.trim()) {
			alert('Effect name is required.');
			return;
		}

		try {
			if (isEditingEffect) {
				const { error: err } = await supabase
					.from('special_effects')
					.update({
						name: effectFormData.name,
						description: effectFormData.description,
						icon: effectFormData.icon,
						color: effectFormData.color,
						effect_type: effectFormData.effect_type,
						updated_at: new Date().toISOString()
					})
					.eq('id', editingEffectId);
				if (err) throw err;
			} else {
				const { error: err } = await supabase
					.from('special_effects')
					.insert({
						name: effectFormData.name,
						description: effectFormData.description,
						icon: effectFormData.icon,
						color: effectFormData.color,
						effect_type: effectFormData.effect_type
					});
				if (err) throw err;
			}

			await loadSpecialEffects();
			showEffectDrawer = false;
			editingEffectId = null;
		} catch (err) {
			alert(`Failed to save special effect: ${getErrorMessage(err)}`);
		}
	}

	async function deleteEffect(effectId: string) {
		if (!confirm('Are you sure you want to delete this special effect?')) return;

		try {
			const { error: err } = await supabase
				.from('special_effects')
				.delete()
				.eq('id', effectId);
			if (err) throw err;
			await loadSpecialEffects();
		} catch (err) {
			alert(`Failed to delete special effect: ${getErrorMessage(err)}`);
		}
	}

	function submitEffectForm(e: SubmitEvent) {
		e.preventDefault();
		void saveEffect();
	}

	// Gallery filtering
	$effect(() => {
		updateFilteredCards();
	});

	function updateFilteredCards() {
		filteredCards = allCards.filter(card => {
			if (stateFilter !== 'all') if (card.data.state !== stateFilter) return false;
			if (classificationFilter !== 'all')
				if ((card.data.monster_classification ?? 'monster') !== classificationFilter) return false;
			if (statusFilter === 'generated' && !card.card_image_path) return false;
			if (statusFilter === 'not-generated' && card.card_image_path) return false;
			if (searchQuery.trim() && !card.name.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false;
			}
			return true;
		});
	}

	// Gallery selection
	function toggleSelection(cardId: string) {
		if (selectedCardIds.has(cardId)) {
			selectedCardIds.delete(cardId);
		} else {
			selectedCardIds.add(cardId);
		}
		selectedCardIds = new Set(selectedCardIds);
	}

	function selectAll() {
		selectedCardIds = new Set(filteredCards.map(c => c.id));
	}

	function deselectAll() {
		selectedCardIds.clear();
		selectedCardIds = new Set(selectedCardIds);
	}

	// Card generation
	async function generateCard(card: CardItem) {
		generatingCards.add(card.id);
		generatingCards = new Set(generatingCards);
		progressMessage = `Generating card for ${card.name}...`;

		try {
			const monster = card.data;
			const rewardTrackIds = normalizeRewardTrack(monster.barrier ?? 0, (monster as any).reward_track);
			const rewardTrackIconUrls = rewardTrackIds.map((slot) =>
				slot
					.map((id) => getIconPoolUrl(id))
					.filter((url): url is string => typeof url === 'string' && url.length > 0)
			);
			const blob = await generateMonsterCardPNG(
				monster,
				monster.art_url,
				monster.icon_url,
				rewardTrackIconUrls
			);

			const { data, error: uploadError } = await processAndUploadImage(blob, {
				folder: 'monster_cards',
				filename: card.id,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) throw uploadError;

			const uploadedPath = data?.path ?? '';
			const { error: updateError } = await supabase
				.from('monsters')
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
		const selectedCards = filteredCards.filter(c => selectedCardIds.has(c.id));
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

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}
</script>

<PageLayout
	title="Arcane Abyss"
	subtitle="Monsters and card generation for the abyss deck"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		{#if activeTab === 'special-effects'}
			<Button variant="primary" onclick={openEffectForm}>+ Effect</Button>
		{:else if activeTab === 'gallery'}
			<Button variant="secondary" onclick={() => showGalleryModal = true}>View Gallery</Button>
		{/if}
	{/snippet}

	{#snippet tabActions()}
		{#if activeTab === 'deck'}
			<span class="count">{monsters.length} monsters</span>
		{:else if activeTab === 'special-effects'}
			<span class="count">{specialEffects.length} effects</span>
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
			{monsters}
			events={[]}
			locations={invadeLocations}
			{specialEffects}
			{monsterSpecialEffects}
			onMonsterSave={handleWorkspaceMonsterSave}
			onMonsterDelete={handleWorkspaceMonsterDelete}
			onSaveDeckOrder={saveDeckOrder}
			defaultShowCardPreviews={false}
			showEvents={false}
		/>
	{:else if activeTab === 'special-effects'}
		<div class="effects-grid">
			{#each specialEffects as effect (effect.id)}
				{@const typeLabel = effectTypeOptions.find(o => o.value === effect.effect_type)?.label ?? 'During Combat'}
				{@const typeColor = effectTypeColors[effect.effect_type] ?? effectTypeColors.during_combat}
				<div class="effect-card" style="--effect-color: {effect.color || '#a855f7'}">
					<div class="effect-card__type-badge" style="--type-color: {typeColor}">
						{typeLabel}
					</div>
					<div class="effect-card__header">
						{#if effect.icon}
							<span class="effect-card__icon">{effect.icon}</span>
						{/if}
						<h3 class="effect-card__name">{effect.name}</h3>
						<button class="effect-card__menu" onclick={() => openEffectEditForm(effect)}>
							Edit
						</button>
					</div>
					{#if effect.description}
						<p class="effect-card__desc">{effect.description}</p>
					{/if}
					<div class="effect-card__footer">
						<span class="effect-card__color-preview"></span>
						<button class="effect-card__delete" onclick={() => deleteEffect(effect.id)}>
							Delete
						</button>
					</div>
				</div>
			{/each}
			{#if specialEffects.length === 0}
				<div class="empty-state">No special effects yet. Click "+ Effect" to create one.</div>
			{/if}
		</div>
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

					<select bind:value={stateFilter} class="filter-select">
						<option value="all">All States</option>
						<option value="tainted">Tainted</option>
						<option value="corrupt">Corrupt</option>
						<option value="fallen">Fallen</option>
						<option value="arcane">Arcane</option>
						<option value="inactive">Inactive</option>
					</select>

					<select bind:value={classificationFilter} class="filter-select">
						<option value="all">All Classifications</option>
						<option value="monster">Monster</option>
						<option value="abyss_guardian">Abyss Guardian</option>
						<option value="boss">Boss</option>
					</select>

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
									{#if card.data.icon_url}
										<img src={card.data.icon_url} alt={card.name} class="placeholder-icon" />
									{:else if card.data.icon}
										<div class="placeholder-emoji">{card.data.icon}</div>
									{/if}
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
								<span class="card-badge state-badge" style="--state-color: {getStateColor(card.data.state)}">
									{card.data.state}
								</span>
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

<!-- Special Effect Drawer -->
{#if showEffectDrawer}
	<div
		class="drawer-backdrop"
		role="button"
		tabindex="0"
		onclick={(e) => e.currentTarget === e.target && (showEffectDrawer = false)}
		onkeydown={(e) => e.key === 'Escape' && (showEffectDrawer = false)}
	>
		<div
			class="drawer"
			role="dialog"
			tabindex="-1"
		>
			<div class="drawer-header">
				<h2>{isEditingEffect ? 'Edit Special Effect' : 'Create Special Effect'}</h2>
				<button class="close-btn" onclick={() => showEffectDrawer = false}>&times;</button>
			</div>
			<div class="drawer-content">
				<form id="effect-form" class="form-grid" onsubmit={submitEffectForm}>
					<div class="full-width">
						<FormField label="Name" required>
							<Input type="text" bind:value={effectFormData.name} required />
						</FormField>
					</div>
					<FormField label="Effect Type">
						<select bind:value={effectFormData.effect_type} class="effect-type-select">
							{#each effectTypeOptions as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</FormField>
					<FormField label="Icon (emoji)">
						<Input type="text" bind:value={effectFormData.icon} placeholder="✨" />
					</FormField>
					<FormField label="Color">
						<Input type="color" bind:value={effectFormData.color} />
					</FormField>
					<div class="full-width">
						<FormField label="Description">
							<Textarea rows={3} bind:value={effectFormData.description} placeholder="Effect description..." />
						</FormField>
					</div>
				</form>
			</div>
			<div class="drawer-footer">
				<Button variant="primary" type="submit" form="effect-form">
					{isEditingEffect ? 'Update' : 'Create'}
				</Button>
				<Button onclick={() => showEffectDrawer = false}>Cancel</Button>
			</div>
		</div>
	</div>
{/if}

<MonsterCardGallery bind:isOpen={showGalleryModal} {monsters} events={[]} />

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

	/* Gallery Tab Styles */
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
		background: rgba(168, 85, 247, 0.05);
	}

	.card-checkbox {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 10;
	}

	.card-checkbox input[type="checkbox"] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
		accent-color: #a855f7;
	}

	.card-preview {
		width: 100%;
		aspect-ratio: 3 / 2;
		background: rgba(15, 23, 42, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		overflow: hidden;
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

	.placeholder-icon {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	.placeholder-emoji {
		font-size: 2rem;
	}

	.placeholder-text {
		color: #64748b;
		font-size: 0.7rem;
	}

	.card-status {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.65rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}

	.card-status.generated {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.status-icon {
		font-size: 0.8rem;
	}

	.card-generating {
		position: absolute;
		inset: 0;
		background: rgba(15, 23, 42, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 3px solid rgba(148, 163, 184, 0.2);
		border-top-color: #a855f7;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.card-info {
		padding: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 0.35rem;
		margin-bottom: 0.5rem;
	}

	.card-name {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #f8fafc;
		flex: 1;
	}

	.card-badge {
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.state-badge {
		background: color-mix(in srgb, var(--state-color) 20%, transparent);
		color: var(--state-color);
		border: 1px solid color-mix(in srgb, var(--state-color) 30%, transparent);
	}

	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.card-order {
		color: #64748b;
		font-size: 0.7rem;
		font-weight: 500;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	/* Special Effects Grid */
	.effects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.effect-card {
		background: rgba(30, 41, 59, 0.6);
		border: 2px solid color-mix(in srgb, var(--effect-color) 30%, transparent);
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.15s;
	}

	.effect-card:hover {
		border-color: var(--effect-color);
		background: color-mix(in srgb, var(--effect-color) 5%, rgba(30, 41, 59, 0.8));
	}

	.effect-card__type-badge {
		align-self: flex-start;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--type-color);
		background: color-mix(in srgb, var(--type-color) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--type-color) 30%, transparent);
	}

	.effect-card__header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.effect-card__icon {
		font-size: 1.25rem;
	}

	.effect-card__name {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--effect-color);
		flex: 1;
	}

	.effect-card__menu {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.6);
		color: #94a3b8;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.effect-card__menu:hover {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.4);
		color: #60a5fa;
	}

	.effect-card__desc {
		margin: 0;
		font-size: 0.8rem;
		color: #94a3b8;
		line-height: 1.4;
	}

	.effect-card__footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: auto;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
	}

	.effect-card__color-preview {
		width: 20px;
		height: 20px;
		border-radius: 4px;
		background: var(--effect-color);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.effect-card__delete {
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		border: 1px solid rgba(248, 113, 113, 0.3);
		background: rgba(248, 113, 113, 0.1);
		color: #f87171;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.effect-card__delete:hover {
		background: rgba(248, 113, 113, 0.25);
		border-color: rgba(248, 113, 113, 0.5);
	}

	/* Drawer Styles */
	.drawer-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.drawer {
		background: #0f172a;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.drawer-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(15, 23, 42, 0.8);
	}

	.drawer-header h2 {
		margin: 0;
		font-size: 1rem;
		color: #f8fafc;
	}

	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.5rem;
		cursor: pointer;
		padding: 0;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.15s;
	}

	.close-btn:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #f8fafc;
	}

	.drawer-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.drawer-footer {
		padding: 0.75rem 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		background: rgba(15, 23, 42, 0.8);
	}

	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.5rem;
	}

	.form-grid .full-width {
		grid-column: 1 / -1;
	}

	.effect-type-select {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #f8fafc;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.effect-type-select:focus {
		outline: none;
		border-color: rgba(168, 85, 247, 0.75);
	}
</style>
