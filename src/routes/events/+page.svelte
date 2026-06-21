<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { EventCardRow, RewardRow, StageEventCardRow } from '$lib/types/gameData';
	import { DEFAULT_EVENT_TYPE, EVENT_TYPE_OPTIONS, eventTypeLabel, type EventType } from '$lib/types/eventTypes';
	import { getErrorMessage } from '$lib/utils';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import EventCardLayoutConfigurator from '$lib/components/events/EventCardLayoutConfigurator.svelte';
	import RewardRowsEditor from '$lib/components/monsters/RewardRowsEditor.svelte';
	import { generateEventCardPNG } from '$lib/generators/cards';
	import { processAndUploadImage, publicAssetUrl } from '$lib/utils/storage';

	type EventCard = Pick<
		EventCardRow,
		'id' | 'internal_name' | 'stage' | 'title' | 'description' | 'reward_rows' | 'image_path' | 'card_image_path' | 'data' | 'order_num' | 'updated_at'
	> & {
		scenario_id: string | null;
	};

	type ScenarioSummary = {
		id: string;
		name: string;
		display_name: string | null;
	};

	type EventDeckLinkSummary = {
		id: string;
		scenario_id: string;
		order_num: number;
		entry_stage: EventType | null;
	};

	type ScenarioEventGroup = {
		id: string;
		name: string;
		events: EventCard[];
	};

	const tabs: Tab[] = [
		{ id: 'cards', label: 'Cards', icon: '📋' },
		{ id: 'gallery', label: 'Gallery', icon: '🖼️' }
	];
	let activeTab = $state('cards');

	let events = $state<EventCard[]>([]);
	let scenarios = $state<ScenarioSummary[]>([]);
	let eventDeckLinksByEventId = $state<Record<string, EventDeckLinkSummary>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	const scenarioOptions = $derived(
		scenarios.map((scenario) => ({
			value: scenario.id,
			label: scenario.display_name ?? scenario.name
		}))
	);
	const scenarioNameById = $derived.by(() => {
		const map: Record<string, string> = {};
		for (const scenario of scenarios) {
			map[scenario.id] = scenario.display_name ?? scenario.name;
		}
		return map;
	});

	// Cards tab filters
	let searchQuery = $state('');
	let stageFilter = $state<EventType | 'all'>('all');

	const filteredEvents = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		return events.filter((ev) => {
			if (stageFilter !== 'all' && ev.stage !== stageFilter) return false;
			if (!term) return true;
			return (ev.title ?? '').toLowerCase().includes(term) || (ev.internal_name ?? '').toLowerCase().includes(term);
		});
	});

	const filteredEventGroups = $derived.by(() => {
		const unassignedGroup: ScenarioEventGroup = {
			id: '__unassigned',
			name: 'Unassigned',
			events: []
		};
		const groupsById: Record<string, ScenarioEventGroup> = {};
		for (const scenario of scenarios) {
			groupsById[scenario.id] = {
				id: scenario.id,
				name: scenario.display_name ?? scenario.name,
				events: []
			};
		}

		for (const ev of filteredEvents) {
			const target = ev.scenario_id ? groupsById[ev.scenario_id] : undefined;
			if (target) {
				target.events.push(ev);
			} else {
				unassignedGroup.events.push(ev);
			}
		}

		const grouped: ScenarioEventGroup[] = [];
		for (const scenario of scenarios) {
			const group = groupsById[scenario.id];
			if (group?.events.length) {
				grouped.push(group);
			}
		}
		if (unassignedGroup.events.length) {
			grouped.push(unassignedGroup);
		}
		return grouped;
	});

	// Gallery tab filters
	let gallerySearchQuery = $state('');
	let galleryStageFilter = $state<EventType | 'all'>('all');
	let galleryStatusFilter = $state<'all' | 'generated' | 'not-generated'>('all');

	const filteredGalleryEvents = $derived.by(() => {
		const term = gallerySearchQuery.trim().toLowerCase();
		return events
			.filter((ev) => {
				if (galleryStageFilter !== 'all' && ev.stage !== galleryStageFilter) return false;
				if (galleryStatusFilter === 'generated' && !ev.card_image_path) return false;
				if (galleryStatusFilter === 'not-generated' && ev.card_image_path) return false;
				if (!term) return true;
				return (ev.title ?? '').toLowerCase().includes(term) || (ev.internal_name ?? '').toLowerCase().includes(term);
			})
			.sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999));
	});

	// Modal state
	let modalOpen = $state(false);
	let modalSaving = $state(false);
	let modalMode = $state<'create' | 'edit'>('create');
	let modalEventId = $state<string | null>(null);
	let form = $state({
		stage: DEFAULT_EVENT_TYPE as EventType,
		title: '',
		description: '',
		reward_rows: [{ type: 'all_players', icon_ids: [] }] as RewardRow[],
		scenario_id: ''
	});

	// Layout editor state
	let layoutEditorOpen = $state(false);

	// Export state
	let exporting = $state(false);
	let exportProgress = $state('');

	onMount(() => {
		void loadEvents();
	});

	async function getNextEventDeckOrderNum(scenarioId: string): Promise<number> {
		const { data, error } = await supabase
			.from('scenario_deck_entries')
			.select('order_num')
			.eq('kind', 'event')
			.eq('scenario_id', scenarioId)
			.order('order_num', { ascending: false })
			.limit(1);
		if (error) throw error;
		const last = data?.[0]?.order_num;
		return typeof last === 'number' ? last + 1 : 0;
	}

	function buildEventDeckEntryPayload(eventId: string, scenarioId: string, stage: EventType, order_num: number) {
		return {
			scenario_id: scenarioId,
			kind: 'event',
			order_num,
			quantity: 1,
			entry_stage: stage,
			data: {},
			event_id: eventId
		};
	}

	async function loadEvents() {
		loading = true;
		error = null;
		try {
			const [eventsRes, scenariosRes, linksRes] = await Promise.all([
				supabase
					.from('event_cards')
					.select('id, internal_name, stage, title, description, reward_rows, image_path, card_image_path, data, order_num, updated_at')
					.order('order_num')
					.order('title'),
				supabase.from('scenarios').select('id, name, display_name').order('name', { ascending: true }),
				supabase
					.from('scenario_deck_entries')
					.select('id, scenario_id, event_id, order_num, entry_stage')
					.eq('kind', 'event')
			]);
			if (eventsRes.error) throw eventsRes.error;
			if (scenariosRes.error) throw scenariosRes.error;
			if (linksRes.error) throw linksRes.error;

			const linksByEventId = (linksRes.data ?? []).reduce((acc, row) => {
				if (!row.event_id || acc[row.event_id]) return acc;
				acc[row.event_id] = {
					id: row.id,
					scenario_id: row.scenario_id,
					order_num: row.order_num ?? 0,
					entry_stage: (row.entry_stage as EventType) ?? null
				};
				return acc;
			}, {} as Record<string, EventDeckLinkSummary>);

			scenarios = scenariosRes.data ?? [];
			eventDeckLinksByEventId = linksByEventId;
			events = (eventsRes.data ?? []).map((eventRow) => ({
				...(eventRow as EventCard),
				scenario_id: linksByEventId[eventRow.id]?.scenario_id ?? null
			}));
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function openCreate() {
		modalMode = 'create';
		modalEventId = null;
		form = {
			stage: DEFAULT_EVENT_TYPE,
			title: '',
			description: '',
			reward_rows: [{ type: 'all_players', icon_ids: [] }],
			scenario_id: scenarios[0]?.id ?? ''
		};
		modalOpen = true;
	}

	function openEdit(ev: EventCard) {
		modalMode = 'edit';
		modalEventId = ev.id;
		form = {
			stage: ev.stage ?? DEFAULT_EVENT_TYPE,
			title: ev.title ?? '',
			description: ev.description ?? '',
			reward_rows: Array.isArray(ev.reward_rows) ? JSON.parse(JSON.stringify(ev.reward_rows)) as RewardRow[] : [{ type: 'all_players', icon_ids: [] }],
			scenario_id: eventDeckLinksByEventId[ev.id]?.scenario_id ?? scenarios[0]?.id ?? ''
		};
		modalOpen = true;
	}

	async function saveModal() {
		if (modalSaving) return;
		const title = form.title.trim();
		const scenarioId = form.scenario_id.trim();
		if (!title) {
			alert('Event title is required.');
			return;
		}
		if (!scenarioId) {
			alert('Scenario is required.');
			return;
		}

		modalSaving = true;
		try {
			const now = new Date().toISOString();
			const currentEventScenario = modalEventId ? eventDeckLinksByEventId[modalEventId] : null;
			const baseOrderNum = currentEventScenario?.scenario_id === scenarioId ? currentEventScenario.order_num : await getNextEventDeckOrderNum(scenarioId);

			if (modalMode === 'create') {
				const id = crypto.randomUUID();
				const { error: insertErr } = await supabase.from('event_cards').insert({
					id,
					internal_name: id,
					stage: form.stage,
					title,
					description: form.description.trim() || null,
					reward_rows: form.reward_rows,
					image_path: null,
					card_image_path: null,
					data: {},
					order_num: events.length,
					updated_at: now
				});
				if (insertErr) throw insertErr;

				const { error: deckErr } = await supabase.from('scenario_deck_entries').insert(
					buildEventDeckEntryPayload(id, scenarioId, form.stage, baseOrderNum)
				);
				if (deckErr) {
					await supabase.from('event_cards').delete().eq('id', id);
					throw deckErr;
				}
			} else if (modalMode === 'edit' && modalEventId) {
				const id = modalEventId;
				const { error: updateErr } = await supabase
					.from('event_cards')
					.update({
						stage: form.stage,
						title,
						description: form.description.trim() || null,
						reward_rows: form.reward_rows,
						updated_at: now
					})
					.eq('id', modalEventId);
				if (updateErr) throw updateErr;

				if (!currentEventScenario || currentEventScenario.scenario_id !== scenarioId) {
					const { error: deleteErr } = await supabase
						.from('scenario_deck_entries')
						.delete()
						.eq('kind', 'event')
						.eq('event_id', id);
					if (deleteErr) throw deleteErr;

					const { error: createErr } = await supabase.from('scenario_deck_entries').insert(
						buildEventDeckEntryPayload(id, scenarioId, form.stage, baseOrderNum)
					);
					if (createErr) {
						if (currentEventScenario) {
							await supabase.from('scenario_deck_entries').insert(
								buildEventDeckEntryPayload(
									id,
									currentEventScenario.scenario_id,
									currentEventScenario.entry_stage ?? DEFAULT_EVENT_TYPE,
									currentEventScenario.order_num
								)
							);
						}
						throw createErr;
					}
				} else if (currentEventScenario && currentEventScenario.entry_stage !== form.stage) {
					const { error: updateDeckErr } = await supabase
						.from('scenario_deck_entries')
						.update({ entry_stage: form.stage })
						.eq('id', currentEventScenario.id);
					if (updateDeckErr) throw updateDeckErr;
				}
			}

			modalOpen = false;
			modalEventId = null;
			await loadEvents();
		} catch (err) {
			alert(`Failed to save event: ${getErrorMessage(err)}`);
		} finally {
			modalSaving = false;
		}
	}

	async function deleteEvent(ev: EventCard) {
		if (!confirm(`Delete event "${ev.title}"? This will also remove it from any scenario decks.`)) return;
		try {
			const { error: deckErr } = await supabase
				.from('scenario_deck_entries')
				.delete()
				.eq('kind', 'event')
				.eq('event_id', ev.id);
			if (deckErr) throw deckErr;

			const { error: delErr } = await supabase.from('event_cards').delete().eq('id', ev.id);
			if (delErr) throw delErr;
			await loadEvents();
		} catch (err) {
			alert(`Failed to delete event: ${getErrorMessage(err)}`);
		}
	}

	function toStageEventCardRow(ev: EventCard): StageEventCardRow {
		return {
			id: ev.id,
			name: ev.internal_name ?? ev.id,
			card_kind: 'event',
			stage: ev.stage,
			title: ev.title,
			description: ev.description ?? null,
			image_path: ev.image_path ?? null,
			card_image_path: ev.card_image_path ?? null,
			order_num: ev.order_num ?? 0,
			created_at: null,
			updated_at: ev.updated_at ?? null,
				data: ev.data ?? {},
				reward_rows: Array.isArray(ev.reward_rows) ? ev.reward_rows as RewardRow[] : [],
				game_location_id: null
			};
		}

	async function exportAllCards() {
		if (exporting) return;
		const target = activeTab === 'gallery' ? filteredGalleryEvents : filteredEvents;
		if (target.length === 0) return;
		if (!confirm(`Generate card images for ${target.length} event(s)?`)) return;

		exporting = true;
		let successCount = 0;
		let failCount = 0;

		for (let i = 0; i < target.length; i++) {
			const ev = target[i];
			exportProgress = `Generating ${i + 1}/${target.length}: ${ev.title}...`;
			try {
				// Delete previous export file if it exists at a different path
				if (ev.card_image_path) {
					await supabase.storage.from('game_assets').remove([ev.card_image_path]);
				}

				const row = toStageEventCardRow(ev);
				const blob = await generateEventCardPNG(row);

				const { data, error: uploadErr } = await processAndUploadImage(blob, {
					folder: 'card_images/events/export',
					filename: ev.id,
					cropTransparent: false,
					upsert: true
				});
				if (uploadErr) throw uploadErr;

				const uploadedPath = data?.path ?? '';
				const { error: updateErr } = await supabase
					.from('event_cards')
					.update({ card_image_path: uploadedPath, updated_at: new Date().toISOString() })
					.eq('id', ev.id);
				if (updateErr) throw updateErr;

				ev.card_image_path = uploadedPath;
				ev.updated_at = new Date().toISOString();
				successCount++;
			} catch (err) {
				console.error(`Failed to export "${ev.title}":`, err);
				failCount++;
			}
		}

		events = [...events];
		exportProgress = failCount > 0
			? `Done: ${successCount} exported, ${failCount} failed`
			: `Done: ${successCount} card(s) exported`;
		exporting = false;

		setTimeout(() => { exportProgress = ''; }, 5000);
	}

	function getCardImageUrl(ev: EventCard): string | null {
		return publicAssetUrl(ev.card_image_path, { updatedAt: ev.updated_at ?? undefined });
	}

	function getBaseImageUrl(ev: EventCard): string | null {
		return publicAssetUrl(ev.image_path, { updatedAt: ev.updated_at ?? undefined });
	}
</script>

<PageLayout
	title="Events"
	subtitle="Manage event cards used in scenario stage decks"
	{tabs}
	{activeTab}
	onTabChange={(id) => (activeTab = id)}
>
	{#snippet headerActions()}
		<Button variant="secondary" onclick={() => (layoutEditorOpen = true)} disabled={loading}>Layout Editor</Button>
		<Button variant="secondary" onclick={exportAllCards} disabled={loading || exporting}>
			{exporting ? 'Exporting...' : 'Export All Cards'}
		</Button>
		{#if activeTab === 'cards'}
			<Button variant="primary" onclick={openCreate} disabled={loading}>+ Event</Button>
		{/if}
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading…</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'cards'}
		{#if exportProgress}
			<div class="export-progress">{exportProgress}</div>
		{/if}

		<div class="controls">
			<input
				type="text"
				class="search"
				placeholder="Search events…"
				bind:value={searchQuery}
			/>
			<select class="filter" bind:value={stageFilter}>
				<option value="all">All Stages</option>
				{#each EVENT_TYPE_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		{#if filteredEvents.length === 0}
			<div class="empty">{events.length === 0 ? 'No events yet. Create one to get started.' : 'No events match the current filters.'}</div>
		{:else}
			<div class="event-groups">
				{#each filteredEventGroups as group (group.id)}
					<section class="event-group">
						<h2 class="event-group__title">
							{group.name} ({group.events.length})
						</h2>
						<div class="event-grid">
						{#each group.events as ev (ev.id)}
							{@const cardImageUrl = getCardImageUrl(ev)}
							{@const hasCardImage = !!ev.card_image_path}

								<div class="event-card">
									{#if hasCardImage && cardImageUrl}
										<div class="event-card__preview">
											<img src={cardImageUrl} alt={ev.title} loading="lazy" />
											<div class="event-card__preview-badge">PNG</div>
										</div>
									{/if}
									<div class="event-card__header">
										<span class={`pill pill--${ev.stage}`}>{eventTypeLabel(ev.stage)}</span>
										<CardActionMenu onEdit={() => openEdit(ev)} onDelete={() => deleteEvent(ev)} />
									</div>
									<h3 class="event-card__title">{ev.title}</h3>
									{#if ev.description}
										<p class="event-card__desc">{ev.description}</p>
									{/if}
									<div class="event-card__meta">
										{#if ev.scenario_id}
											<span class="event-card__scenario">
												Scenario: {scenarioNameById[ev.scenario_id] ?? 'Unknown scenario'}
											</span>
										{:else}
											<span class="event-card__scenario event-card__scenario--missing">No scenario assigned</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	{:else if activeTab === 'gallery'}
		<div class="gallery-container">
			{#if exportProgress}
				<div class="export-progress">{exportProgress}</div>
			{/if}

			<div class="gallery-controls">
				<input
					type="text"
					class="search"
					placeholder="Search events…"
					bind:value={gallerySearchQuery}
				/>
				<select class="filter" bind:value={galleryStageFilter}>
					<option value="all">All Stages</option>
					{#each EVENT_TYPE_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
				<select class="filter" bind:value={galleryStatusFilter}>
					<option value="all">All Status</option>
					<option value="generated">Generated</option>
					<option value="not-generated">Not Generated</option>
				</select>
			</div>

			{#if filteredGalleryEvents.length === 0}
				<div class="empty">No events match the current filters.</div>
			{:else}
				<div class="gallery-grid">
					{#each filteredGalleryEvents as ev (ev.id)}
						{@const cardImageUrl = getCardImageUrl(ev)}
						{@const baseImageUrl = getBaseImageUrl(ev)}
						{@const hasCardImage = !!ev.card_image_path}

						<div class="gallery-item">
							<div class="gallery-preview">
								{#if hasCardImage && cardImageUrl}
									<img src={cardImageUrl} alt={ev.title} loading="lazy" />
									<div class="gallery-status generated">
										<span class="status-icon">✓</span>
									</div>
								{:else if baseImageUrl}
									<img src={baseImageUrl} alt={ev.title} loading="lazy" />
								{:else}
									<div class="gallery-placeholder">
										<div class="placeholder-emoji">🎴</div>
										<span class="placeholder-text">{ev.title}</span>
									</div>
								{/if}
							</div>

							<div class="gallery-info">
								<div class="gallery-header">
									<h3 class="gallery-name">{ev.title}</h3>
									<span class="gallery-badge">{eventTypeLabel(ev.stage)}</span>
								</div>
								<div class="gallery-footer">
									<span class="gallery-order">#{(ev.order_num ?? 0) + 1}</span>
								</div>
							</div>
						</div>
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
				<h3>{modalMode === 'create' ? 'Create Event' : 'Edit Event'}</h3>
			</div>
			<div class="modal-body">
				<FormField label="Stage">
					<Select bind:value={form.stage} options={EVENT_TYPE_OPTIONS} />
				</FormField>
				<FormField label="Title" required>
					<Input type="text" bind:value={form.title} required />
				</FormField>
				<FormField label="Description">
					<Textarea rows={3} bind:value={form.description} />
				</FormField>
				<FormField label="Scenario" required>
					<Select
						bind:value={form.scenario_id}
						options={scenarioOptions}
						placeholder="Select a scenario"
						required
						disabled={scenarioOptions.length === 0}
					/>
				</FormField>
				<RewardRowsEditor bind:rewardRows={form.reward_rows} defaultType="all_players" />
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
	<EventCardLayoutConfigurator
		isOpen={true}
		{events}
		onClose={() => (layoutEditorOpen = false)}
		onUpdated={loadEvents}
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

	.filter {
		padding: 0.4rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
		font-size: 0.85rem;
	}

	.export-progress {
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.75rem;
		border-radius: 10px;
		border: 1px solid rgba(56, 189, 248, 0.25);
		background: rgba(56, 189, 248, 0.08);
		color: rgba(186, 230, 253, 0.95);
		font-size: 0.85rem;
	}

	.event-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.65rem;
	}

	.event-groups {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.event-group {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.event-group__title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 800;
		color: rgba(226, 232, 240, 0.9);
		letter-spacing: 0.02em;
	}

	.event-card {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.event-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.event-card__preview {
		position: relative;
		width: 100%;
		aspect-ratio: 600 / 437;
		border-radius: 10px;
		overflow: hidden;
		background: rgba(15, 23, 42, 0.5);
	}

	.event-card__preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 0.15rem;
		box-sizing: border-box;
		display: block;
	}

	.event-card__preview-badge {
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

	.event-card__title {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		color: #e2e8f0;
	}

	.event-card__desc {
		margin: 0;
		font-size: 0.85rem;
		color: rgba(226, 232, 240, 0.7);
		line-height: 1.35;
	}

	.event-card__meta {
		margin-top: auto;
		padding-top: 0.25rem;
	}

	.event-card__scenario {
		display: inline-block;
		margin-top: 0.15rem;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
		font-size: 0.68rem;
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: rgba(226, 232, 240, 0.85);
		background: rgba(148, 163, 184, 0.12);
	}

	.event-card__scenario--missing {
		border-color: rgba(248, 113, 113, 0.35);
		color: rgba(254, 226, 226, 0.95);
		background: rgba(248, 113, 113, 0.12);
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
		width: min(720px, 100%);
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
