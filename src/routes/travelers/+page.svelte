<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { TravelerRow, IconPoolRow, TradeRow, GainRow } from '$lib/types/gameData';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { getErrorMessage } from '$lib/utils';
	import { generateTravelerCardPNG } from '$lib/generators/cards';
	import { loadAllIcons, getIconPoolUrl } from '$lib/utils/iconPool';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button } from '$lib/components/ui';
	import { MonsterCardGallery } from '$lib/components/monsters';
	import TravelerCardCanvasPreview from '$lib/components/travelers/TravelerCardCanvasPreview.svelte';
	import type { ResolvedRewardRow } from '$lib/components/abyss-deck';
	import AbyssDeckWorkspace from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
	import type {
		DeckOrderItem,
		MonsterFormData as AbyssMonsterFormData
	} from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';

	type Traveler = TravelerRow & {
		icon_url: string | null;
		art_url: string | null;
		resolved_reward_rows: ResolvedRewardRow[];
	};

	// Card gallery types
	type CardItem = {
		type: 'monster';
		id: string;
		name: string;
		order_num: number;
		card_image_path: string | null;
		data: Traveler;
	};

	// Tab state
	const tabs: Tab[] = [
		{ id: 'deck', label: 'Deck Builder', icon: '🃏' },
		{ id: 'gallery', label: 'Card Gallery', icon: '🖼️' }
	];
	let activeTab = $state('deck');

	// Data state
	let travelers = $state<Traveler[]>([]);
	let allCards = $state<CardItem[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Lookups
	let iconPool = $state<IconPoolRow[]>([]);

	// Sample preview state
	let sampleCards = $state<Traveler[]>([]);
	let sampleLoading = $state(false);
	let sampleError = $state<string | null>(null);

	// Gallery state
	let searchQuery = $state('');
	let typeFilter = $state<'all' | 'monster'>('all');
	let stateFilter = $state<'all' | 'tainted' | 'corrupt' | 'fallen' | 'boss'>('all');
	let statusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
	let selectedCardIds = $state(new Set<string>());
	let generatingCards = $state(new Set<string>());
	let progressMessage = $state('');
	let showGalleryModal = $state(false);

	const selectedCount = $derived(selectedCardIds.size);
	const generatedCount = $derived(allCards.filter(c => c.card_image_path).length);
	const totalCount = $derived(allCards.length);
		const filteredCards = $derived.by(() => {
			const query = searchQuery.trim().toLowerCase();
			return allCards.filter(card => {
				if (typeFilter !== 'all' && card.type !== typeFilter) return false;
				if (stateFilter !== 'all' && card.type === 'monster') {
					const traveler = card.data as Traveler;
					if (traveler.state !== stateFilter) return false;
				}
			if (statusFilter === 'generated' && !card.card_image_path) return false;
			if (statusFilter === 'not-generated' && card.card_image_path) return false;
			if (query && !card.name.toLowerCase().includes(query)) {
				return false;
			}
			return true;
			});
		});

		function travelerStateToStage(state: Traveler['state'] | null | undefined): AbyssMonsterFormData['stage'] {
			switch (state) {
				case 'tainted':
					return 'stage_1';
				case 'corrupt':
					return 'stage_2';
				case 'fallen':
					return 'stage_3';
				case 'boss':
					return 'stage_3';
				default:
					return 'stage_1';
			}
		}

		function stageToTravelerState(stage: AbyssMonsterFormData['stage'] | null | undefined): Traveler['state'] {
			switch (stage) {
				case 'stage_1':
					return 'tainted';
				case 'stage_2':
					return 'corrupt';
				case 'stage_3':
					return 'fallen';
				case 'final_stage':
					return 'boss';
				case 'inactive':
				default:
					return 'tainted';
			}
		}

		const travelersAsMonsters = $derived.by(() => {
			return travelers.map((traveler) => ({
				...traveler,
				// AbyssDeckWorkspace / MonsterCardGallery expect MonsterRow shape.
				monster_classification: 'monster' as const,
				stage: travelerStateToStage(traveler.state)
			}));
		});

	onMount(loadData);

	async function loadData() {
		loading = true;
		error = null;
		try {
			iconPool = await loadAllIcons();
			await loadTravelers();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadTravelers() {
		const { data, error: err } = await supabase.from('travelers').select('*').order('order_num');
		if (err) throw new Error(err.message);

		travelers = (data ?? []).map((traveler) => {
			const resolvedRewardRows: ResolvedRewardRow[] = (traveler.reward_rows ?? []).map((row: any) => ({
				...row,
				icon_urls: (row.icon_ids ?? []).map((id: string) => getIconPoolUrl(id))
			}));
			const tradeLeft = Array.isArray(traveler.trade_left_icon_ids)
				? traveler.trade_left_icon_ids
				: [];
			const tradeRight = Array.isArray(traveler.trade_right_icon_ids)
				? traveler.trade_right_icon_ids
				: [];
			const tradeRows = normalizeTradeRows(
				(traveler as { trade_rows?: TradeRow[] }).trade_rows,
				tradeLeft,
				tradeRight
			);
			const gainRows = normalizeGainRows((traveler as { gain_rows?: GainRow[] }).gain_rows);

			return {
				...traveler,
				trade_left_icon_ids: tradeLeft,
				trade_right_icon_ids: tradeRight,
				trade_rows: tradeRows,
				gain_rows: gainRows,
				icon_url: getTravelerIconUrl(traveler.icon, traveler.updated_at),
				art_url: getTravelerImageUrl(traveler.image_path, traveler.updated_at),
				resolved_reward_rows: resolvedRewardRows
			};
		});

		allCards = [
			...travelers.map(m => ({
				type: 'monster' as const,
				id: m.id,
				name: m.name,
				order_num: m.order_num ?? 999,
				card_image_path: m.card_image_path,
				data: m
			}))
		];
	}

	function getTravelerIconUrl(icon: string | null | undefined, updatedAt?: string | null): string | null {
		if (!icon) return null;
		if (icon.includes('/')) {
			const path = icon.startsWith('traveler_icons/') ? icon : `traveler_icons/${icon}`;
			return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
		}
		return null;
	}

	function getTravelerImageUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
		if (!imagePath) return null;
		const path = imagePath.startsWith('travelers/') ? imagePath : `travelers/${imagePath}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function getStateColor(state: string | null | undefined): string {
		switch (state) {
			case 'tainted': return '#c084fc';
			case 'corrupt': return '#6b21a8';
			case 'fallen': return '#065f46';
			case 'boss': return '#ef4444';
			default: return '#94a3b8';
		}
	}

	function getCardImageUrl(card: CardItem): string | null {
		if (!card.card_image_path) return null;
		const { data } = supabase.storage.from('game_assets').getPublicUrl(card.card_image_path);
		return data?.publicUrl || null;
	}

	function pickRandom<T>(items: readonly T[]): T {
		return items[Math.floor(Math.random() * items.length)];
	}

	function shuffle<T>(items: T[]): T[] {
		const next = [...items];
		for (let i = next.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[next[i], next[j]] = [next[j], next[i]];
		}
		return next;
	}

	function pickIconSet(count: number): { ids: string[]; urls: string[] } {
		if (iconPool.length === 0) {
			return { ids: [], urls: [] };
		}
		const picks = shuffle(iconPool).slice(0, count);
		const ids = picks.map((icon) => icon.id);
		const urls = ids.map((id) => getIconPoolUrl(id)).filter((url): url is string => !!url);
		return { ids, urls };
	}

	function buildSampleTradeRow(): TradeRow {
		const leftGroupA = pickIconSet(3).ids;
		const leftGroupB = pickIconSet(2).ids;
		const rightGroupA = pickIconSet(3).ids;
		const rightGroupB = pickIconSet(2).ids;
		return {
			left_icon_ids: [...leftGroupA, ...leftGroupB],
			right_icon_ids: [...rightGroupA, ...rightGroupB],
			left_icon_groups: [leftGroupA, leftGroupB],
			right_icon_groups: [rightGroupA, rightGroupB]
		};
	}

	function buildSampleTradeRows(): TradeRow[] {
		return [buildSampleTradeRow(), buildSampleTradeRow()];
	}

	function buildSampleGainRows(): GainRow[] {
		return [
			{
				icon_ids: pickIconSet(5).ids,
				icon_groups: [pickIconSet(3).ids, pickIconSet(2).ids]
			},
			{
				icon_ids: pickIconSet(4).ids,
				icon_groups: [pickIconSet(2).ids, pickIconSet(2).ids]
			}
		];
	}

	function normalizeGroups(groups: string[][] | null | undefined, fallback?: string[] | null): string[][] {
		if (Array.isArray(groups) && groups.length > 0) {
			return groups.map((group) => (Array.isArray(group) ? group : []));
		}
		if (Array.isArray(fallback) && fallback.length > 0) {
			return [fallback];
		}
		return [[]];
	}

	function flattenGroups(groups: string[][]): string[] {
		return groups.flatMap((group) => group.filter((id): id is string => typeof id === 'string'));
	}

	function normalizeTradeRows(
		rows: TradeRow[] | null | undefined,
		fallbackLeft?: string[] | null,
		fallbackRight?: string[] | null
	): TradeRow[] {
		const safeRows = Array.isArray(rows)
			? rows.map((row) => {
					const leftGroups = normalizeGroups(row.left_icon_groups, row.left_icon_ids);
					const rightGroups = normalizeGroups(row.right_icon_groups, row.right_icon_ids);
					return {
						left_icon_ids: flattenGroups(leftGroups),
						right_icon_ids: flattenGroups(rightGroups),
						left_icon_groups: leftGroups,
						right_icon_groups: rightGroups
					};
				})
			: [];

		if (safeRows.length > 0) return safeRows;

		const left = Array.isArray(fallbackLeft) ? fallbackLeft : [];
		const right = Array.isArray(fallbackRight) ? fallbackRight : [];
		if (left.length > 0 || right.length > 0) {
			const leftGroups = normalizeGroups(null, left);
			const rightGroups = normalizeGroups(null, right);
			return [
				{
					left_icon_ids: flattenGroups(leftGroups),
					right_icon_ids: flattenGroups(rightGroups),
					left_icon_groups: leftGroups,
					right_icon_groups: rightGroups
				}
			];
		}

		return [{ left_icon_ids: [], right_icon_ids: [], left_icon_groups: [[]], right_icon_groups: [[]] }];
	}

	function normalizeGainRows(rows: GainRow[] | null | undefined): GainRow[] {
		const safeRows = Array.isArray(rows)
			? rows.map((row) => {
					const groups = normalizeGroups(row.icon_groups, row.icon_ids);
					return {
						icon_ids: flattenGroups(groups),
						icon_groups: groups
					};
				})
			: [];

		return safeRows.length > 0 ? safeRows : [{ icon_ids: [], icon_groups: [[]] }];
	}

	async function generateSampleCards() {
		sampleLoading = true;
		sampleError = null;

		try {
			const { data, error: err } = await supabase
				.from('hex_spirits')
				.select('id, art_raw_image_path')
				.not('art_raw_image_path', 'is', null)
				.limit(40);
			if (err) throw err;

			const artUrls = (data ?? [])
				.map((row) => publicAssetUrl(row.art_raw_image_path, { updatedAt: Date.now() }))
				.filter((url): url is string => !!url);

			const nameFragments = ['Wandering', 'Silent', 'Luminous', 'Ashen', 'Verdant', 'Ivory', 'Crimson', 'Sable'];
			const nameNouns = ['Pilgrim', 'Envoy', 'Seeker', 'Cartographer', 'Oracle', 'Nomad', 'Harbinger', 'Warden'];
			const subtexts = [
				'Keeps the map that remembers.',
				'Leaves only starlight behind.',
				'Carries a vow of quiet roads.',
				'Guides the lost by ember glow.',
				'Walks between worlds unseen.',
				'Turns dust into direction.'
			];
			const descriptions = [
				'Trades quiet paths for forgotten relics, always arriving before the dawn.',
				'Collects whispers from every city gate, bartering secrets for safe passage.',
				'Marks the road with amber chalk, offering omens in exchange for supplies.',
				'Keeps a ledger of favors owed, settling debts with a measured smile.',
				'Knows which trails hold old magic, and which tolls must be paid.',
				'Arrives with weathered notes, trading maps for a moment of shelter.'
			];
			const emojiIcons = ['🧭', '🪶', '🗺️', '🕯️', '🌘', '🪞', '🧿', '🪐'];
			const travelerStates = ['tainted', 'corrupt', 'fallen', 'boss'] as const;

			const sample = Array.from({ length: 4 }, (_, index) => {
				const tradeRows = buildSampleTradeRows();
				const gainRows = buildSampleGainRows();
				const heroIcon = pickIconSet(1);
				return {
					id: `sample-${Date.now()}-${index}`,
					name: `${pickRandom(nameFragments)} ${pickRandom(nameNouns)}`,
					traveler_subtext: pickRandom(subtexts),
					traveler_description: pickRandom(descriptions),
					damage: 0,
					barrier: 0,
					state: pickRandom(travelerStates),
					icon: pickRandom(emojiIcons),
					icon_url: heroIcon.urls[0] ?? null,
					image_path: null,
					reward_rows: [],
					trade_left_icon_ids: tradeRows[0]?.left_icon_ids ?? [],
					trade_right_icon_ids: tradeRows[0]?.right_icon_ids ?? [],
					trade_rows: tradeRows,
					gain_rows: gainRows,
					order_num: index,
					card_image_path: null,
					special_conditions: null,
					invade_location_id: null,
					quantity: 1,
					created_at: null,
					updated_at: null,
					art_url: artUrls[index % artUrls.length] ?? null,
					resolved_reward_rows: []
				};
			});

			sampleCards = sample;
		} catch (err) {
			sampleError = getErrorMessage(err);
		} finally {
			sampleLoading = false;
		}
	}

	async function saveDeckOrder(order: DeckOrderItem[]) {
		const monsterUpdates = order
			.map((item, order_num) => (item.type === 'monster' ? { id: item.id, order_num } : null))
			.filter((x): x is { id: string; order_num: number } => x !== null);

		if (monsterUpdates.length > 0) {
			for (const update of monsterUpdates) {
				const { error: err } = await supabase
					.from('travelers')
					.update({ order_num: update.order_num })
					.eq('id', update.id);
				if (err) throw err;
			}
		}

		await Promise.all([loadTravelers()]);
	}

	async function handleWorkspaceMonsterSave(formData: AbyssMonsterFormData, id: string | null): Promise<string> {
		if (!formData.name.trim()) {
			throw new Error('Traveler name is required.');
		}

		const tradeRows = Array.isArray(formData.trade_rows)
			? formData.trade_rows
					.map((row) => {
						const leftGroups = normalizeGroups(row.left_icon_groups, row.left_icon_ids);
						const rightGroups = normalizeGroups(row.right_icon_groups, row.right_icon_ids);
						return {
							left_icon_ids: flattenGroups(leftGroups),
							right_icon_ids: flattenGroups(rightGroups),
							left_icon_groups: leftGroups,
							right_icon_groups: rightGroups
						};
					})
					.filter((row) => row.left_icon_ids.length > 0 || row.right_icon_ids.length > 0)
			: [];
		const firstRow = tradeRows[0] ?? { left_icon_ids: [], right_icon_ids: [] };
		const gainRows = Array.isArray(formData.gain_rows)
			? formData.gain_rows
					.map((row) => {
						const groups = normalizeGroups(row.icon_groups, row.icon_ids);
						return {
							icon_ids: flattenGroups(groups),
							icon_groups: groups
						};
					})
					.filter((row) => row.icon_ids.length > 0)
			: [];

		let monsterId: string;

		if (id) {
			const { error: err } = await supabase
				.from('travelers')
					.update({
						name: formData.name,
						traveler_subtext: formData.subtext ?? null,
						traveler_description: formData.description ?? null,
						damage: 0,
						barrier: 0,
						state: stageToTravelerState(formData.stage),
						icon: formData.icon,
						image_path: formData.image_path,
						invade_location_id: null,
						order_num: formData.order_num,
					reward_rows: [],
					trade_left_icon_ids: firstRow.left_icon_ids ?? [],
					trade_right_icon_ids: firstRow.right_icon_ids ?? [],
					trade_rows: tradeRows,
					gain_rows: gainRows,
					quantity: formData.quantity,
					updated_at: new Date().toISOString()
				})
				.eq('id', id);
			if (err) throw err;
			monsterId = id;
		} else {
			const { data, error: err } = await supabase
				.from('travelers')
					.insert({
						name: formData.name,
						traveler_subtext: formData.subtext ?? null,
						traveler_description: formData.description ?? null,
						damage: 0,
						barrier: 0,
						state: stageToTravelerState(formData.stage),
						icon: formData.icon,
						image_path: formData.image_path,
						invade_location_id: null,
						order_num: formData.order_num,
					reward_rows: [],
					trade_left_icon_ids: firstRow.left_icon_ids ?? [],
					trade_right_icon_ids: firstRow.right_icon_ids ?? [],
					trade_rows: tradeRows,
					gain_rows: gainRows,
					quantity: formData.quantity
				})
				.select('id')
				.single();
			if (err) throw err;
			monsterId = data.id;
		}

		await Promise.all([loadTravelers()]);

		return monsterId;
	}

	async function handleWorkspaceMonsterDelete(id: string) {
		const { error: err } = await supabase.from('travelers').delete().eq('id', id);
		if (err) throw err;
		await Promise.all([loadTravelers()]);
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
			const traveler = card.data as Traveler;
			const blob = await generateTravelerCardPNG(traveler);
			const folder = 'traveler_cards';

			const { data, error: uploadError } = await processAndUploadImage(blob, {
				folder,
				filename: card.id,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) throw uploadError;

			const uploadedPath = data?.path ?? '';
			const table = 'travelers';
			const { error: updateError } = await supabase
				.from(table)
				.update({ card_image_path: uploadedPath })
				.eq('id', card.id);

			if (updateError) throw updateError;

			card.card_image_path = uploadedPath;
			allCards = [...allCards];

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
	title="Travelers"
	subtitle="Travelers and card generation for the travelers deck"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		{#if activeTab === 'gallery'}
			<Button variant="secondary" onclick={() => showGalleryModal = true}>View Gallery</Button>
		{:else if activeTab === 'deck'}
			<Button variant="secondary" onclick={generateSampleCards} disabled={sampleLoading}>
				{sampleLoading ? 'Generating Samples...' : 'Generate Sample Cards'}
			</Button>
		{/if}
	{/snippet}

	{#snippet tabActions()}
		{#if activeTab === 'deck'}
			<span class="count">{travelers.length} travelers</span>
		{:else if activeTab === 'gallery'}
			<span class="count">{generatedCount}/{totalCount} generated</span>
		{/if}
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'deck'}
		<section class="samples">
			<div class="samples-header">
				<div>
					<h3>Traveler Design Samples</h3>
					<p>Four randomized cards in the current traveler style.</p>
				</div>
				<Button variant="secondary" onclick={generateSampleCards} disabled={sampleLoading}>
					{sampleLoading ? 'Generating...' : 'Refresh Samples'}
				</Button>
			</div>

			{#if sampleError}
				<div class="sample-error">Sample error: {sampleError}</div>
			{:else if sampleCards.length === 0}
				<div class="sample-empty">Generate samples to preview the traveler style.</div>
			{:else}
				<div class="samples-grid">
					{#each sampleCards as card (card.id)}
						<div class="sample-card">
							<div class="sample-preview" style="--scale: 0.68; width: {600 * 0.68}px; height: {437 * 0.68}px;">
								<div class="copy-inner">
									<TravelerCardCanvasPreview monster={card} />
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<AbyssDeckWorkspace
			monsters={travelersAsMonsters}
			events={[]}
			locations={[]}
			specialEffects={[]}
			monsterSpecialEffects={{}}
			onMonsterSave={handleWorkspaceMonsterSave}
			onMonsterDelete={handleWorkspaceMonsterDelete}
			onSaveDeckOrder={saveDeckOrder}
			monsterLabel="Traveler"
			monsterLabelPlural="Travelers"
			monsterIcon="🧭"
			showEvents={false}
			showSubtext={true}
			showDescription={true}
			showImageUpload={true}
			imageUploadFolder="travelers"
			imageUploadAspectRatio="3/4"
			imageUploadCropTransparent={false}
			showGainRows={true}
			showStats={false}
			showInvadeLocation={false}
			showSpecialEffects={false}
			showRewardRows={false}
			showTradeRow={true}
			monsterPreviewComponent={TravelerCardCanvasPreview}
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

					<select bind:value={typeFilter} class="filter-select">
						<option value="all">All Types</option>
						<option value="monster">Travelers</option>
					</select>

					{#if typeFilter === 'monster' || typeFilter === 'all'}
						<select bind:value={stateFilter} class="filter-select">
							<option value="all">All States</option>
							<option value="tainted">Tainted</option>
							<option value="corrupt">Corrupt</option>
							<option value="fallen">Fallen</option>
							<option value="boss">Boss</option>
						</select>
					{/if}

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
					{@const traveler = card.data as Traveler}
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
									{#if traveler.icon_url}
										<img src={traveler.icon_url} alt={card.name} class="placeholder-icon" />
									{:else if traveler.icon}
										<div class="placeholder-emoji">{traveler.icon}</div>
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
								<span class="card-badge state-badge" style="--state-color: {getStateColor(traveler.state)}">
									{traveler.state}
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

<MonsterCardGallery bind:isOpen={showGalleryModal} monsters={travelersAsMonsters} events={[]} />

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

	.samples {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.samples-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.samples-header h3 {
		margin: 0 0 0.25rem 0;
		font-size: 0.9rem;
	}

	.samples-header p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.samples-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.75rem;
	}

	.sample-card {
		background: rgba(2, 6, 23, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: center;
	}

	.sample-preview .copy-inner {
		transform: scale(var(--scale));
		transform-origin: top left;
	}

	.sample-empty,
	.sample-error {
		font-size: 0.75rem;
		color: #94a3b8;
		text-align: center;
		padding: 0.5rem;
	}

	.sample-error {
		color: #fca5a5;
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

	.card-item.event {
		border-color: rgba(59, 130, 246, 0.3);
	}

	.card-item.event:hover {
		border-color: rgba(59, 130, 246, 0.6);
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

	.event-placeholder {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(59, 130, 246, 0.05));
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

	.event-badge {
		background: rgba(59, 130, 246, 0.2);
		color: #60a5fa;
		border: 1px solid rgba(59, 130, 246, 0.3);
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

	.saving-banner {
		margin-top: 1rem;
		padding: 0.6rem 0.9rem;
		border-radius: 10px;
		border: 1px solid rgba(201, 168, 108, 0.25);
		background: rgba(201, 168, 108, 0.08);
		color: rgba(232, 213, 181, 0.9);
		font-size: 0.85rem;
	}

</style>
