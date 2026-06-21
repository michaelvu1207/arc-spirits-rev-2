<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/api/supabaseClient';
	import type {
		EditionRow,
		EventCardRow,
		GameLocationRow,
		GameLocationRewardRow,
		GameLocationRowCompositionRow,
		RewardRowAssignment,
		MonsterRow,
		ScenarioDeckEntryKind,
		ScenarioDeckEntryRow,
		ScenarioRow,
		StageCompletionCardRow
	} from '$lib/types/gameData';
	import { configToRewardRow } from '$lib/types/gameData';
	import { DEFAULT_EVENT_TYPE, EVENT_TYPE_OPTIONS, eventTypeLabel, type EventType } from '$lib/types/eventTypes';
	import {
		DEFAULT_STAGE_LOCATION_RENDER_STYLE,
		STAGE_LOCATION_RENDER_STYLE_OPTIONS,
		setStageCardRenderStyleInData,
		getStageCardRenderStyle,
		type StageLocationRenderStyle
	} from '$lib/types/stageCardStyles';
	import { getErrorMessage } from '$lib/utils';
	import { getMonsterStageLabel } from '$lib/utils/monsterStageLabels';
	import { PageLayout } from '$lib/components/layout';
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
		'id' | 'name' | 'background_image_path' | 'image_with_icons_path' | 'updated_at'
	> & { reward_rows: GameLocationRewardRow[] };
	type EventCatalogEntry = Pick<
		EventCardRow,
		'id' | 'internal_name' | 'stage' | 'title' | 'description' | 'reward_rows' | 'image_path' | 'card_image_path' | 'data' | 'updated_at'
	>;
	type StageCompletionCatalogEntry = Pick<
		StageCompletionCardRow,
		'id' | 'title' | 'complete_condition' | 'stage' | 'card_image_path' | 'updated_at'
	>;

	type DeckItem = {
		entry: ScenarioDeckEntryRow;
		monster?: MonsterCatalogEntry | null;
		location?: GameLocationCatalogEntry | null;
		event?: EventCatalogEntry | null;
		stageCompletion?: StageCompletionCatalogEntry | null;
		stage: EventType | null;
		label: string;
	};

	const STORAGE_EDITION_KEY = 'arc_spirits_assets:selected_scenario_edition_id';
	const STORAGE_SCENARIO_KEY = 'arc_spirits_assets:selected_scenario_id';

	let editions = $state<EditionOption[]>([]);
	let selectedEditionId = $state('');
	let selectedEditionIdSelect = $state('');

	let scenarios = $state<ScenarioOption[]>([]);
	let selectedScenarioId = $state('');

	let deckEntries = $state<ScenarioDeckEntryRow[]>([]);

	let monsters = $state<MonsterCatalogEntry[]>([]);
	let gameLocations = $state<GameLocationCatalogEntry[]>([]);
	let events = $state<EventCatalogEntry[]>([]);
	let stageCompletions = $state<StageCompletionCatalogEntry[]>([]);

	let loading = $state(true);
	let error = $state<string | null>(null);

	// Add controls
	let monsterToAddId = $state('');
	let addingMonster = $state(false);

	let locationToAddId = $state('');
	let locationEntryStage = $state<EventType>(DEFAULT_EVENT_TYPE);
	let locationRenderStyle = $state<StageLocationRenderStyle>(DEFAULT_STAGE_LOCATION_RENDER_STYLE);
	let addingLocation = $state(false);

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
		title: '',
		description: ''
	});

	// Deck filters
	let deckSearchQuery = $state('');
	let deckKindFilter = $state<ScenarioDeckEntryKind | 'all'>('all');

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
	const eventsById = $derived.by(() => new Map(events.map((e) => [e.id, e])));
	const stageCompletionsById = $derived.by(() => new Map(stageCompletions.map((sc) => [sc.id, sc])));

	const stageSortWeight: Record<EventType, number> = {
		stage_1: 1,
		stage_2: 2,
		stage_3: 3,
		final_stage: 4,
		endgame: 5
	};

	function getDeckItemSortWeight(stage: EventType | null): number {
		return stage ? stageSortWeight[stage] ?? 999 : 999;
	}

	function getDeckItemKindWeight(kind: ScenarioDeckEntryKind): number {
		switch (kind) {
			case 'event':
				return 1;
			case 'location':
			case 'monster':
				return 2;
			case 'stage_completion':
				return 3;
			default:
				return 99;
		}
	}

	function getDeckEntryStage(entry: ScenarioDeckEntryRow): EventType | null {
		switch (entry.kind) {
			case 'monster': {
				const monster = entry.monster_id ? monstersById.get(entry.monster_id) ?? null : null;
				const stage = monster?.stage ?? null;
				return stage === 'inactive' ? null : stage;
			}
			case 'location':
				return entry.entry_stage;
			case 'event': {
				const event = entry.event_id ? eventsById.get(entry.event_id) ?? null : null;
				return event?.stage ?? null;
			}
			case 'stage_completion': {
				const sc = entry.stage_completion_card_id ? stageCompletionsById.get(entry.stage_completion_card_id) ?? null : null;
				return sc?.stage ?? null;
			}
			default:
				return null;
		}
	}

	function sortedDeckEntriesByDisplayOrder(entries: ScenarioDeckEntryRow[]): ScenarioDeckEntryRow[] {
		return [...entries].sort((a, b) => {
			const stageA = getDeckItemSortWeight(getDeckEntryStage(a));
			const stageB = getDeckItemSortWeight(getDeckEntryStage(b));
			if (stageA !== stageB) return stageA - stageB;
			const kindA = getDeckItemKindWeight(a.kind);
			const kindB = getDeckItemKindWeight(b.kind);
			if (kindA !== kindB) return kindA - kindB;
			return (a.order_num ?? 0) - (b.order_num ?? 0);
		});
	}

	const deckItems = $derived.by<DeckItem[]>(() => {
		const mapped = sortedDeckEntriesByDisplayOrder(deckEntries).map((entry) => {
			const stage = getDeckEntryStage(entry);
			switch (entry.kind) {
				case 'monster': {
					const monster = entry.monster_id ? monstersById.get(entry.monster_id) ?? null : null;
					return {
						entry,
						monster,
						stage,
						label: monster?.name ?? 'Unknown Monster'
					};
				}
				case 'location': {
					const location = entry.game_location_id ? locationsById.get(entry.game_location_id) ?? null : null;
					return {
						entry,
						location,
						stage: entry.entry_stage,
						label: location?.name ?? 'Unknown Location'
					};
				}
				case 'event': {
					const event = entry.event_id ? eventsById.get(entry.event_id) ?? null : null;
					return {
						entry,
						event,
						stage: event?.stage ?? null,
						label: event?.title ?? 'Unknown Event'
					};
				}
				case 'stage_completion': {
					const sc = entry.stage_completion_card_id ? stageCompletionsById.get(entry.stage_completion_card_id) ?? null : null;
					return {
						entry,
						stageCompletion: sc,
						stage: sc?.stage ?? null,
						label: sc?.title ?? 'Unknown Stage Completion'
					};
				}
				default:
					return { entry, stage: null, label: 'Unknown' };
			}
		});
		return mapped;
	});

	const filteredDeckItems = $derived.by(() => {
		const term = deckSearchQuery.trim().toLowerCase();
		return deckItems.filter((item) => {
			if (deckKindFilter !== 'all' && item.entry.kind !== deckKindFilter) return false;
			if (!term) return true;
			return item.label.toLowerCase().includes(term);
		});
	});

	const monsterOptions = $derived.by(() =>
		[...monsters]
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
			.map((m) => ({ value: m.id, label: m.name }))
	);

	const locationOptions = $derived.by(() =>
		[...gameLocations]
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
			.map((l) => ({ value: l.id, label: l.name }))
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
					{ data: eventsData, error: eventsErr },
					{ data: scData, error: scErr }
				] = await Promise.all([
				supabase.from('editions').select('id, name, is_default').order('name', { ascending: true }),
				supabase.from('monsters_v2').select('id, name, stage, card_image_path, updated_at').order('name', { ascending: true }),
					supabase
						.from('game_locations')
						.select('id, name, background_image_path, image_with_icons_path, updated_at')
						.order('name', { ascending: true }),
					supabase
						.from('event_cards')
					.select('id, internal_name, stage, title, description, reward_rows, image_path, card_image_path, data, updated_at')
					.order('order_num')
					.order('title'),
				supabase
					.from('stage_completion_cards')
					.select('id, title, complete_condition, stage, card_image_path, updated_at')
					.order('order_num')
					.order('title')
			]);

				if (editionsErr) throw editionsErr;
				if (monstersErr) throw monstersErr;
				if (locationsErr) throw locationsErr;
				if (eventsErr) throw eventsErr;
			if (scErr) throw scErr;

				editions = (editionsData ?? []) as EditionOption[];
				monsters = (monstersData ?? []) as MonsterCatalogEntry[];

				// Resolve each location's reward rows from the normalized model
				// (game_location_rows + reward_row_assignments) — the single source of
				// truth shared with the game; the legacy reward_rows column is gone.
				const [rowRecordsRes, assignmentsRes] = await Promise.all([
					supabase.from('game_location_rows').select('id, name, type, config'),
					supabase.from('reward_row_assignments').select('location_id, row_id, row_index')
				]);
				if (rowRecordsRes.error) throw rowRecordsRes.error;
				if (assignmentsRes.error) throw assignmentsRes.error;
				const rowConfigById = new Map<string, GameLocationRowCompositionRow>(
					((rowRecordsRes.data as GameLocationRowCompositionRow[] | null) ?? []).map((r) => [r.id, r])
				);
				const rewardRowsByLocation = new Map<string, GameLocationRewardRow[]>();
				for (const a of ((assignmentsRes.data as RewardRowAssignment[] | null) ?? [])
					.slice()
					.sort((x, y) => x.row_index - y.row_index)) {
					const row = rowConfigById.get(a.row_id);
					if (!row) continue;
					const list = rewardRowsByLocation.get(a.location_id) ?? [];
					list.push(configToRewardRow(row.type, row.config));
					rewardRowsByLocation.set(a.location_id, list);
				}
				gameLocations = (
					(locationsData ?? []) as Omit<GameLocationCatalogEntry, 'reward_rows'>[]
				).map((l) => ({ ...l, reward_rows: rewardRowsByLocation.get(l.id) ?? [] }));
				events = (eventsData ?? []) as EventCatalogEntry[];
			stageCompletions = (scData ?? []) as StageCompletionCatalogEntry[];

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
				.from('edition_scenarios')
				.select(
					`order_num,
           scenario:scenarios (id, name, display_name, description, is_enabled, game_location_ids, display_image_path, order_num)`
				)
				.eq('edition_id', selectedEditionId)
				.order('order_num', { ascending: true });
			if (scenariosErr) throw scenariosErr;

			scenarios = (data ?? [])
				.map((row) => {
					const scenario = (row as any).scenario as ScenarioOption | null | undefined;
					if (!scenario) return null;
					return { ...scenario, order_num: (row as any).order_num ?? scenario.order_num } as ScenarioOption;
				})
				.filter(Boolean) as ScenarioOption[];
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

	async function loadScenarioDeckAndNormalizeOrder() {
		await loadScenarioDeck();
		await normalizeDeckOrder();
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

					const { error: linkErr } = await supabase.from('edition_scenarios').insert({
						edition_id: selectedEditionId,
						scenario_id: id,
						order_num: nextOrderNum
					});
					if (linkErr) throw linkErr;
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
			const order_num = deckEntries.length;
			const { error: insertErr } = await supabase.from('scenario_deck_entries').insert({
				scenario_id: selectedScenarioId,
				kind: 'monster',
				order_num,
				quantity: 1,
				entry_stage: null,
				data: {},
				monster_id: monsterId
			});
			if (insertErr) throw insertErr;
			monsterToAddId = '';
			await loadScenarioDeckAndNormalizeOrder();
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
			await loadScenarioDeckAndNormalizeOrder();
		} catch (err) {
			alert(`Failed to add location: ${getErrorMessage(err)}`);
		} finally {
			addingLocation = false;
		}
	}

	async function updateEntryStage(entryId: string, stage: EventType) {
		try {
			const { error: updateErr } = await supabase.from('scenario_deck_entries').update({ entry_stage: stage }).eq('id', entryId);
			if (updateErr) throw updateErr;
			await loadScenarioDeckAndNormalizeOrder();
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
		const ordered = sortedDeckEntriesByDisplayOrder(deckEntries);
		await saveDeckOrder(ordered.map((e) => e.id));
	}

	async function moveDeckEntry(entryId: string, direction: 'up' | 'down') {
		const ordered = sortedDeckEntriesByDisplayOrder(deckEntries);
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
			title: '',
			description: ''
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
			title: ev.title ?? '',
			description: ev.description ?? ''
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

			if (eventModalMode === 'create') {
				const id = crypto.randomUUID();
				const internal_name = id;
				const { error: insertErr } = await supabase.from('event_cards').insert({
					id,
					internal_name,
					stage: eventForm.stage,
					title,
					description: (eventForm.description ?? '').trim() || null,
					reward_rows: [{ type: 'all_players', icon_ids: [] }],
					image_path: null,
					card_image_path: null,
					data: {},
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
				const { error: updateErr } = await supabase
					.from('event_cards')
					.update({
						stage: eventForm.stage,
						title,
						description: (eventForm.description ?? '').trim() || null,
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
				.select('id, internal_name, stage, title, description, reward_rows, image_path, card_image_path, data, updated_at')
				.order('order_num')
				.order('title');
			if (eventsErr) throw eventsErr;
			events = (eventsData ?? []) as EventCatalogEntry[];
			await loadScenarioDeckAndNormalizeOrder();
		} catch (err) {
			alert(`Failed to save event: ${getErrorMessage(err)}`);
		} finally {
			eventModalSaving = false;
		}
	}
</script>

	<PageLayout
		title="Scenarios"
		subtitle="Build a single unified scenario deck (monsters, locations, events)"
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
		<!-- Scenario strip -->
		{#if scenarios.length === 0}
			<div class="empty">No scenarios yet. Create one to get started.</div>
		{:else}
			<div class="scenario-strip" role="list" aria-label="Scenarios">
				{#each scenarios as scenario (scenario.id)}
					<div class="scenario-strip__item" role="listitem">
						<button
							class="scenario-strip__chip"
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

		{#if selectedScenario}
			<div class="columns">
				<!-- Left column: scenario info + add forms -->
				<aside class="col-add">
					<div class="scenario-info">
						<h3 class="scenario-info__name">{selectedScenario.display_name ?? selectedScenario.name}</h3>
						{#if selectedScenario.description}
							<p class="scenario-info__desc">{selectedScenario.description}</p>
						{/if}
						<Button variant="secondary" onclick={() => openEditScenario(selectedScenario)}>Edit</Button>
					</div>

					<div class="add-forms__header">
						<h4>Add Cards</h4>
						<div class="add-forms__header-actions">
							<Button variant="secondary" onclick={openCreateGameLocation}>+ Location</Button>
							<Button variant="primary" onclick={openCreateEvent}>+ Event</Button>
						</div>
					</div>

					<div class="add-forms">
						<!-- Monster add form -->
						<div class="add-form">
							<span class="add-form__label">Monster</span>
							<Select
								bind:value={monsterToAddId}
								options={monsterOptions}
								placeholder={monsterOptions.length === 0 ? 'No monsters available' : 'Select monster'}
								disabled={addingMonster || monsterOptions.length === 0}
							/>
							<Button variant="primary" onclick={addMonsterToDeck} disabled={addingMonster || monsterToAddId.trim().length === 0}>
								{addingMonster ? 'Adding…' : 'Add'}
							</Button>
						</div>

						<!-- Location add form -->
						<div class="add-form">
							<span class="add-form__label">Location</span>
							<Select
								bind:value={locationToAddId}
								options={locationOptions}
								placeholder={locationOptions.length === 0 ? 'No locations available' : 'Select location'}
								disabled={addingLocation || locationOptions.length === 0}
							/>
							<Select
								bind:value={locationEntryStage}
								options={EVENT_TYPE_OPTIONS}
								disabled={addingLocation || locationToAddId.trim().length === 0}
							/>
							<Select
								bind:value={locationRenderStyle}
								options={STAGE_LOCATION_RENDER_STYLE_OPTIONS}
								disabled={addingLocation || locationToAddId.trim().length === 0}
							/>
							<Button variant="primary" onclick={addLocationToDeck} disabled={addingLocation || locationToAddId.trim().length === 0}>
								{addingLocation ? 'Adding…' : 'Add'}
							</Button>
						</div>

						</div>
					</aside>

				<!-- Right column: deck -->
				<section class="col-deck">
					<div class="deck-header">
						<div class="deck-header__title">
							<h3>Scenario Deck</h3>
							<span class="badge">{filteredDeckItems.length}/{deckEntries.length}</span>
						</div>
						<div class="deck-header__controls">
							<input
								type="text"
								class="deck-search"
								placeholder="Search…"
								bind:value={deckSearchQuery}
							/>
							<select class="deck-filter" bind:value={deckKindFilter}>
								<option value="all">All Kinds</option>
								<option value="monster">Monsters</option>
								<option value="location">Locations</option>
								<option value="event">Events</option>
								<option value="stage_completion">Stage Completion</option>
							</select>
						</div>
					</div>

					{#if filteredDeckItems.length === 0}
						<div class="empty">
							{deckEntries.length === 0 ? 'No cards in this scenario yet.' : 'No cards match the current filters.'}
						</div>
					{:else}
						<ul class="deck-list">
							{#each filteredDeckItems as item, idx (item.entry.id)}
								<li class="deck-row">
									<div class="deck-row__thumb">
											<ScenarioDeckCardPreview
												entry={item.entry}
												monster={item.monster ?? null}
												location={item.location ?? null}
												event={item.event ?? null}
												stageCompletion={item.stageCompletion ?? null}
											/>
									</div>

									<div class="deck-row__meta">
										<span class="pos">#{(item.entry.order_num ?? 0) + 1}</span>
										<span class="type">{item.entry.kind}</span>
										<span class="name">{item.label}</span>
											{#if item.entry.kind === 'event' && item.event}
												<span class={`pill pill--${item.event.stage}`}>{eventTypeLabel(item.event.stage)}</span>
											{:else if item.entry.kind === 'location' && item.entry.entry_stage}
												<span class={`pill pill--${item.entry.entry_stage}`}>{eventTypeLabel(item.entry.entry_stage)}</span>
											{:else if item.entry.kind === 'monster' && item.monster?.stage}
											<span class={`pill pill--${item.monster.stage}`}>{getMonsterStageLabel(item.monster.stage)}</span>
										{:else if item.entry.kind === 'stage_completion' && item.stageCompletion?.stage}
											<span class={`pill pill--${item.stageCompletion.stage}`}>{eventTypeLabel(item.stageCompletion.stage)}</span>
										{/if}
									</div>

									<div class="deck-row__actions">
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

										{#if item.entry.kind === 'event' && item.event}
											<Button variant="secondary" onclick={() => openEditEvent(item.event!.id)}>Edit</Button>
										{/if}

										<button class="btn" onclick={() => moveDeckEntry(item.entry.id, 'up')} disabled={idx === 0}>↑</button>
										<button class="btn" onclick={() => moveDeckEntry(item.entry.id, 'down')} disabled={idx === filteredDeckItems.length - 1}>↓</button>
										<button class="btn danger" onclick={() => deleteDeckEntry(item.entry.id)}>✕</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>
		{:else if scenarios.length > 0}
			<div class="empty">Select a scenario.</div>
		{/if}
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
				<FormField label="Title" required>
					<Input type="text" bind:value={eventForm.title} required />
				</FormField>
				<FormField label="Description">
					<Textarea rows={3} bind:value={eventForm.description} />
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
	/* ── Scenario strip ── */
	.scenario-strip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.4rem 0;
		scrollbar-width: thin;
	}

	.scenario-strip__item {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.scenario-strip__chip {
		white-space: nowrap;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #e2e8f0;
		padding: 0.3rem 0.65rem;
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.scenario-strip__chip.selected {
		border-color: rgba(59, 130, 246, 0.55);
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.12);
	}

	/* ── Two-column layout ── */
	.columns {
		display: grid;
		grid-template-columns: 340px 1fr;
		gap: 1rem;
		align-items: start;
	}

	/* ── Left column: scenario info + add forms ── */
	.col-add {
		position: sticky;
		top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.scenario-info {
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.scenario-info__name {
		margin: 0;
		font-size: 1rem;
		font-weight: 800;
		color: #e2e8f0;
	}

	.scenario-info__desc {
		margin: 0;
		color: rgba(226, 232, 240, 0.7);
		font-size: 0.85rem;
		line-height: 1.35;
	}

	.add-forms__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.add-forms__header h4 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 700;
	}

	.add-forms__header-actions {
		display: flex;
		gap: 0.35rem;
	}

	.add-forms {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.add-form {
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.add-form__label {
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(148, 163, 184, 0.85);
	}

	/* ── Right column: deck ── */
	.col-deck {
		min-width: 0;
	}

	.deck-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.65rem;
		flex-wrap: wrap;
	}

	.deck-header__title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.deck-header__title h3 {
		margin: 0;
	}

	.deck-header__controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.deck-search {
		width: 160px;
		padding: 0.4rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
		font-size: 0.85rem;
	}

	.deck-filter {
		padding: 0.4rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.45);
		color: #e2e8f0;
		font-size: 0.85rem;
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

	/* ── Deck list ── */
	.deck-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.deck-row {
		display: grid;
		grid-template-columns: 56px 1fr auto;
		gap: 0.65rem;
		align-items: center;
		background: rgba(15, 23, 42, 0.45);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.45rem 0.65rem;
	}

	.deck-row__thumb {
		width: 56px;
		height: 80px;
		border-radius: 6px;
		overflow: hidden;
		background: rgba(15, 23, 42, 0.35);
		flex-shrink: 0;
	}

	.deck-row__meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		flex-wrap: wrap;
	}

	.pos {
		width: 2rem;
		text-align: right;
		color: rgba(148, 163, 184, 0.9);
		font-weight: 700;
		font-size: 0.85rem;
	}

	.type {
		text-transform: uppercase;
		font-size: 0.68rem;
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
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.btn {
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: rgba(15, 23, 42, 0.55);
		color: #e2e8f0;
		padding: 0.3rem 0.5rem;
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.85rem;
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

	/* ── Responsive ── */
	@media (max-width: 1024px) {
		.columns {
			grid-template-columns: 1fr;
		}

		.col-add {
			position: static;
			max-height: none;
			overflow-y: visible;
		}
	}

	@media (max-width: 640px) {
		.deck-row__thumb {
			width: 44px;
			height: 63px;
		}

		.deck-row {
			grid-template-columns: 44px 1fr;
			gap: 0.5rem;
		}

		.deck-row__actions {
			grid-column: 1 / -1;
			justify-content: flex-end;
		}

		.deck-header {
			flex-direction: column;
			align-items: stretch;
		}

		.deck-header__controls {
			width: 100%;
		}

		.deck-search {
			flex: 1;
			width: auto;
		}
	}

	/* ── Modals (unchanged) ── */
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
