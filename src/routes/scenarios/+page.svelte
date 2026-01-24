<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/api/supabaseClient';
	import type {
		EditionRow,
		EventCardRow,
		GameLocationRow,
		MonsterRow,
		ScenarioDeckEntryKind,
		ScenarioDeckEntryRow,
		ScenarioRow,
		TravelerRow
	} from '$lib/types/gameData';
	import { DEFAULT_EVENT_TYPE, EVENT_TYPE_OPTIONS, eventTypeLabel, type EventType } from '$lib/types/eventTypes';
	import {
		DEFAULT_STAGE_EVENT_RENDER_STYLE,
		DEFAULT_STAGE_LOCATION_RENDER_STYLE,
		STAGE_EVENT_RENDER_STYLE_OPTIONS,
		STAGE_LOCATION_RENDER_STYLE_OPTIONS,
		setStageCardRenderStyleInData,
		getStageCardRenderStyle,
		type StageEventRenderStyle,
		type StageLocationRenderStyle
	} from '$lib/types/stageCardStyles';
	import { getErrorMessage } from '$lib/utils';
	import { getMonsterStageLabel } from '$lib/utils/monsterStageLabels';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import ImageUploader from '$lib/components/shared/ImageUploader.svelte';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import ScenarioDeckCardPreview from '$lib/components/scenarios/ScenarioDeckCardPreview.svelte';

	type EditionOption = Pick<EditionRow, 'id' | 'name' | 'is_default'>;
	type ScenarioOption = Pick<
		ScenarioRow,
		'id' | 'name' | 'display_name' | 'description' | 'game_location_ids' | 'display_image_path' | 'order_num'
	>;

	type MonsterCatalogEntry = Pick<MonsterRow, 'id' | 'name' | 'stage' | 'card_image_path' | 'updated_at'>;
	type GameLocationCatalogEntry = Pick<
		GameLocationRow,
		'id' | 'name' | 'background_image_path' | 'updated_at' | 'reward_rows'
	>;
	type TravelerCatalogEntry = Pick<
		TravelerRow,
		'id' | 'name' | 'state' | 'image_path' | 'card_image_path' | 'updated_at' | 'traveler_description'
	>;
	type EventCatalogEntry = Pick<
		EventCardRow,
		'id' | 'internal_name' | 'stage' | 'title' | 'description' | 'stage_completion' | 'reward_rows' | 'image_path' | 'card_image_path' | 'data' | 'updated_at'
	>;

	type DeckItem = {
		entry: ScenarioDeckEntryRow;
		monster?: MonsterCatalogEntry | null;
		location?: GameLocationCatalogEntry | null;
		traveler?: TravelerCatalogEntry | null;
		event?: EventCatalogEntry | null;
		label: string;
	};

	const tabs: Tab[] = [
		{ id: 'manage', label: 'Manage', icon: '🎭' },
		{ id: 'cards', label: 'Cards', icon: '🖼️' }
	];
	let activeTab = $state('manage');

	const STORAGE_EDITION_KEY = 'arc-spirits-rev2:selected_scenario_edition_id';
	const STORAGE_SCENARIO_KEY = 'arc-spirits-rev2:selected_scenario_id';

	let editions = $state<EditionOption[]>([]);
	let selectedEditionId = $state('');
	let selectedEditionIdSelect = $state('');

	let scenarios = $state<ScenarioOption[]>([]);
	let selectedScenarioId = $state('');

	let deckEntries = $state<ScenarioDeckEntryRow[]>([]);

	let monsters = $state<MonsterCatalogEntry[]>([]);
	let gameLocations = $state<GameLocationCatalogEntry[]>([]);
	let travelers = $state<TravelerCatalogEntry[]>([]);
	let events = $state<EventCatalogEntry[]>([]);

	let loading = $state(true);
	let error = $state<string | null>(null);

	// Add controls
	let monsterToAddId = $state('');
	let monsterToAddQuantity = $state<number>(1);
	let addingMonster = $state(false);

	let locationToAddId = $state('');
	let locationEntryStage = $state<EventType>(DEFAULT_EVENT_TYPE);
	let locationRenderStyle = $state<StageLocationRenderStyle>(DEFAULT_STAGE_LOCATION_RENDER_STYLE);
	let addingLocation = $state(false);

	let travelerToAddId = $state('');
	let travelerEntryStage = $state<EventType>(DEFAULT_EVENT_TYPE);
	let addingTraveler = $state(false);

	let eventToAddId = $state('');
	let addingEvent = $state(false);

	// Scenario create/edit modal
	let scenarioModalOpen = $state(false);
	let scenarioModalSaving = $state(false);
	let scenarioModalMode = $state<'create' | 'edit'>('create');
	let scenarioModalId = $state<string | null>(null);
	let scenarioModalPersisted = $state(false);
	let scenarioNameDraft = $state('');
	let scenarioDisplayNameDraft = $state('');
	let scenarioDescriptionDraft = $state('');
	let scenarioGameLocationIdsDraft = $state<string[]>([]);
	let scenarioDisplayImagePathDraft = $state<string | null>(null);
	let scenarioLocationSearchDraft = $state('');

	// Create/edit event modal
	let eventModalOpen = $state(false);
	let eventModalSaving = $state(false);
	let eventModalMode = $state<'create' | 'edit'>('create');
	let eventModalEventId = $state<string | null>(null);
	let eventForm = $state({
		stage: DEFAULT_EVENT_TYPE as EventType,
		render_style: DEFAULT_STAGE_EVENT_RENDER_STYLE as StageEventRenderStyle,
		title: '',
		description: '',
		stage_completion: '' as string
	});

	// Cards tab filters
	let deckSearchQuery = $state('');
	let deckKindFilter = $state<ScenarioDeckEntryKind | 'all'>('all');

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	function getStored(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}

	function setStored(key: string, value: string | null) {
		try {
			if (value) localStorage.setItem(key, value);
			else localStorage.removeItem(key);
		} catch {
			// ignore
		}
	}

	const editionOptions = $derived.by(() => editions.map((e) => ({ value: e.id, label: e.name })));

	const selectedScenario = $derived.by(() => scenarios.find((s) => s.id === selectedScenarioId) ?? null);

	const monstersById = $derived.by(() => new Map(monsters.map((m) => [m.id, m])));
	const locationsById = $derived.by(() => new Map(gameLocations.map((l) => [l.id, l])));
	const travelersById = $derived.by(() => new Map(travelers.map((t) => [t.id, t])));
	const eventsById = $derived.by(() => new Map(events.map((e) => [e.id, e])));

	const deckItems = $derived.by<DeckItem[]>(() => {
		const ordered = [...deckEntries].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
		return ordered.map((entry) => {
			switch (entry.kind) {
				case 'monster': {
					const monster = entry.monster_id ? monstersById.get(entry.monster_id) ?? null : null;
					return { entry, monster, label: monster?.name ?? 'Unknown Monster' };
				}
				case 'location': {
					const location = entry.game_location_id ? locationsById.get(entry.game_location_id) ?? null : null;
					return { entry, location, label: location?.name ?? 'Unknown Location' };
				}
				case 'traveler': {
					const traveler = entry.traveler_id ? travelersById.get(entry.traveler_id) ?? null : null;
					return { entry, traveler, label: traveler?.name ?? 'Unknown Traveler' };
				}
				case 'event': {
					const event = entry.event_id ? eventsById.get(entry.event_id) ?? null : null;
					return { entry, event, label: event?.title ?? 'Unknown Event' };
				}
				default:
					return { entry, label: 'Unknown' };
			}
		});
	});

	const filteredDeckItems = $derived.by(() => {
		const term = deckSearchQuery.trim().toLowerCase();
		return deckItems.filter((item) => {
			if (deckKindFilter !== 'all' && item.entry.kind !== deckKindFilter) return false;
			if (!term) return true;
			return item.label.toLowerCase().includes(term);
		});
	});

	const includedMonsterIds = $derived.by(() => new Set(deckEntries.filter((e) => e.kind === 'monster').map((e) => e.monster_id ?? '')));
	const availableMonsterOptions = $derived.by(() =>
		monsters
			.filter((m) => !includedMonsterIds.has(m.id))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
			.map((m) => ({ value: m.id, label: m.name }))
	);

	const includedLocationIds = $derived.by(() => new Set(deckEntries.filter((e) => e.kind === 'location').map((e) => e.game_location_id ?? '')));
	const availableLocationOptions = $derived.by(() =>
		gameLocations
			.filter((l) => !includedLocationIds.has(l.id))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
			.map((l) => ({ value: l.id, label: l.name }))
	);

	const includedTravelerIds = $derived.by(() => new Set(deckEntries.filter((e) => e.kind === 'traveler').map((e) => e.traveler_id ?? '')));
	const availableTravelerOptions = $derived.by(() =>
		travelers
			.filter((t) => !includedTravelerIds.has(t.id))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
			.map((t) => ({ value: t.id, label: t.name }))
	);

	const includedEventIds = $derived.by(() => new Set(deckEntries.filter((e) => e.kind === 'event').map((e) => e.event_id ?? '')));
	const availableEventOptions = $derived.by(() =>
		events
			.filter((ev) => !includedEventIds.has(ev.id))
			.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }))
			.map((ev) => ({ value: ev.id, label: ev.title }))
	);

	onMount(() => {
		void loadData();
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			const [
				{ data: editionsData, error: editionsErr },
				{ data: monstersData, error: monstersErr },
				{ data: locationsData, error: locationsErr },
				{ data: travelersData, error: travelersErr },
				{ data: eventsData, error: eventsErr }
			] = await Promise.all([
				supabase.from('editions').select('id, name, is_default').order('name', { ascending: true }),
				supabase.from('monsters').select('id, name, stage, card_image_path, updated_at').order('name', { ascending: true }),
				supabase
					.from('game_locations')
					.select('id, name, background_image_path, updated_at, reward_rows')
					.order('name', { ascending: true }),
				supabase
					.from('travelers')
					.select('id, name, state, image_path, card_image_path, updated_at, traveler_description')
					.order('name', { ascending: true }),
				supabase
					.from('event_cards')
					.select('id, internal_name, stage, title, description, stage_completion, reward_rows, image_path, card_image_path, data, updated_at')
					.order('order_num')
					.order('title')
			]);

			if (editionsErr) throw editionsErr;
			if (monstersErr) throw monstersErr;
			if (locationsErr) throw locationsErr;
			if (travelersErr) throw travelersErr;
			if (eventsErr) throw eventsErr;

			editions = (editionsData ?? []) as EditionOption[];
			monsters = (monstersData ?? []) as MonsterCatalogEntry[];
			gameLocations = (locationsData ?? []) as GameLocationCatalogEntry[];
			travelers = (travelersData ?? []) as TravelerCatalogEntry[];
			events = (eventsData ?? []) as EventCatalogEntry[];

			const storedEditionId = getStored(STORAGE_EDITION_KEY);
			const defaultEditionId = editions.find((e) => e.is_default)?.id ?? editions[0]?.id ?? '';
			selectedEditionId =
				storedEditionId && editions.some((e) => e.id === storedEditionId) ? storedEditionId : defaultEditionId;
			selectedEditionIdSelect = selectedEditionId;

			await loadScenarios();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadScenarios() {
		if (!selectedEditionId) {
			scenarios = [];
			selectedScenarioId = '';
			deckEntries = [];
			return;
		}

		const { data, error: scenariosErr } = await supabase
			.from('scenarios')
			.select('id, name, display_name, description, game_location_ids, display_image_path, order_num')
			.eq('edition_id', selectedEditionId)
			.order('order_num', { ascending: true });
		if (scenariosErr) throw scenariosErr;

		scenarios = (data ?? []) as ScenarioOption[];
		const storedScenarioId = getStored(STORAGE_SCENARIO_KEY);
		const fallbackScenarioId = scenarios[0]?.id ?? '';
		selectedScenarioId =
			storedScenarioId && scenarios.some((s) => s.id === storedScenarioId) ? storedScenarioId : fallbackScenarioId;
		setStored(STORAGE_SCENARIO_KEY, selectedScenarioId || null);

		await loadScenarioDeck();
	}

	async function loadScenarioDeck() {
		if (!selectedScenarioId) {
			deckEntries = [];
			return;
		}

		const { data, error: deckErr } = await supabase
			.from('scenario_deck_entries')
			.select('*')
			.eq('scenario_id', selectedScenarioId)
			.order('order_num', { ascending: true });
		if (deckErr) throw deckErr;
		deckEntries = (data ?? []) as ScenarioDeckEntryRow[];
	}

	function requestEditionChange(nextRaw: string) {
		const next = (nextRaw ?? '').trim();
		if (next === selectedEditionId) return;
		if (!editions.some((e) => e.id === next)) {
			selectedEditionIdSelect = selectedEditionId;
			return;
		}

		selectedEditionId = next;
		selectedEditionIdSelect = next;
		setStored(STORAGE_EDITION_KEY, next);
		setStored(STORAGE_SCENARIO_KEY, null);
		void loadScenarios();
	}

	function selectScenario(scenarioId: string) {
		if (scenarioId === selectedScenarioId) return;
		if (!scenarios.some((s) => s.id === scenarioId)) return;
		selectedScenarioId = scenarioId;
		setStored(STORAGE_SCENARIO_KEY, scenarioId);
		void loadScenarioDeck();
	}

	function openCreateGameLocation() {
		goto('/game-locations?create=1');
	}

	function openCreateScenario() {
		if (!selectedEditionId) return;
		scenarioModalMode = 'create';
		scenarioModalId = crypto.randomUUID();
		scenarioModalPersisted = false;
		scenarioNameDraft = '';
		scenarioDisplayNameDraft = '';
		scenarioDescriptionDraft = '';
		scenarioGameLocationIdsDraft = [];
		scenarioDisplayImagePathDraft = null;
		scenarioLocationSearchDraft = '';
		scenarioModalOpen = true;
	}

	function openEditScenario(scenario: ScenarioOption) {
		scenarioModalMode = 'edit';
		scenarioModalId = scenario.id;
		scenarioModalPersisted = true;
		scenarioNameDraft = scenario.name ?? '';
		scenarioDisplayNameDraft = scenario.display_name ?? '';
		scenarioDescriptionDraft = scenario.description ?? '';
		scenarioGameLocationIdsDraft = Array.isArray(scenario.game_location_ids) ? [...scenario.game_location_ids] : [];
		scenarioDisplayImagePathDraft = scenario.display_image_path ?? null;
		scenarioLocationSearchDraft = '';
		scenarioModalOpen = true;
	}

	function toggleScenarioGameLocation(locationId: string) {
		if (scenarioGameLocationIdsDraft.includes(locationId)) {
			scenarioGameLocationIdsDraft = scenarioGameLocationIdsDraft.filter((id) => id !== locationId);
		} else {
			scenarioGameLocationIdsDraft = [...scenarioGameLocationIdsDraft, locationId];
		}
	}

	const filteredScenarioLocationOptions = $derived.by(() => {
		const term = scenarioLocationSearchDraft.trim().toLowerCase();
		if (!term) return gameLocations;
		return gameLocations.filter((loc) => (loc.name ?? '').toLowerCase().includes(term));
	});

	function closeScenarioModal() {
		const shouldCleanupUpload =
			scenarioModalMode === 'create' && !scenarioModalPersisted && scenarioDisplayImagePathDraft;
		const cleanupPath = shouldCleanupUpload ? scenarioDisplayImagePathDraft : null;

		scenarioModalOpen = false;
		scenarioModalId = null;
		scenarioModalPersisted = false;
		scenarioLocationSearchDraft = '';

		if (cleanupPath) {
			// Best-effort cleanup of orphaned uploads when canceling a new scenario.
			void supabase.storage.from('game_assets').remove([cleanupPath]);
		}
	}

	async function saveScenarioModal() {
		if (!selectedEditionId) return;
		if (scenarioModalSaving) return;

		const name = scenarioNameDraft.trim();
		if (!name) {
			alert('Scenario name is required.');
			return;
		}

		scenarioModalSaving = true;
		try {
			const id = scenarioModalId ?? crypto.randomUUID();
			if (!scenarioModalId) scenarioModalId = id;
			const description = scenarioDescriptionDraft.trim() || null;
			const display_name = scenarioDisplayNameDraft.trim() || null;
			const display_image_path = scenarioDisplayImagePathDraft?.trim() || null;
			const game_location_ids = Array.from(
				new Set(scenarioGameLocationIdsDraft.map((v) => (v ?? '').trim()).filter(Boolean))
			);

			if (scenarioModalMode === 'create') {
				const nextOrderNum = scenarios.reduce((max, s) => Math.max(max, s.order_num ?? 0), -1) + 1;
				const { error: insertErr } = await supabase
					.from('scenarios')
					.insert({
						id,
						edition_id: selectedEditionId,
						name,
						display_name,
						description,
						game_location_ids,
						display_image_path,
						order_num: nextOrderNum
					});
				if (insertErr) throw insertErr;
			} else if (scenarioModalMode === 'edit' && scenarioModalId) {
				const { error: updateErr } = await supabase
					.from('scenarios')
					.update({ name, display_name, description, game_location_ids, display_image_path })
					.eq('id', scenarioModalId);
				if (updateErr) throw updateErr;
			}

			scenarioModalPersisted = true;
			closeScenarioModal();
			await loadScenarios();
		} catch (err) {
			alert(`Failed to save scenario: ${getErrorMessage(err)}`);
		} finally {
			scenarioModalSaving = false;
		}
	}

	async function deleteScenario(scenario: ScenarioOption) {
		if (!confirm(`Delete scenario "${scenario.name}"? This will remove its deck entries too.`)) return;
		try {
			const { error: deleteErr } = await supabase.from('scenarios').delete().eq('id', scenario.id);
			if (deleteErr) throw deleteErr;
			await loadScenarios();
		} catch (err) {
			alert(`Failed to delete scenario: ${getErrorMessage(err)}`);
		}
	}

	async function addMonsterToDeck() {
		if (!selectedScenarioId) return;
		if (addingMonster) return;
		const monsterId = monsterToAddId.trim();
		if (!monsterId) return;

		addingMonster = true;
		try {
			const quantity = Math.max(1, Math.trunc(Number(monsterToAddQuantity ?? 1)));
			const order_num = deckEntries.length;
			const { error: insertErr } = await supabase.from('scenario_deck_entries').insert({
				scenario_id: selectedScenarioId,
				kind: 'monster',
				order_num,
				quantity,
				entry_stage: null,
				data: {},
				monster_id: monsterId
			});
			if (insertErr) throw insertErr;
			monsterToAddId = '';
			monsterToAddQuantity = 1;
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to add monster: ${getErrorMessage(err)}`);
		} finally {
			addingMonster = false;
		}
	}

	async function addLocationToDeck() {
		if (!selectedScenarioId) return;
		if (addingLocation) return;
		const locationId = locationToAddId.trim();
		if (!locationId) return;

		addingLocation = true;
		try {
			const order_num = deckEntries.length;
			const data = setStageCardRenderStyleInData({}, locationRenderStyle);
			const { error: insertErr } = await supabase.from('scenario_deck_entries').insert({
				scenario_id: selectedScenarioId,
				kind: 'location',
				order_num,
				quantity: 1,
				entry_stage: locationEntryStage,
				data,
				game_location_id: locationId
			});
			if (insertErr) throw insertErr;
			locationToAddId = '';
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to add location: ${getErrorMessage(err)}`);
		} finally {
			addingLocation = false;
		}
	}

	async function addTravelerToDeck() {
		if (!selectedScenarioId) return;
		if (addingTraveler) return;
		const travelerId = travelerToAddId.trim();
		if (!travelerId) return;

		addingTraveler = true;
		try {
			const order_num = deckEntries.length;
			const { error: insertErr } = await supabase.from('scenario_deck_entries').insert({
				scenario_id: selectedScenarioId,
				kind: 'traveler',
				order_num,
				quantity: 1,
				entry_stage: travelerEntryStage,
				data: {},
				traveler_id: travelerId
			});
			if (insertErr) throw insertErr;
			travelerToAddId = '';
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to add traveler: ${getErrorMessage(err)}`);
		} finally {
			addingTraveler = false;
		}
	}


	async function addEventToDeck() {
		if (!selectedScenarioId) return;
		if (addingEvent) return;
		const eventId = eventToAddId.trim();
		if (!eventId) return;

		addingEvent = true;
		try {
			const order_num = deckEntries.length;
			const { error: insertErr } = await supabase.from('scenario_deck_entries').insert({
				scenario_id: selectedScenarioId,
				kind: 'event',
				order_num,
				quantity: 1,
				entry_stage: null,
				data: {},
				event_id: eventId
			});
			if (insertErr) throw insertErr;
			eventToAddId = '';
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to add event: ${getErrorMessage(err)}`);
		} finally {
			addingEvent = false;
		}
	}

	async function updateEntryQuantity(entryId: string, nextRaw: string) {
		const next = Math.max(1, Math.trunc(Number(nextRaw)));
		if (!Number.isFinite(next)) return;
		try {
			const { error: updateErr } = await supabase.from('scenario_deck_entries').update({ quantity: next }).eq('id', entryId);
			if (updateErr) throw updateErr;
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to update quantity: ${getErrorMessage(err)}`);
		}
	}

	async function updateEntryStage(entryId: string, stage: EventType) {
		try {
			const { error: updateErr } = await supabase.from('scenario_deck_entries').update({ entry_stage: stage }).eq('id', entryId);
			if (updateErr) throw updateErr;
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to update stage: ${getErrorMessage(err)}`);
		}
	}

	async function updateEntryLocationStyle(entryId: string, style: StageLocationRenderStyle) {
		const entry = deckEntries.find((e) => e.id === entryId) ?? null;
		if (!entry) return;
		const nextData = setStageCardRenderStyleInData(entry.data, style);
		try {
			const { error: updateErr } = await supabase.from('scenario_deck_entries').update({ data: nextData }).eq('id', entryId);
			if (updateErr) throw updateErr;
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to update style: ${getErrorMessage(err)}`);
		}
	}

	async function deleteDeckEntry(entryId: string) {
		if (!selectedScenarioId) return;
		if (!confirm('Remove this card from the scenario deck?')) return;
		try {
			const { error: deleteErr } = await supabase.from('scenario_deck_entries').delete().eq('id', entryId);
			if (deleteErr) throw deleteErr;
			await loadScenarioDeck();
			await normalizeDeckOrder();
		} catch (err) {
			alert(`Failed to remove entry: ${getErrorMessage(err)}`);
		}
	}

	async function normalizeDeckOrder() {
		if (!selectedScenarioId) return;
		const ordered = [...deckEntries].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
		await saveDeckOrder(ordered.map((e) => e.id));
	}

	async function moveDeckEntry(entryId: string, direction: 'up' | 'down') {
		const ordered = [...deckEntries].sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
		const idx = ordered.findIndex((e) => e.id === entryId);
		if (idx < 0) return;
		const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (nextIdx < 0 || nextIdx >= ordered.length) return;
		const next = [...ordered];
		[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
		await saveDeckOrder(next.map((e) => e.id));
	}

	async function saveDeckOrder(orderedIds: string[]) {
		if (!selectedScenarioId) return;
		if (orderedIds.length === 0) return;

		try {
			// Two-phase write to avoid unique collisions on (scenario_id, order_num).
			const now = new Date().toISOString();
			const tempUpdates = orderedIds.map((id, idx) => ({
				id,
				scenario_id: selectedScenarioId,
				order_num: 10000 + idx,
				updated_at: now
			}));
			const { error: tempErr } = await supabase.from('scenario_deck_entries').upsert(tempUpdates, { onConflict: 'id' });
			if (tempErr) throw tempErr;

			const finalUpdates = orderedIds.map((id, idx) => ({
				id,
				scenario_id: selectedScenarioId,
				order_num: idx,
				updated_at: now
			}));
			const { error: finalErr } = await supabase.from('scenario_deck_entries').upsert(finalUpdates, { onConflict: 'id' });
			if (finalErr) throw finalErr;

			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to save deck order: ${getErrorMessage(err)}`);
		}
	}

	function openCreateEvent() {
		if (!selectedScenarioId) return;
		eventModalMode = 'create';
		eventModalEventId = null;
		eventForm = {
			stage: DEFAULT_EVENT_TYPE,
			render_style: DEFAULT_STAGE_EVENT_RENDER_STYLE,
			title: '',
			description: '',
			stage_completion: ''
		};
		eventModalOpen = true;
	}

	function openEditEvent(eventId: string) {
		const ev = eventsById.get(eventId) ?? null;
		if (!ev) return;
		eventModalMode = 'edit';
		eventModalEventId = ev.id;
		eventForm = {
			stage: ev.stage ?? DEFAULT_EVENT_TYPE,
			render_style: getStageCardRenderStyle('event', ev.data) as StageEventRenderStyle,
			title: ev.title ?? '',
			description: ev.description ?? '',
			stage_completion: ev.stage_completion ?? ''
		};
		eventModalOpen = true;
	}

	async function saveEventModal() {
		if (eventModalSaving) return;
		const title = eventForm.title.trim();
		if (!title) {
			alert('Event title is required.');
			return;
		}

		eventModalSaving = true;
		try {
			const now = new Date().toISOString();
			const renderStyle = eventForm.render_style ?? DEFAULT_STAGE_EVENT_RENDER_STYLE;

			if (eventModalMode === 'create') {
				const id = crypto.randomUUID();
				const internal_name = id;
				const { error: insertErr } = await supabase.from('event_cards').insert({
					id,
					internal_name,
					stage: eventForm.stage,
					title,
					description: (eventForm.description ?? '').trim() || null,
					stage_completion: (eventForm.stage_completion ?? '').trim() || null,
					reward_rows: [{ type: 'all_players', icon_ids: [] }],
					image_path: null,
					card_image_path: null,
					data: setStageCardRenderStyleInData({}, renderStyle),
					order_num: 0,
					updated_at: now
				});
				if (insertErr) throw insertErr;

				const order_num = deckEntries.length;
				const { error: linkErr } = await supabase.from('scenario_deck_entries').insert({
					scenario_id: selectedScenarioId,
					kind: 'event',
					order_num,
					quantity: 1,
					entry_stage: null,
					data: {},
					event_id: id
				});
				if (linkErr) throw linkErr;
			} else if (eventModalMode === 'edit' && eventModalEventId) {
				const id = eventModalEventId;
				const existing = eventsById.get(id) ?? null;
				const nextData = setStageCardRenderStyleInData(existing?.data, renderStyle);
				const { error: updateErr } = await supabase
					.from('event_cards')
					.update({
						stage: eventForm.stage,
						title,
						description: (eventForm.description ?? '').trim() || null,
						stage_completion: (eventForm.stage_completion ?? '').trim() || null,
						data: nextData,
						updated_at: now
					})
					.eq('id', id);
				if (updateErr) throw updateErr;
			}

			eventModalOpen = false;
			eventModalEventId = null;

			// Refresh library + deck.
			const { data: eventsData, error: eventsErr } = await supabase
				.from('event_cards')
				.select('id, internal_name, stage, title, description, stage_completion, reward_rows, image_path, card_image_path, data, updated_at')
				.order('order_num')
				.order('title');
			if (eventsErr) throw eventsErr;
			events = (eventsData ?? []) as EventCatalogEntry[];
			await loadScenarioDeck();
		} catch (err) {
			alert(`Failed to save event: ${getErrorMessage(err)}`);
		} finally {
			eventModalSaving = false;
		}
	}
</script>

<PageLayout
	title="Scenarios"
	subtitle="Build a single unified scenario deck (monsters, locations, travelers, events)"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		<FormField label="Edition">
			<Select
				bind:value={selectedEditionIdSelect}
				options={editionOptions}
				placeholder={editionOptions.length === 0 ? 'No editions' : 'Select edition'}
				disabled={loading || editionOptions.length === 0}
				onchange={(e) => requestEditionChange((e.target as HTMLSelectElement).value)}
			/>
		</FormField>
		<Button variant="primary" onclick={openCreateScenario} disabled={loading || !selectedEditionId}>+ Scenario</Button>
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading…</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else}
		<div class="layout">
			<div class="scenario-bar">
				<div class="scenario-bar__header">
					<h3>Scenarios</h3>
					<span class="count">{scenarios.length}</span>
				</div>

				{#if scenarios.length === 0}
					<div class="empty">No scenarios yet.</div>
				{:else}
					<div class="scenario-bar__list" role="list" aria-label="Scenarios">
						{#each scenarios as scenario (scenario.id)}
							<div class="scenario-chip-row" role="listitem">
								<button
									class="scenario-chip"
									class:selected={scenario.id === selectedScenarioId}
									onclick={() => selectScenario(scenario.id)}
								>
									{scenario.display_name ?? scenario.name}
								</button>
								<CardActionMenu onEdit={() => openEditScenario(scenario)} onDelete={() => deleteScenario(scenario)} />
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<main class="content">
				{#if selectedScenario}
					<div class="scenario-header">
						<div class="scenario-header__title">
							<h2>{selectedScenario.display_name ?? selectedScenario.name}</h2>
							{#if selectedScenario.description}
								<p class="muted">{selectedScenario.description}</p>
							{/if}
						</div>
						<Button variant="secondary" onclick={() => openEditScenario(selectedScenario)}>Edit</Button>
					</div>

					{#if activeTab === 'manage'}
						<section class="section">
							<div class="section-header">
								<h3>Add Cards</h3>
								<div class="section-header__actions">
									<Button variant="secondary" onclick={openCreateGameLocation}>+ Game Location</Button>
									<Button variant="primary" onclick={openCreateEvent}>+ Event</Button>
								</div>
							</div>

							<div class="add-grid">
								<div class="add-row">
									<FormField label="Monster">
										<Select
											bind:value={monsterToAddId}
											options={availableMonsterOptions}
											placeholder={availableMonsterOptions.length === 0 ? 'No monsters available' : 'Select monster'}
											disabled={addingMonster || availableMonsterOptions.length === 0}
										/>
									</FormField>
									<FormField label="Qty">
										<Input
											type="number"
											min={1}
											step={1}
											bind:value={monsterToAddQuantity}
											disabled={addingMonster || monsterToAddId.trim().length === 0}
										/>
									</FormField>
									<Button variant="primary" onclick={addMonsterToDeck} disabled={addingMonster || monsterToAddId.trim().length === 0}>
										{addingMonster ? 'Adding…' : 'Add'}
									</Button>
								</div>

								<div class="add-row">
									<FormField label="Location">
										<Select
											bind:value={locationToAddId}
											options={availableLocationOptions}
											placeholder={availableLocationOptions.length === 0 ? 'No locations available' : 'Select location'}
											disabled={addingLocation || availableLocationOptions.length === 0}
										/>
									</FormField>
									<FormField label="Stage">
										<Select
											bind:value={locationEntryStage}
											options={EVENT_TYPE_OPTIONS}
											disabled={addingLocation || locationToAddId.trim().length === 0}
										/>
									</FormField>
									<FormField label="Style">
										<Select
											bind:value={locationRenderStyle}
											options={STAGE_LOCATION_RENDER_STYLE_OPTIONS}
											disabled={addingLocation || locationToAddId.trim().length === 0}
										/>
									</FormField>
									<Button variant="primary" onclick={addLocationToDeck} disabled={addingLocation || locationToAddId.trim().length === 0}>
										{addingLocation ? 'Adding…' : 'Add'}
									</Button>
								</div>

								<div class="add-row">
									<FormField label="Traveler">
										<Select
											bind:value={travelerToAddId}
											options={availableTravelerOptions}
											placeholder={availableTravelerOptions.length === 0 ? 'No travelers available' : 'Select traveler'}
											disabled={addingTraveler || availableTravelerOptions.length === 0}
										/>
									</FormField>
									<FormField label="Stage">
										<Select
											bind:value={travelerEntryStage}
											options={EVENT_TYPE_OPTIONS}
											disabled={addingTraveler || travelerToAddId.trim().length === 0}
										/>
									</FormField>
									<Button variant="primary" onclick={addTravelerToDeck} disabled={addingTraveler || travelerToAddId.trim().length === 0}>
										{addingTraveler ? 'Adding…' : 'Add'}
									</Button>
								</div>

								<div class="add-row">
									<FormField label="Event">
										<Select
											bind:value={eventToAddId}
											options={availableEventOptions}
											placeholder={availableEventOptions.length === 0 ? 'No events available' : 'Select event'}
											disabled={addingEvent || availableEventOptions.length === 0}
										/>
									</FormField>
									<Button variant="primary" onclick={addEventToDeck} disabled={addingEvent || eventToAddId.trim().length === 0}>
										{addingEvent ? 'Adding…' : 'Add'}
									</Button>
								</div>
							</div>
						</section>

						<section class="section">
							<div class="section-header">
								<h3>Scenario Deck</h3>
								<span class="badge">{deckEntries.length}</span>
							</div>

							{#if deckItems.length === 0}
								<div class="empty">No cards in this scenario yet.</div>
							{:else}
								<ul class="deck-list">
									{#each deckItems as item, idx (item.entry.id)}
										<li class="deck-row">
											<div class="deck-row__meta">
												<span class="pos">#{idx + 1}</span>
												<span class="type">{item.entry.kind}</span>
												<span class="name">{item.label}</span>
												{#if item.entry.kind === 'event' && item.event}
													<span class={`pill pill--${item.event.stage}`}>{eventTypeLabel(item.event.stage)}</span>
												{:else if (item.entry.kind === 'location' || item.entry.kind === 'traveler') && item.entry.entry_stage}
													<span class={`pill pill--${item.entry.entry_stage}`}>{eventTypeLabel(item.entry.entry_stage)}</span>
											{:else if item.entry.kind === 'monster' && item.monster?.stage}
													<span class={`pill pill--${item.monster.stage}`}>{getMonsterStageLabel(item.monster.stage)}</span>
												{/if}
											</div>

											<div class="deck-row__actions">
												{#if item.entry.kind === 'monster'}
													<Input
														type="number"
														min={1}
														step={1}
														value={String(item.entry.quantity ?? 1)}
														onblur={(e) => updateEntryQuantity(item.entry.id, (e.target as HTMLInputElement).value)}
													/>
												{/if}

												{#if item.entry.kind === 'location'}
													<Select
														value={item.entry.entry_stage ?? DEFAULT_EVENT_TYPE}
														options={EVENT_TYPE_OPTIONS}
														onchange={(e) => updateEntryStage(item.entry.id, (e.target as HTMLSelectElement).value as EventType)}
													/>
													<Select
														value={getStageCardRenderStyle('stage_location', item.entry.data) as any}
														options={STAGE_LOCATION_RENDER_STYLE_OPTIONS}
														onchange={(e) => updateEntryLocationStyle(item.entry.id, (e.target as HTMLSelectElement).value as StageLocationRenderStyle)}
													/>
												{/if}

												{#if item.entry.kind === 'traveler'}
													<Select
														value={item.entry.entry_stage ?? DEFAULT_EVENT_TYPE}
														options={EVENT_TYPE_OPTIONS}
														onchange={(e) => updateEntryStage(item.entry.id, (e.target as HTMLSelectElement).value as EventType)}
													/>
												{/if}

												{#if item.entry.kind === 'event' && item.event}
													<Button variant="secondary" onclick={() => openEditEvent(item.event!.id)}>Edit</Button>
												{/if}

												<button class="btn" onclick={() => moveDeckEntry(item.entry.id, 'up')} disabled={idx === 0}>↑</button>
												<button class="btn" onclick={() => moveDeckEntry(item.entry.id, 'down')} disabled={idx === deckItems.length - 1}>↓</button>
												<button class="btn danger" onclick={() => deleteDeckEntry(item.entry.id)}>Remove</button>
											</div>
										</li>
									{/each}
								</ul>
							{/if}
						</section>
					{:else if activeTab === 'cards'}
						<section class="section">
							<div class="section-header">
								<div class="section-header__title">
									<h3>Scenario Cards</h3>
									<span class="badge">{filteredDeckItems.length}/{deckItems.length}</span>
								</div>
							</div>

							<div class="gallery-controls">
								<input
									type="text"
									class="gallery-search"
									placeholder="Search…"
									bind:value={deckSearchQuery}
								/>
								<select class="gallery-select" bind:value={deckKindFilter}>
									<option value="all">All Kinds</option>
									<option value="monster">Monsters</option>
									<option value="location">Locations</option>
									<option value="traveler">Travelers</option>
									<option value="event">Events</option>
								</select>
							</div>

							<div class="gallery-grid">
								{#each filteredDeckItems as item (item.entry.id)}
									<div class="gallery-card">
										<div class="gallery-preview">
											<ScenarioDeckCardPreview
												entry={item.entry}
												monster={item.monster ?? null}
												location={item.location ?? null}
												traveler={item.traveler ?? null}
												event={item.event ?? null}
											/>
										</div>
										<div class="gallery-info">
											<div class="gallery-info__header">
												<h4 class="gallery-name">{item.label}</h4>
												<span class="gallery-badge">{item.entry.kind}</span>
											</div>
											<div class="gallery-meta">
												<span class="gallery-order">#{(item.entry.order_num ?? 0) + 1}</span>
												{#if item.entry.kind === 'monster'}
													<span class="badge">x{item.entry.quantity ?? 1}</span>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>

							{#if filteredDeckItems.length === 0}
								<div class="empty">No cards match the current filters.</div>
							{/if}
						</section>
					{/if}
				{:else}
					<div class="empty">Select a scenario.</div>
				{/if}
			</main>
		</div>
	{/if}
</PageLayout>

{#if scenarioModalOpen}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close dialog"
		onclick={() => !scenarioModalSaving && closeScenarioModal()}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !scenarioModalSaving && closeScenarioModal()}
	>
		<div
			class="modal"
			role="dialog"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h3>{scenarioModalMode === 'create' ? 'Create Scenario' : 'Edit Scenario'}</h3>
			</div>
			<div class="modal-body">
				<FormField label="Internal Name" required helperText="Used for sorting and export selection; keep stable.">
					<Input type="text" bind:value={scenarioNameDraft} required />
				</FormField>
				<FormField label="Display Name" helperText="Optional name shown in the UI and exported to TTS (defaults to internal name).">
					<Input type="text" bind:value={scenarioDisplayNameDraft} />
				</FormField>
				<FormField label="Display Image" helperText="Optional; exported to TTS as a public URL.">
					<ImageUploader
						bind:value={scenarioDisplayImagePathDraft}
						folder={scenarioModalId ? `scenario_images/${scenarioModalId}` : 'scenario_images'}
						filename="display"
						upsert
						cropTransparent={false}
						accept="image/png,image/webp,image/jpeg"
						maxSizeMB={10}
						onerror={(msg) => alert(`Image upload failed: ${msg}`)}
					/>
				</FormField>
				<FormField label="Description">
					<Textarea rows={3} bind:value={scenarioDescriptionDraft} />
				</FormField>
				<FormField
					label="Game Locations"
					helperText={`Optional curated list (exported to TTS). Selected: ${scenarioGameLocationIdsDraft.length}`}
				>
					<Input type="text" placeholder="Filter locations…" bind:value={scenarioLocationSearchDraft} />
					<div class="location-picker">
						{#each filteredScenarioLocationOptions as loc (loc.id)}
							<label class="location-option">
								<input
									type="checkbox"
									checked={scenarioGameLocationIdsDraft.includes(loc.id)}
									onchange={() => toggleScenarioGameLocation(loc.id)}
								/>
								<span>{loc.name}</span>
							</label>
						{/each}
						{#if filteredScenarioLocationOptions.length === 0}
							<div class="empty">No locations match.</div>
						{/if}
					</div>
				</FormField>
			</div>
			<div class="modal-footer">
				<Button
					variant="secondary"
					onclick={() => !scenarioModalSaving && closeScenarioModal()}
					disabled={scenarioModalSaving}
				>
					Cancel
				</Button>
				<Button variant="primary" onclick={saveScenarioModal} disabled={scenarioModalSaving}>
					{scenarioModalSaving ? 'Saving…' : 'Save'}
				</Button>
			</div>
		</div>
	</div>
{/if}

{#if eventModalOpen}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		aria-label="Close dialog"
		onclick={() => (eventModalOpen = false)}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (eventModalOpen = false)}
	>
		<div
			class="modal"
			role="dialog"
			tabindex="0"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h3>{eventModalMode === 'create' ? 'Create Event' : 'Edit Event'}</h3>
			</div>
			<div class="modal-body">
				<FormField label="Stage">
					<Select bind:value={eventForm.stage} options={EVENT_TYPE_OPTIONS} />
				</FormField>
				<FormField label="Style">
					<Select bind:value={eventForm.render_style} options={STAGE_EVENT_RENDER_STYLE_OPTIONS} />
				</FormField>
				<FormField label="Title" required>
					<Input type="text" bind:value={eventForm.title} required />
				</FormField>
				<FormField label="Description">
					<Textarea rows={3} bind:value={eventForm.description} />
				</FormField>
				<FormField label="Stage completion (optional)">
					<Input type="text" bind:value={eventForm.stage_completion} />
				</FormField>
			</div>
			<div class="modal-footer">
				<Button variant="secondary" onclick={() => (eventModalOpen = false)} disabled={eventModalSaving}>Cancel</Button>
				<Button variant="primary" onclick={saveEventModal} disabled={eventModalSaving}>
					{eventModalSaving ? 'Saving…' : 'Save'}
				</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.layout {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.scenario-bar {
		background: rgba(15, 23, 42, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.75rem;
	}

	.scenario-bar__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.75rem;
	}

	.count {
		background: rgba(59, 130, 246, 0.18);
		border: 1px solid rgba(59, 130, 246, 0.25);
		color: #93c5fd;
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		font-weight: 700;
		font-size: 0.75rem;
	}

	.scenario-bar__list {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-width: thin;
	}

	.scenario-chip-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.scenario-chip {
		white-space: nowrap;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #e2e8f0;
		padding: 0.45rem 0.75rem;
		border-radius: 999px;
		cursor: pointer;
	}

	.scenario-chip.selected {
		border-color: rgba(59, 130, 246, 0.55);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
	}

	.scenario-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.muted {
		color: rgba(226, 232, 240, 0.7);
		margin: 0.25rem 0 0;
	}

	.section {
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.9rem;
		margin-bottom: 1rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.section-header__actions {
		display: flex;
		gap: 0.5rem;
	}

	.badge {
		background: rgba(148, 163, 184, 0.16);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: rgba(226, 232, 240, 0.9);
		padding: 0.2rem 0.5rem;
		border-radius: 999px;
		font-weight: 700;
		font-size: 0.75rem;
	}

	.add-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.add-row {
		display: grid;
		grid-template-columns: 1fr 120px 160px 120px;
		gap: 0.75rem;
		align-items: end;
	}

	.add-row:nth-child(3),
	.add-row:nth-child(4),
	.add-row:nth-child(5) {
		grid-template-columns: 1fr 160px 120px;
	}

	.deck-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.deck-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		background: rgba(15, 23, 42, 0.45);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.6rem 0.75rem;
	}

	.deck-row__meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.pos {
		width: 2.1rem;
		text-align: right;
		color: rgba(148, 163, 184, 0.9);
		font-weight: 700;
	}

	.type {
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.06em;
		color: rgba(148, 163, 184, 0.85);
	}

	.name {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.deck-row__actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.btn {
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: rgba(15, 23, 42, 0.55);
		color: #e2e8f0;
		padding: 0.35rem 0.55rem;
		border-radius: 10px;
		cursor: pointer;
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.btn.danger {
		border-color: rgba(248, 113, 113, 0.35);
		color: rgba(248, 113, 113, 0.95);
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

	.gallery-controls {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.gallery-search {
		flex: 1;
		padding: 0.55rem 0.65rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
	}

	.gallery-select {
		padding: 0.55rem 0.65rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 0.85rem;
	}

	.gallery-card {
		background: rgba(15, 23, 42, 0.45);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 14px;
		overflow: hidden;
		display: grid;
		grid-template-rows: 175px auto;
	}

	.gallery-preview {
		background: rgba(15, 23, 42, 0.35);
	}

	.gallery-info {
		padding: 0.65rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.gallery-info__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.gallery-name {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 800;
		color: #e2e8f0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gallery-badge {
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		color: rgba(148, 163, 184, 0.9);
	}

	.gallery-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.gallery-order {
		color: rgba(148, 163, 184, 0.9);
		font-weight: 700;
		font-size: 0.8rem;
	}

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

	.location-picker {
		margin-top: 0.5rem;
		display: grid;
		gap: 0.35rem;
		max-height: 240px;
		overflow: auto;
		padding: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		background: rgba(2, 6, 23, 0.35);
	}

	.location-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.35rem;
		border-radius: 8px;
		color: rgba(226, 232, 240, 0.95);
		cursor: pointer;
	}

	.location-option:hover {
		background: rgba(148, 163, 184, 0.08);
	}

	.location-option input {
		margin: 0;
	}

	.modal-footer {
		padding: 0.85rem 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
