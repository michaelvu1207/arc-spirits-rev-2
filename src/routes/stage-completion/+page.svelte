<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { StageCompletionCardRow } from '$lib/types/gameData';
	import { DEFAULT_EVENT_TYPE, EVENT_TYPE_OPTIONS, eventTypeLabel, type EventType } from '$lib/types/eventTypes';
	import { getErrorMessage } from '$lib/utils';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import StageCompletionCardLayoutConfigurator from '$lib/components/stage-completion/StageCompletionCardLayoutConfigurator.svelte';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { loadImage } from '$lib/generators/shared/canvas';
	import { loadLayoutConfig } from '$lib/services/layoutConfigService';
	import { coerceConfig } from '$lib/generators/shared/stageCompletionCardLayoutConfig';
	import {
		renderStageCompletionCardBlob,
		loadStageCompletionFonts,
		type StageCompletionCardForExport
	} from '$lib/generators/cards/stageCompletionCardGenerator';

	type Card = Pick<
		StageCompletionCardRow,
		'id' | 'title' | 'complete_condition' | 'reward_rows' | 'stage' | 'scenario_id' | 'image_path' | 'card_image_path' | 'data' | 'order_num' | 'updated_at'
	>;

	type Scenario = { id: string; name: string };
	type StageCompletionDeckLinkSummary = {
		id: string;
		scenario_id: string;
		order_num: number;
	};

	const tabs: Tab[] = [
		{ id: 'cards', label: 'Cards', icon: '📋' },
		{ id: 'gallery', label: 'Gallery', icon: '🖼️' }
	];
	let activeTab = $state('cards');

	let cards = $state<Card[]>([]);
	let scenarios = $state<Scenario[]>([]);
	let stageCompletionDeckLinksByCardId = $state<Record<string, StageCompletionDeckLinkSummary>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);

	type ScenarioCardGroup = {
		id: string;
		name: string;
		cards: Card[];
	};

	const stageSortWeight: Record<EventType, number> = {
		stage_1: 1,
		stage_2: 2,
		stage_3: 3,
		final_stage: 4,
		endgame: 5
	};
	const stageCompletionStageOptions = EVENT_TYPE_OPTIONS.filter((option) => option.value !== 'endgame');

	function sortByStageAndOrder(a: Card, b: Card): number {
		const stageA = stageSortWeight[a.stage] ?? 999;
		const stageB = stageSortWeight[b.stage] ?? 999;
		if (stageA !== stageB) return stageA - stageB;
		return (a.order_num ?? 0) - (b.order_num ?? 0);
	}

	// Cards tab filters
	let searchQuery = $state('');
	let stageFilter = $state<EventType | 'all'>('all');
	let scenarioFilter = $state<string | 'all'>('all');

	const filteredCards = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		return cards.filter((c) => {
			if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
			if (scenarioFilter !== 'all' && c.scenario_id !== scenarioFilter) return false;
			if (!term) return true;
			return (c.title ?? '').toLowerCase().includes(term);
		}).sort(sortByStageAndOrder);
	});

	// Gallery tab filters
	let gallerySearchQuery = $state('');
	let galleryStageFilter = $state<EventType | 'all'>('all');
	let galleryScenarioFilter = $state<string | 'all'>('all');
	let galleryStatusFilter = $state<'all' | 'generated' | 'not-generated'>('all');

	const filteredGalleryCards = $derived.by(() => {
		const term = gallerySearchQuery.trim().toLowerCase();
		return cards
			.filter((c) => {
				if (galleryStageFilter !== 'all' && c.stage !== galleryStageFilter) return false;
				if (galleryScenarioFilter !== 'all' && c.scenario_id !== galleryScenarioFilter) return false;
			if (galleryStatusFilter === 'generated' && !c.card_image_path) return false;
				if (galleryStatusFilter === 'not-generated' && c.card_image_path) return false;
				if (!term) return true;
				return (c.title ?? '').toLowerCase().includes(term);
			})
			.sort(sortByStageAndOrder);
	});

	const filteredCardGroups = $derived.by(() => {
		const unassignedGroup: ScenarioCardGroup = {
			id: '__unassigned',
			name: 'Unassigned',
			cards: []
		};
		const groupsById: Record<string, ScenarioCardGroup> = {};
		for (const scenario of scenarios) {
			groupsById[scenario.id] = {
				id: scenario.id,
				name: scenario.name,
				cards: []
			};
		}

		for (const card of filteredCards) {
			const target = card.scenario_id ? groupsById[card.scenario_id] : undefined;
			if (target) {
				target.cards.push(card);
			} else {
				unassignedGroup.cards.push(card);
			}
		}

		const grouped: ScenarioCardGroup[] = [];
		for (const scenario of scenarios) {
			const group = groupsById[scenario.id];
			if (group?.cards.length) {
				grouped.push(group);
			}
		}
		if (unassignedGroup.cards.length) {
			grouped.push(unassignedGroup);
		}
		return grouped;
	});

	const filteredGalleryGroups = $derived.by(() => {
		const unassignedGroup: ScenarioCardGroup = {
			id: '__unassigned',
			name: 'Unassigned',
			cards: []
		};
		const groupsById: Record<string, ScenarioCardGroup> = {};
		for (const scenario of scenarios) {
			groupsById[scenario.id] = {
				id: scenario.id,
				name: scenario.name,
				cards: []
			};
		}

		for (const card of filteredGalleryCards) {
			const target = card.scenario_id ? groupsById[card.scenario_id] : undefined;
			if (target) {
				target.cards.push(card);
			} else {
				unassignedGroup.cards.push(card);
			}
		}

		const grouped: ScenarioCardGroup[] = [];
		for (const scenario of scenarios) {
			const group = groupsById[scenario.id];
			if (group?.cards.length) {
				grouped.push(group);
			}
		}
		if (unassignedGroup.cards.length) {
			grouped.push(unassignedGroup);
		}
		return grouped;
	});

	// Modal state
	let modalOpen = $state(false);
	let modalSaving = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let modalCardId = $state<string | null>(null);
	let form = $state({
		stage: DEFAULT_EVENT_TYPE as EventType,
		scenario_id: '' as string,
		title: '',
		complete_condition: ''
	});

	// Lookup helpers
	const scenarioMap = $derived(new Map(scenarios.map((s) => [s.id, s.name])));

	function buildStageCompletionDeckEntryPayload(cardId: string, scenarioId: string, order_num: number) {
		return {
			scenario_id: scenarioId,
			kind: 'stage_completion',
			order_num,
			quantity: 1,
			entry_stage: null,
			data: {},
			stage_completion_card_id: cardId
		};
	}

	async function getNextStageCompletionDeckOrderNum(scenarioId: string): Promise<number> {
		const { data, error } = await supabase
			.from('scenario_deck_entries')
			.select('order_num')
			.eq('kind', 'stage_completion')
			.eq('scenario_id', scenarioId)
			.order('order_num', { ascending: false })
			.limit(1);
		if (error) throw error;
		const last = data?.[0]?.order_num;
		return typeof last === 'number' ? last + 1 : 0;
	}

		function getStageCompletionDisplayTitle(card: Card): string {
			const stageLabel = (() => {
				switch (card.stage) {
					case 'stage_1':
						return 'Stage 1';
					case 'stage_2':
						return 'Stage 2';
					case 'stage_3':
						return 'Stage 3';
					case 'final_stage':
						return 'Final Stage';
					default:
						return eventTypeLabel(card.stage);
				}
			})();
		const scenarioName = card.scenario_id ? scenarioMap.get(card.scenario_id) ?? 'Unassigned' : 'Unassigned';
		return `${stageLabel} - ${scenarioName}`;
	}

	// Layout editor state
	let layoutEditorOpen = $state(false);

	onMount(() => {
		void loadCards();
	});

	async function loadCards() {
		loading = true;
		error = null;
		try {
			const [cardsRes, scenariosRes, linksRes] = await Promise.all([
				supabase
					.from('stage_completion_cards')
					.select('id, title, complete_condition, reward_rows, stage, scenario_id, image_path, card_image_path, data, order_num, updated_at')
					.order('order_num')
					.order('title'),
				supabase
					.from('scenarios')
					.select('id, name')
					.order('name'),
				supabase
					.from('scenario_deck_entries')
					.select('id, scenario_id, order_num, stage_completion_card_id')
					.eq('kind', 'stage_completion')
			]);
			if (cardsRes.error) throw cardsRes.error;
			if (scenariosRes.error) throw scenariosRes.error;
			if (linksRes.error) throw linksRes.error;

			const linksByCardId = (linksRes.data ?? []).reduce((acc, row) => {
				if (!row.stage_completion_card_id || acc[row.stage_completion_card_id]) return acc;
				acc[row.stage_completion_card_id] = {
					id: row.id,
					scenario_id: row.scenario_id,
					order_num: row.order_num ?? 0
				};
				return acc;
			}, {} as Record<string, StageCompletionDeckLinkSummary>);

			cards = (cardsRes.data ?? []) as Card[];
			scenarios = (scenariosRes.data ?? []) as Scenario[];
			stageCompletionDeckLinksByCardId = linksByCardId;
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		modalMode = 'create';
		modalCardId = null;
		form = {
			stage: DEFAULT_EVENT_TYPE,
			scenario_id: '',
			title: '',
			complete_condition: ''
		};
		modalOpen = true;
	}

	function openEdit(card: Card) {
		modalMode = 'edit';
		modalCardId = card.id;
		form = {
			stage: card.stage ?? DEFAULT_EVENT_TYPE,
			scenario_id: card.scenario_id ?? '',
			title: card.title ?? '',
			complete_condition: card.complete_condition ?? ''
		};
		modalOpen = true;
	}

	async function saveModal() {
		if (modalSaving) return;
		const title = form.title.trim();
		const scenarioId = form.scenario_id.trim();
		if (!title) {
			alert('Title is required.');
			return;
		}

		modalSaving = true;
		try {
			const now = new Date().toISOString();
			const currentLink = modalCardId ? stageCompletionDeckLinksByCardId[modalCardId] ?? null : null;
			const nextOrderNum =
				scenarioId && currentLink?.scenario_id !== scenarioId ? await getNextStageCompletionDeckOrderNum(scenarioId) : 0;

			if (modalMode === 'create') {
				const id = crypto.randomUUID();
				const { error: insertErr } = await supabase.from('stage_completion_cards').insert({
					id,
					stage: form.stage,
					scenario_id: scenarioId || null,
					title,
					complete_condition: form.complete_condition.trim(),
					reward_rows: [],
					image_path: null,
					card_image_path: null,
					data: {},
					order_num: cards.length,
					updated_at: now
				});
				if (insertErr) throw insertErr;

				if (scenarioId) {
					const { error: deckErr } = await supabase.from('scenario_deck_entries').insert(
						buildStageCompletionDeckEntryPayload(id, scenarioId, nextOrderNum)
					);
					if (deckErr) {
						await supabase.from('stage_completion_cards').delete().eq('id', id);
						throw deckErr;
					}
				}
			} else if (modalMode === 'edit' && modalCardId) {
				const id = modalCardId;
				const { error: updateErr } = await supabase
					.from('stage_completion_cards')
					.update({
						stage: form.stage,
						scenario_id: scenarioId || null,
						title,
						complete_condition: form.complete_condition.trim(),
						updated_at: now
					})
					.eq('id', modalCardId);
				if (updateErr) throw updateErr;

				if (currentLink) {
					if (!scenarioId) {
						const { error: deleteErr } = await supabase
							.from('scenario_deck_entries')
							.delete()
							.eq('kind', 'stage_completion')
							.eq('stage_completion_card_id', id);
						if (deleteErr) throw deleteErr;
					} else if (currentLink.scenario_id !== scenarioId) {
						const { error: deleteErr } = await supabase
							.from('scenario_deck_entries')
							.delete()
							.eq('kind', 'stage_completion')
							.eq('stage_completion_card_id', id);
						if (deleteErr) throw deleteErr;

						const { error: insertErr } = await supabase.from('scenario_deck_entries').insert(
							buildStageCompletionDeckEntryPayload(id, scenarioId, nextOrderNum)
						);
						if (insertErr) {
							await supabase.from('scenario_deck_entries').insert(
								buildStageCompletionDeckEntryPayload(id, currentLink.scenario_id, currentLink.order_num)
							);
							throw insertErr;
						}
					}
				} else if (scenarioId) {
					const { error: insertErr } = await supabase.from('scenario_deck_entries').insert(
						buildStageCompletionDeckEntryPayload(id, scenarioId, nextOrderNum)
					);
					if (insertErr) throw insertErr;
				}
			}

			modalOpen = false;
			modalCardId = null;
			await loadCards();
		} catch (err) {
			alert(`Failed to save card: ${getErrorMessage(err)}`);
		} finally {
			modalSaving = false;
		}
	}

	async function deleteCard(card: Card) {
		if (!confirm(`Delete "${card.title}"? This will also remove it from any scenario decks.`)) return;
		try {
			const { error: deckErr } = await supabase
				.from('scenario_deck_entries')
				.delete()
				.eq('kind', 'stage_completion')
				.eq('stage_completion_card_id', card.id);
			if (deckErr) throw deckErr;

			const { error: delErr } = await supabase.from('stage_completion_cards').delete().eq('id', card.id);
			if (delErr) throw delErr;
			await loadCards();
		} catch (err) {
			alert(`Failed to delete card: ${getErrorMessage(err)}`);
		}
	}

	function getCardImageUrl(card: Card): string | null {
		return publicAssetUrl(card.card_image_path, { updatedAt: card.updated_at ?? undefined });
	}

	function getBaseImageUrl(card: Card): string | null {
		return publicAssetUrl(card.image_path, { updatedAt: card.updated_at ?? undefined });
	}

	// Export all state
	let generatingAll = $state(false);
	let generatingProgress = $state({ processed: 0, total: 0, current: '' });

	async function generateAll() {
		if (generatingAll) return;

		generatingAll = true;
		generatingProgress = { processed: 0, total: 0, current: '' };

		try {
			// Load layout config
			const result = await loadLayoutConfig('stage_completion', 'base');
			if (result.error) throw result.error;
			const config = coerceConfig(result.config);
			if (!config) {
				alert('No layout config found. Please set a default base image in the Layout Editor first.');
				return;
			}

			// Resolve default base image URL from config
			const defaultBaseUrl = config.defaultBaseImagePath
				? publicAssetUrl(config.defaultBaseImagePath)
				: null;

			// Cards are exportable if they have their own image_path OR a default base exists
			const targets = cards.filter((c) => Boolean(c.image_path) || Boolean(defaultBaseUrl));
			if (targets.length === 0) {
				alert('No cards can be exported. Upload a base image per card or set a default base in the Layout Editor.');
				return;
			}

			if (!confirm(`Generate card images for ${targets.length} card${targets.length === 1 ? '' : 's'}?`)) return;

			generatingProgress = { processed: 0, total: targets.length, current: '' };

			// Load fonts
			await loadStageCompletionFonts(config);

			const now = new Date().toISOString();
			const folder = 'card_images/stage_completion/en_generated';
			const errors: string[] = [];

			for (let i = 0; i < targets.length; i++) {
				const card = targets[i];
			generatingProgress = { processed: i, total: targets.length, current: getStageCompletionDisplayTitle(card) };

				try {
					// Per-card image takes priority, fall back to default base
					const baseUrl = publicAssetUrl(card.image_path) ?? defaultBaseUrl;
					if (!baseUrl) continue;

					const baseImg = await loadImage(baseUrl);
				const exportCard: StageCompletionCardForExport = {
						id: card.id,
						title: card.title ?? '',
						complete_condition: card.complete_condition ?? '',
						stage_text: getStageCompletionDisplayTitle(card),
						image_path: card.image_path,
						card_image_path: card.card_image_path,
						updated_at: card.updated_at
					};
					const blob = await renderStageCompletionCardBlob(exportCard, baseImg, config);

					const { data, error: uploadErr } = await processAndUploadImage(blob, {
						folder,
						filename: card.id,
						cropTransparent: false,
						upsert: true
					});
					if (uploadErr) throw uploadErr;

					const uploadedPath = data?.path ?? '';
					const { error: updateErr } = await supabase
						.from('stage_completion_cards')
						.update({ card_image_path: uploadedPath, updated_at: now })
						.eq('id', card.id);
					if (updateErr) throw updateErr;
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
						errors.push(`${getStageCompletionDisplayTitle(card)}: ${message}`);
				}
			}

			generatingProgress = { processed: targets.length, total: targets.length, current: '' };
			await loadCards();

			if (errors.length > 0) {
				alert(`Generated with ${errors.length} issue(s).\n` + errors.slice(0, 5).join('\n'));
			} else {
				alert('Generation complete.');
			}
		} catch (err) {
			alert(`Export failed: ${getErrorMessage(err)}`);
		} finally {
			generatingAll = false;
		}
	}
</script>

<PageLayout
	title="Stage Completion"
	subtitle="Manage stage completion cards for scenario decks"
	{tabs}
	{activeTab}
	onTabChange={(id) => (activeTab = id)}
>
	{#snippet headerActions()}
		<Button variant="secondary" onclick={() => (layoutEditorOpen = true)} disabled={loading}>Layout Editor</Button>
		<Button variant="secondary" onclick={generateAll} disabled={loading || generatingAll}>
			{generatingAll
				? `Generating… (${generatingProgress.processed}/${generatingProgress.total})`
				: 'Export All'}
		</Button>
		{#if activeTab === 'cards'}
			<Button variant="primary" onclick={openCreate} disabled={loading}>+ Card</Button>
		{/if}
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading…</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'cards'}
		<div class="controls">
			<input
				type="text"
				class="search"
				placeholder="Search cards…"
				bind:value={searchQuery}
			/>
					<select class="filter" bind:value={stageFilter}>
						<option value="all">All Stages</option>
						{#each stageCompletionStageOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
			<select class="filter" bind:value={scenarioFilter}>
				<option value="all">All Scenarios</option>
				{#each scenarios as s}
					<option value={s.id}>{s.name}</option>
				{/each}
			</select>
		</div>

		{#if filteredCardGroups.length === 0}
			<div class="empty">{cards.length === 0 ? 'No stage completion cards yet. Create one to get started.' : 'No cards match the current filters.'}</div>
		{:else}
			<div class="card-groups">
				{#each filteredCardGroups as group (group.id)}
					<section class="card-group">
						<h2 class="card-group__title">{group.name} ({group.cards.length})</h2>
						<div class="card-grid">
							{#each group.cards as card (card.id)}
								{@const cardImageUrl = getCardImageUrl(card)}
								{@const hasCardImage = !!card.card_image_path}

									<div class="sc-card">
										{#if hasCardImage && cardImageUrl}
											<div class="sc-card__preview">
												<img src={cardImageUrl} alt={card.title} loading="lazy" />
												<div class="sc-card__preview-badge">PNG</div>
											</div>
										{/if}
									<div class="sc-card__header">
										<div class="sc-card__pills">
											<span class={`pill pill--${card.stage}`}>{eventTypeLabel(card.stage)}</span>
											{#if card.scenario_id}
												<span class="pill pill--scenario">{scenarioMap.get(card.scenario_id) ?? '?'}</span>
											{/if}
										</div>
										<CardActionMenu onEdit={() => openEdit(card)} onDelete={() => deleteCard(card)} />
									</div>
									<h3 class="sc-card__title">{card.title}</h3>
									{#if card.complete_condition}
										<p class="sc-card__condition">{card.complete_condition}</p>
									{/if}
								</div>
							{/each}
							</div>
					</section>
				{/each}
			</div>
		{/if}
	{:else if activeTab === 'gallery'}
		<div class="gallery-container">
			<div class="gallery-controls">
				<input
					type="text"
					class="search"
					placeholder="Search cards…"
					bind:value={gallerySearchQuery}
				/>
					<select class="filter" bind:value={galleryStageFilter}>
						<option value="all">All Stages</option>
						{#each stageCompletionStageOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				<select class="filter" bind:value={galleryScenarioFilter}>
					<option value="all">All Scenarios</option>
					{#each scenarios as s}
						<option value={s.id}>{s.name}</option>
					{/each}
				</select>
				<select class="filter" bind:value={galleryStatusFilter}>
					<option value="all">All Status</option>
					<option value="generated">Generated</option>
					<option value="not-generated">Not Generated</option>
				</select>
			</div>

			{#if filteredGalleryGroups.length === 0}
				<div class="empty">No cards match the current filters.</div>
			{:else}
				<div class="card-groups">
					{#each filteredGalleryGroups as group (group.id)}
						<section class="card-group">
							<h2 class="card-group__title">{group.name} ({group.cards.length})</h2>
							<div class="gallery-grid">
								{#each group.cards as card (card.id)}
									{@const cardImageUrl = getCardImageUrl(card)}
									{@const baseImageUrl = getBaseImageUrl(card)}
									{@const hasCardImage = !!card.card_image_path}

									<div class="gallery-item">
										<div class="gallery-preview">
											{#if hasCardImage && cardImageUrl}
												<img src={cardImageUrl} alt={card.title} loading="lazy" />
												<div class="gallery-status generated">
													<span class="status-icon">✓</span>
												</div>
											{:else if baseImageUrl}
												<img src={baseImageUrl} alt={card.title} loading="lazy" />
											{:else}
												<div class="gallery-placeholder">
													<div class="placeholder-emoji">🏆</div>
													<span class="placeholder-text">{card.title}</span>
												</div>
											{/if}
										</div>

										<div class="gallery-info">
											<div class="gallery-header">
												<h3 class="gallery-name">{card.title}</h3>
													<span class="gallery-badge">{eventTypeLabel(card.stage)}</span>
												</div>
											<div class="gallery-footer">
												<span class="gallery-order">#{(card.order_num ?? 0) + 1}</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						</section>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</PageLayout>

{#if modalOpen}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close dialog"
		onclick={() => !modalSaving && (modalOpen = false)}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !modalSaving && (modalOpen = false)}
	>
		<div
			class="modal"
			role="dialog"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h3>{modalMode === 'create' ? 'Create Stage Completion Card' : 'Edit Stage Completion Card'}</h3>
			</div>
			<div class="modal-body">
				<FormField label="Scenario">
					<select class="form-select" bind:value={form.scenario_id}>
						<option value="">None</option>
						{#each scenarios as s}
							<option value={s.id}>{s.name}</option>
						{/each}
					</select>
				</FormField>
						<FormField label="Stage">
						<Select bind:value={form.stage} options={stageCompletionStageOptions} />
					</FormField>
				<FormField label="Title" required>
					<Input type="text" bind:value={form.title} required />
				</FormField>
				<FormField label="Complete Condition">
					<Textarea rows={3} bind:value={form.complete_condition} placeholder="e.g. Ends after the Stage Boss is defeated" />
				</FormField>
			</div>
			<div class="modal-footer">
				<Button variant="secondary" onclick={() => (modalOpen = false)} disabled={modalSaving}>Cancel</Button>
				<Button variant="primary" onclick={saveModal} disabled={modalSaving}>
					{modalSaving ? 'Saving…' : 'Save'}
				</Button>
			</div>
		</div>
	</div>
{/if}

{#if layoutEditorOpen}
		<StageCompletionCardLayoutConfigurator
			isOpen={true}
			{cards}
			{scenarios}
			onClose={() => (layoutEditorOpen = false)}
			onUpdated={loadCards}
		/>
{/if}

<style>
	.controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.search {
		flex: 1;
		max-width: 280px;
		padding: 0.4rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
		font-size: 0.85rem;
	}

	.card-groups {
		display: grid;
		gap: 1rem;
	}

	.card-group {
		display: grid;
		gap: 0.6rem;
	}

	.card-group__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		color: #e2e8f0;
	}

	.filter {
		padding: 0.4rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
		font-size: 0.85rem;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.65rem;
	}

	.sc-card {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.sc-card__preview {
		position: relative;
		width: 100%;
		aspect-ratio: 600 / 437;
		border-radius: 10px;
		overflow: hidden;
		background: rgba(15, 23, 42, 0.5);
	}

	.sc-card__preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 0.15rem;
		box-sizing: border-box;
		display: block;
	}

	.sc-card__preview-badge {
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		font-size: 0.65rem;
		font-weight: 800;
		padding: 0.1rem 0.4rem;
		border-radius: 999px;
		border: 1px solid rgba(34, 197, 94, 0.4);
		color: #bbf7d0;
		background: rgba(34, 197, 94, 0.15);
	}

	.sc-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.sc-card__pills {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.pill--scenario {
		background: rgba(99, 102, 241, 0.15);
		border-color: rgba(99, 102, 241, 0.3);
		color: #a5b4fc;
	}

	.form-select {
		width: 100%;
		padding: 0.45rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
		font-size: 0.85rem;
	}

	.sc-card__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		color: #e2e8f0;
	}

	.sc-card__condition {
		margin: 0;
		font-size: 0.85rem;
		color: rgba(226, 232, 240, 0.7);
		line-height: 1.35;
	}

	.pill {
		border-radius: 999px;
		padding: 0.18rem 0.45rem;
		font-size: 0.72rem;
		font-weight: 700;
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: rgba(226, 232, 240, 0.92);
		background: rgba(148, 163, 184, 0.12);
	}

	/* Gallery */

	.gallery-container {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.gallery-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.gallery-item {
		position: relative;
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		overflow: hidden;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.gallery-item:hover {
		border-color: rgba(148, 163, 184, 0.25);
		transform: translateY(-1px);
	}

	.gallery-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 600 / 437;
		background: rgba(15, 23, 42, 0.5);
		display: grid;
		place-items: center;
	}

	.gallery-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.gallery-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		text-align: center;
		color: #cbd5e1;
	}

	.placeholder-emoji {
		font-size: 2.25rem;
	}

	.placeholder-text {
		font-weight: 700;
		font-size: 0.9rem;
		color: #e2e8f0;
	}

	.gallery-status {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 22px;
		height: 22px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-size: 0.75rem;
		font-weight: 900;
	}

	.gallery-status.generated {
		background: rgba(34, 197, 94, 0.18);
		border: 1px solid rgba(34, 197, 94, 0.35);
		color: #bbf7d0;
	}

	.gallery-info {
		padding: 0.65rem 0.75rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.gallery-header {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: center;
	}

	.gallery-name {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 800;
		color: #f8fafc;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gallery-badge {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #cbd5e1;
		white-space: nowrap;
	}

	.gallery-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.gallery-order {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	/* Modal */

	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.25rem;
		z-index: 1000;
	}

	.modal {
		width: min(560px, 100%);
		background: rgba(15, 23, 42, 0.98);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 14px;
		max-height: calc(100vh - 2.5rem);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		padding: 0.85rem 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.modal-body {
		padding: 0.9rem 1rem;
		display: grid;
		gap: 0.75rem;
		overflow: auto;
		min-height: 0;
	}

	.modal-footer {
		padding: 0.85rem 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
