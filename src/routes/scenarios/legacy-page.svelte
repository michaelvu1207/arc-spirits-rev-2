<!-- Legacy scenarios page retained for reference (pre-unified scenario deck). -->
	<script lang="ts">
		import { onMount } from 'svelte';
		import { goto } from '$app/navigation';
		import { supabase } from '$lib/api/supabaseClient';
		import type {
			AbyssScenarioRow,
			EditionRow,
			GameLocationRow,
			MonsterRow,
			ScenarioCardRow,
			StageCardRow,
			TravelerRow
		} from '$lib/types/gameData';
		import { DEFAULT_EVENT_TYPE, EVENT_TYPE_OPTIONS, eventTypeLabel } from '$lib/types/eventTypes';
		import type { EventType } from '$lib/types/eventTypes';
		import {
			DEFAULT_STAGE_EVENT_RENDER_STYLE,
			DEFAULT_STAGE_LOCATION_RENDER_STYLE,
			STAGE_EVENT_RENDER_STYLE_OPTIONS,
			STAGE_LOCATION_RENDER_STYLE_OPTIONS,
			getStageCardRenderStyle,
			setStageCardRenderStyleInData,
			type StageEventRenderStyle,
			type StageLocationRenderStyle
		} from '$lib/types/stageCardStyles';
			import { getErrorMessage } from '$lib/utils';
			import { getMonsterStageLabel } from '$lib/utils/monsterStageLabels';
			import { processAndUploadImage, publicAssetUrl } from '$lib/utils/storage';
			import { generateEventCardPNG, generateEventCardPNGV2, generateEventLocationCardPNG, generateTravelerCardPNG } from '$lib/generators/cards';
			import { getEventCardBackgroundSettingsOverride } from '$lib/types/stageCardStylePresets';
			import { Modal, PageLayout, type Tab } from '$lib/components/layout';
			import CardActionMenu from '$lib/components/CardActionMenu.svelte';
			import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
			import AbyssDeckWorkspace from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
			import StageCardPreview from '$lib/components/scenarios/StageCardPreview.svelte';
			import type {
				DeckOrderItem,
				EventFormData as AbyssEventFormData
			} from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
		import type { StageCard } from '$lib/components/abyss-deck';

			type EditionOption = Pick<EditionRow, 'id' | 'name' | 'is_default'>;
			type ScenarioOption = Pick<AbyssScenarioRow, 'id' | 'name' | 'description' | 'order_num'>;
			type MonsterCatalogEntry = Pick<
				MonsterRow,
				'id' | 'name' | 'stage' | 'order_num' | 'card_image_path' | 'updated_at' | 'icon'
			>;
			type ScenarioCardLink = Pick<
				ScenarioCardRow,
				'id' | 'scenario_id' | 'card_type' | 'card_id' | 'order_num' | 'quantity'
			>;
			type GameLocationOption = Pick<
				GameLocationRow,
				'id' | 'name' | 'background_image_path' | 'updated_at' | 'reward_rows'
			>;
			type TravelerOption = Pick<
				TravelerRow,
				'id' | 'name' | 'state' | 'image_path' | 'card_image_path' | 'updated_at' | 'traveler_description' | 'reward_rows'
			>;

				const tabs: Tab[] = [
					{ id: 'manage', label: 'Manage', icon: '🎭' },
					{ id: 'gallery', label: 'Gallery', icon: '🖼️' },
					{ id: 'styles', label: 'Styles', icon: '🎨' }
				];
				let activeTab = $state('manage');

	const STORAGE_EDITION_KEY = 'arc-spirits-rev2:selected_scenario_edition_id';
	const STORAGE_SCENARIO_KEY = 'arc-spirits-rev2:selected_scenario_id';

	let editions = $state<EditionOption[]>([]);
	let selectedEditionId = $state('');
	let selectedEditionIdSelect = $state('');

		let scenarios = $state<ScenarioOption[]>([]);
		let selectedScenarioId = $state('');

			let monsters = $state<MonsterCatalogEntry[]>([]);
			let scenarioCards = $state<ScenarioCardLink[]>([]);
			let scenarioEvents = $state<StageCard[]>([]);
			let gameLocations = $state<GameLocationOption[]>([]);
			let gameLocationsById = $state<Map<string, GameLocationOption>>(new Map());
			let travelers = $state<TravelerOption[]>([]);
			let travelersById = $state<Map<string, TravelerOption>>(new Map());

		let loading = $state(true);
		let error = $state<string | null>(null);

		let monsterToAddId = $state('');
		let monsterToAddQuantity = $state<number>(1);
		let addingMonster = $state(false);

			let stageLocationToAddId = $state('');
			let stageLocationStage = $state<EventType>(DEFAULT_EVENT_TYPE);
			let stageLocationRenderStyle = $state<StageLocationRenderStyle>(DEFAULT_STAGE_LOCATION_RENDER_STYLE);
			let addingStageLocation = $state(false);

			let travelerToAddId = $state('');
			let addingTraveler = $state(false);

			let stageLocationEditOpen = $state(false);
			let stageLocationEditSaving = $state(false);
			let stageLocationEditId = $state<string | null>(null);
			let stageLocationEditStage = $state<EventType>(DEFAULT_EVENT_TYPE);
			let stageLocationEditRenderStyle = $state<StageLocationRenderStyle>(DEFAULT_STAGE_LOCATION_RENDER_STYLE);

			let eventCreateOpen = $state(false);
			let eventCreateSaving = $state(false);
			let eventCreateForm = $state({
				stage: DEFAULT_EVENT_TYPE as EventType,
				render_style: DEFAULT_STAGE_EVENT_RENDER_STYLE as StageEventRenderStyle,
				title: '',
				description: ''
			});

			let stageCardGallerySearchQuery = $state('');
				let stageCardGalleryKindFilter = $state<'all' | 'event' | 'stage_location' | 'traveler'>('all');
				let stageCardGalleryStatusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
				let selectedStageCardIds = $state<Set<string>>(new Set());
				let generatingStageCardIds = $state<Set<string>>(new Set());
				let stageCardGalleryProgressMessage = $state<string | null>(null);
				let stylePreviewEventCardId = $state<string>('');
				let stylePreviewStageLocationCardId = $state<string>('');

		let scenarioModalOpen = $state(false);
		let scenarioModalSaving = $state(false);
		let scenarioModalMode = $state<'create' | 'edit'>('create');
		let scenarioModalId = $state<string | null>(null);
	let scenarioNameDraft = $state('');
	let scenarioDescriptionDraft = $state('');

	const editionOptions = $derived.by(() => editions.map((e) => ({ value: e.id, label: e.name })));

	const selectedScenario = $derived.by(
		() => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null
	);

		const monsterById = $derived.by(() => new Map(monsters.map((m) => [m.id, m])));
			const scenarioMonsterCards = $derived.by(() =>
			[...scenarioCards]
				.filter((c) => c.card_type === 'monster')
			.sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
	);

	const scenarioStageCardDeckCards = $derived.by(() =>
		[...scenarioCards].filter((c) => c.card_type === 'stage_card').sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
	);

		const includedMonsterIds = $derived.by(() => new Set(scenarioMonsterCards.map((c) => c.card_id)));
		const availableMonsterOptions = $derived.by(() =>
			monsters
				.filter((m) => !includedMonsterIds.has(m.id))
			.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
				.map((m) => ({ value: m.id, label: m.name }))
		);

					const availableStageLocationOptions = $derived.by(() =>
						[...gameLocations]
							.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
							.map((l) => ({ value: l.id, label: l.name }))
					);

					const travelerOptions = $derived.by(() =>
						[...travelers]
							.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' }))
							.map((t) => ({ value: t.id, label: t.name }))
					);

			const filteredScenarioStageCards = $derived.by(() => {
				const term = stageCardGallerySearchQuery.trim().toLowerCase();
				return [...scenarioEvents]
					.filter((card) => {
						if (stageCardGalleryKindFilter !== 'all' && card.card_kind !== stageCardGalleryKindFilter) return false;
						if (stageCardGalleryStatusFilter === 'generated' && !card.card_image_path) return false;
						if (stageCardGalleryStatusFilter === 'not-generated' && card.card_image_path) return false;
						if (!term) return true;
						return (card.title ?? '').toLowerCase().includes(term);
					})
					.sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));
			});

			const scenarioStageCardsGeneratedCount = $derived.by(
				() => scenarioEvents.filter((card) => Boolean(card.card_image_path)).length
			);

			const selectedScenarioStageCardCount = $derived.by(
				() => filteredScenarioStageCards.filter((card) => selectedStageCardIds.has(card.id)).length
			);

			const stageLocationEditCard = $derived.by(() => {
				const id = stageLocationEditId;
				if (!id) return null;
				const card = scenarioEvents.find((c) => c.id === id) ?? null;
				if (!card || card.card_kind !== 'stage_location') return null;
				return card;
			});

				const stageLocationEditGameLocation = $derived.by(() => {
					const card = stageLocationEditCard;
					if (!card) return null;
					const locationId = (card.game_location_id ?? card.id).trim();
					return gameLocationsById.get(locationId) ?? null;
				});

				const stylePreviewEventOptions = $derived.by(() =>
					scenarioEvents
						.filter((card) => card.card_kind === 'event')
						.map((card) => ({
							value: card.id,
							label: `${card.title ?? 'Untitled'} (#${(card.order_num ?? 0) + 1})`
						}))
				);

				const stylePreviewStageLocationOptions = $derived.by(() =>
					scenarioEvents
						.filter((card) => card.card_kind === 'stage_location')
						.map((card) => ({
							value: card.id,
							label: `${card.title ?? 'Untitled'} (#${(card.order_num ?? 0) + 1})`
						}))
				);

				const stylePreviewBaseEvent = $derived.by(() => {
					const selected =
						scenarioEvents.find((card) => card.id === stylePreviewEventCardId && card.card_kind === 'event') ?? null;
					if (selected) return selected;
					return scenarioEvents.find((card) => card.card_kind === 'event') ?? null;
				});

				const stylePreviewBaseStageLocationCard = $derived.by(() => {
					const selected =
						scenarioEvents.find(
							(card) => card.id === stylePreviewStageLocationCardId && card.card_kind === 'stage_location'
						) ?? null;
					if (selected) return selected;
					return scenarioEvents.find((card) => card.card_kind === 'stage_location') ?? null;
				});

				const stylePreviewBaseStageLocation = $derived.by(() => {
					const card = stylePreviewBaseStageLocationCard;
					if (!card) return null;
					const locationId = (card.game_location_id ?? '').trim();
					if (!locationId) return null;
					return gameLocationsById.get(locationId) ?? null;
				});

				type StylePreviewItem = { style: string; label: string; card: StageCard };

				const stylePreviewEventStyles = $derived.by<StylePreviewItem[]>(() => {
					const base = stylePreviewBaseEvent;
					if (!base) return [];
					return STAGE_EVENT_RENDER_STYLE_OPTIONS.map((opt) => ({
						style: opt.value,
						label: opt.label,
						card: {
							...base,
							card_image_path: null,
							data: setStageCardRenderStyleInData(base.data, opt.value)
						} as StageCard
					}));
				});

				const stylePreviewStageLocationStyles = $derived.by<StylePreviewItem[]>(() => {
					const base = stylePreviewBaseStageLocationCard;
					if (!base) return [];
					return STAGE_LOCATION_RENDER_STYLE_OPTIONS.map((opt) => ({
						style: opt.value,
						label: opt.label,
						card: {
							...base,
							card_image_path: null,
							data: setStageCardRenderStyleInData(base.data, opt.value)
						} as StageCard
					}));
				});

				$effect(() => {
					const firstEventId = scenarioEvents.find((c) => c.card_kind === 'event')?.id ?? '';
					const eventSelectionValid =
						stylePreviewEventCardId.length > 0 &&
						scenarioEvents.some((c) => c.id === stylePreviewEventCardId && c.card_kind === 'event');
					if (!eventSelectionValid && stylePreviewEventCardId !== firstEventId) {
						stylePreviewEventCardId = firstEventId;
					}

					const firstStageLocationId = scenarioEvents.find((c) => c.card_kind === 'stage_location')?.id ?? '';
					const stageLocationSelectionValid =
						stylePreviewStageLocationCardId.length > 0 &&
						scenarioEvents.some(
							(c) => c.id === stylePreviewStageLocationCardId && c.card_kind === 'stage_location'
						);
					if (!stageLocationSelectionValid && stylePreviewStageLocationCardId !== firstStageLocationId) {
						stylePreviewStageLocationCardId = firstStageLocationId;
					}
				});

					onMount(() => {
						void loadData();
					});

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

	function normalizeOptionalText(value: string | null | undefined): string | null {
		const trimmed = (value ?? '').trim();
		return trimmed.length > 0 ? trimmed : null;
	}

		function openCreateGameLocation() {
			goto('/game-locations?create=1');
		}

		function openCreateEvent() {
			if (!selectedScenarioId) return;
			eventCreateForm = {
				stage: DEFAULT_EVENT_TYPE,
				render_style: DEFAULT_STAGE_EVENT_RENDER_STYLE,
				title: '',
				description: ''
			};
			eventCreateOpen = true;
		}

			async function createEvent() {
				if (!selectedScenarioId) return;
				if (eventCreateSaving) return;

			const title = eventCreateForm.title.trim();
			if (!title) {
				alert('Event title is required.');
				return;
			}

			eventCreateSaving = true;
			try {
				const now = new Date().toISOString();
				const eventId = crypto.randomUUID();
				const orderNum = scenarioStageCardDeckCards.length;
				const description = normalizeOptionalText(eventCreateForm.description);

				const { error: insertErr } = await supabase.from('stage_cards').insert({
					id: eventId,
					name: eventId,
					card_kind: 'event',
					stage: eventCreateForm.stage,
					title,
					description,
					stage_completion: null,
					image_path: null,
					card_image_path: null,
					reward_rows: [{ type: 'all_players', icon_ids: [] }],
					order_num: orderNum,
					data: setStageCardRenderStyleInData({}, eventCreateForm.render_style),
					updated_at: now
				});
				if (insertErr) throw insertErr;

				const { error: linkErr } = await supabase.from('scenario_cards').insert({
					scenario_id: selectedScenarioId,
					card_type: 'stage_card',
					card_id: eventId,
					order_num: orderNum,
					quantity: 1
				});
				if (linkErr) throw linkErr;

				eventCreateOpen = false;
				await loadScenarioCards();
			} catch (err) {
				alert(`Failed to create event: ${getErrorMessage(err)}`);
				} finally {
					eventCreateSaving = false;
				}
				}
	
				function toggleStageCardSelection(cardId: string) {
					const next = new Set(selectedStageCardIds);
					if (next.has(cardId)) next.delete(cardId);
					else next.add(cardId);
				selectedStageCardIds = next;
			}

			function selectAllFilteredStageCards() {
				selectedStageCardIds = new Set(filteredScenarioStageCards.map((card) => card.id));
			}

			function deselectAllStageCards() {
				selectedStageCardIds = new Set();
			}

			function resetStageCardGalleryTransientState() {
				selectedStageCardIds = new Set();
				generatingStageCardIds = new Set();
				stageCardGalleryProgressMessage = null;
			}

		async function generateStageCardPNG(cardId: string) {
			const card = scenarioEvents.find((c) => c.id === cardId) ?? null;
			if (!card) return;
			if (generatingStageCardIds.has(cardId)) return;

			generatingStageCardIds = new Set([...generatingStageCardIds, cardId]);
			stageCardGalleryProgressMessage = `Generating: ${card.title ?? 'Untitled'}…`;

					try {
						let blob: Blob;
						const cardKind = (card as unknown as { card_kind?: string }).card_kind;
						const renderStyle = getStageCardRenderStyle(card.card_kind, (card as unknown as { data?: unknown }).data);

							if (card.card_kind === 'event') {
								if (renderStyle === 'event_v2') {
									blob = await generateEventCardPNGV2(card as any, (card as any).art_url ?? null);
								} else {
									const bgOverride = getEventCardBackgroundSettingsOverride(renderStyle as any);
									blob = await generateEventCardPNG(card as any, bgOverride);
								}
							} else if (card.card_kind === 'stage_location') {
						const locationId = card.game_location_id;
						const location = locationId ? (gameLocationsById.get(locationId) ?? null) : null;
						const locationImagePath = location?.background_image_path ?? card.image_path ?? null;
						const locationImageUrl = getStorageImageUrl(
							locationImagePath,
							location?.updated_at ?? card.updated_at ?? undefined
						);

						if (!locationImageUrl) {
							throw new Error('Stage location is missing a background image.');
						}

						blob = await generateEventLocationCardPNG({
							locationImageUrl,
								title: location?.name ?? card.title,
								rewardRows: location?.reward_rows ?? null,
								renderStyle
							});
						} else if (card.card_kind === 'traveler') {
							const travelerId = (card as unknown as { traveler_id?: string | null }).traveler_id ?? null;
							if (!travelerId) throw new Error('Traveler stage card is missing traveler_id.');
							const { data: traveler, error: travelerErr } = await supabase
								.from('travelers')
								.select('*')
								.eq('id', travelerId)
								.single();
							if (travelerErr) throw travelerErr;

							const travelerImagePath = (traveler as any).image_path as string | null;
							const travelerUpdatedAt = (traveler as any).updated_at as string | null;
							const artPath = travelerImagePath
								? travelerImagePath.startsWith('travelers/')
									? travelerImagePath
									: `travelers/${travelerImagePath}`
								: null;
							const travelerWithUrls = {
								...(traveler as any),
								art_url: artPath ? publicAssetUrl(artPath, { updatedAt: travelerUpdatedAt ?? undefined }) : null
							};

							blob = await generateTravelerCardPNG(travelerWithUrls);
						} else {
							throw new Error(`Unsupported stage card kind: ${cardKind ?? 'unknown'}`);
						}

					const travelerId = card.card_kind === 'traveler' ? ((card as any).traveler_id as string | null) : null;
					const folder = card.card_kind === 'traveler' ? 'traveler_cards' : 'card_images/stage_cards/en';
					const { data, error: uploadErr } = await processAndUploadImage(blob, {
						folder,
						filename: card.card_kind === 'traveler' && travelerId ? travelerId : cardId,
						cropTransparent: card.card_kind === 'traveler',
						upsert: true
					});
					if (uploadErr) throw uploadErr;
					const uploadedPath = (data?.path ?? '').trim();
					if (!uploadedPath) throw new Error('Failed to upload PNG (missing storage path).');

					const updatedAt = new Date().toISOString();
					const { error: updateErr } = await supabase
						.from('stage_cards')
						.update({ card_image_path: uploadedPath, updated_at: updatedAt })
						.eq('id', cardId);
					if (updateErr) throw updateErr;

					scenarioEvents = scenarioEvents.map((c) => {
						if (c.id !== cardId) return c;
						if (c.card_kind === 'stage_location') {
							return {
								...c,
								card_image_path: uploadedPath,
								updated_at: updatedAt,
								art_url: getStorageImageUrl(uploadedPath, updatedAt)
							} as StageCard;
						}
						if (c.card_kind === 'traveler') {
							return {
								...c,
								card_image_path: uploadedPath,
								updated_at: updatedAt,
								art_url: getStorageImageUrl(uploadedPath, updatedAt)
							} as StageCard;
						}
						return { ...c, card_image_path: uploadedPath, updated_at: updatedAt } as StageCard;
					});

					stageCardGalleryProgressMessage = `✓ Generated PNG: ${card.title ?? 'Untitled'}`;
				} catch (err) {
					stageCardGalleryProgressMessage = `✗ Failed: ${card.title ?? 'Untitled'}`;
					alert(`Failed to generate stage card PNG: ${getErrorMessage(err)}`);
				} finally {
					const next = new Set(generatingStageCardIds);
					next.delete(cardId);
					generatingStageCardIds = next;
				}
			}

			async function generateSelectedStageCardPNGs() {
				const targets = filteredScenarioStageCards.filter((card) => selectedStageCardIds.has(card.id));
				if (targets.length === 0) {
					alert('No stage cards selected.');
					return;
				}

				if (!confirm(`Generate PNGs for ${targets.length} selected stage card${targets.length === 1 ? '' : 's'}?`)) {
					return;
				}

				for (let i = 0; i < targets.length; i++) {
					const card = targets[i];
					stageCardGalleryProgressMessage = `Generating ${i + 1}/${targets.length}: ${card.title ?? 'Untitled'}…`;
					await generateStageCardPNG(card.id);
				}

				stageCardGalleryProgressMessage = `✓ Generated ${targets.length} stage card PNG${targets.length === 1 ? '' : 's'}`;
				deselectAllStageCards();
			}

			async function generateAllStageCardPNGs() {
				const targets = filteredScenarioStageCards;
				if (targets.length === 0) return;

				if (!confirm(`Generate PNGs for all ${targets.length} stage card${targets.length === 1 ? '' : 's'}?`)) {
					return;
				}

				for (let i = 0; i < targets.length; i++) {
					const card = targets[i];
					stageCardGalleryProgressMessage = `Generating ${i + 1}/${targets.length}: ${card.title ?? 'Untitled'}…`;
					await generateStageCardPNG(card.id);
				}

				stageCardGalleryProgressMessage = `✓ Generated ${targets.length} stage card PNG${targets.length === 1 ? '' : 's'}`;
			}

		// Reserved for future multi-tab controls

		async function loadData() {
			loading = true;
			error = null;
			try {
				const [
					{ data: editionsData, error: editionsErr },
					{ data: monstersData, error: monstersErr },
					{ data: gameLocationsData, error: gameLocationsErr },
					{ data: travelersData, error: travelersErr }
				] =
						await Promise.all([
							supabase.from('editions').select('id, name, is_default').order('name', { ascending: true }),
							supabase
								.from('monsters')
								.select('id, name, stage, order_num, card_image_path, updated_at, icon')
								.order('name', { ascending: true }),
							supabase
								.from('game_locations')
								.select('id, name, background_image_path, updated_at, reward_rows')
								.order('name', { ascending: true })
							,
							supabase
								.from('travelers')
								.select('id, name, state, image_path, card_image_path, updated_at, traveler_description, reward_rows')
								.order('name', { ascending: true })
					]);

				if (editionsErr) throw editionsErr;
				if (monstersErr) throw monstersErr;
				if (gameLocationsErr) throw gameLocationsErr;
				if (travelersErr) throw travelersErr;

				editions = (editionsData ?? []) as EditionOption[];
				monsters = (monstersData ?? []) as MonsterCatalogEntry[];
				gameLocations = (gameLocationsData ?? []) as GameLocationOption[];
				gameLocationsById = new Map(gameLocations.map((loc) => [loc.id, loc]));
				travelers = (travelersData ?? []) as TravelerOption[];
				travelersById = new Map(travelers.map((t) => [t.id, t]));

				const storedEditionId = getStored(STORAGE_EDITION_KEY);
				const defaultEditionId = editions.find((e) => e.is_default)?.id ?? editions[0]?.id ?? '';
				selectedEditionId = storedEditionId && editions.some((e) => e.id === storedEditionId) ? storedEditionId : defaultEditionId;
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
				scenarioCards = [];
				scenarioEvents = [];
				return;
			}

		const { data, error: scenariosErr } = await supabase
			.from('abyss_scenarios')
			.select('id, name, description, order_num')
			.eq('edition_id', selectedEditionId)
			.order('order_num', { ascending: true });
		if (scenariosErr) throw scenariosErr;

		scenarios = (data ?? []) as ScenarioOption[];

		const storedScenarioId = getStored(STORAGE_SCENARIO_KEY);
		const fallbackScenarioId = scenarios[0]?.id ?? '';
		selectedScenarioId =
			storedScenarioId && scenarios.some((s) => s.id === storedScenarioId) ? storedScenarioId : fallbackScenarioId;
		setStored(STORAGE_SCENARIO_KEY, selectedScenarioId || null);

			await loadScenarioCards();
		}

		function getEventArtUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
			if (!imagePath) return null;
			const path = imagePath.startsWith('events/') ? imagePath : `events/${imagePath}`;
			return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
		}

		function getStorageImageUrl(path: string | null | undefined, updatedAt?: string | null): string | null {
			if (!path) return null;
			return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
		}

		async function loadScenarioEvents() {
			const cardLinks = scenarioStageCardDeckCards;
			if (!selectedScenarioId || cardLinks.length === 0) {
				scenarioEvents = [];
				return;
			}

			const stageCardIds = cardLinks.map((link) => link.card_id);
			const { data: stageCardsData, error: stageCardsErr } = await supabase
				.from('stage_cards')
				.select('*')
				.in('id', stageCardIds);
			if (stageCardsErr) throw stageCardsErr;

			const stageCardsById = new Map<string, StageCardRow>((stageCardsData ?? []).map((card: any) => [card.id, card as StageCardRow]));

			scenarioEvents = cardLinks
				.map((link) => {
					const card = stageCardsById.get(link.card_id);
					if (!card) return null;

					if (card.card_kind === 'event') {
						return {
							...card,
							order_num: link.order_num ?? 0,
							art_url: getEventArtUrl(card.image_path, card.updated_at)
						} as StageCard;
					}

					if (card.card_kind === 'traveler') {
						const travelerId = (card as { traveler_id?: string | null }).traveler_id ?? null;
						const traveler = travelerId ? (travelersById.get(travelerId) ?? null) : null;
						const cardPath = card.card_image_path ?? traveler?.card_image_path ?? null;
						const updatedAt = card.card_image_path ? (card.updated_at ?? null) : (traveler?.updated_at ?? null);

						return {
							...card,
							title: traveler?.name ?? card.title,
							description: traveler?.traveler_description ?? card.description ?? null,
							card_image_path: cardPath,
							order_num: link.order_num ?? 0,
							art_url: getStorageImageUrl(cardPath, updatedAt)
						} as StageCard;
					}

					const locationId = (card as { game_location_id?: string | null }).game_location_id ?? null;
					const location = locationId ? gameLocationsById.get(locationId) ?? null : null;

					const title = location?.name ?? card.title;
					const cardPath =
						card.card_image_path ?? location?.background_image_path ?? card.image_path ?? null;
					const updatedAt = card.card_image_path ? (card.updated_at ?? null) : (location?.updated_at ?? null);

					return {
						...card,
						title,
						order_num: link.order_num ?? 0,
						art_url: getStorageImageUrl(cardPath, updatedAt)
					} as StageCard;
				})
				.filter((e): e is StageCard => e !== null);
		}

		async function loadScenarioCards() {
			if (!selectedScenarioId) {
				scenarioCards = [];
				scenarioEvents = [];
				return;
			}

		const { data, error: cardsErr } = await supabase
			.from('scenario_cards')
			.select('id, scenario_id, card_type, card_id, order_num, quantity')
			.eq('scenario_id', selectedScenarioId)
			.order('order_num', { ascending: true });
		if (cardsErr) throw cardsErr;

			scenarioCards = (data ?? []) as ScenarioCardLink[];
			await loadScenarioEvents();
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
		resetStageCardGalleryTransientState();
		void loadScenarios();
	}

		function selectScenario(scenarioId: string) {
			if (scenarioId === selectedScenarioId) return;
			if (!scenarios.some((s) => s.id === scenarioId)) return;

			selectedScenarioId = scenarioId;
			setStored(STORAGE_SCENARIO_KEY, scenarioId);
			resetStageCardGalleryTransientState();
			void loadScenarioCards();
		}

	function openCreateScenario() {
		if (!selectedEditionId) return;
		scenarioModalMode = 'create';
		scenarioModalId = null;
		scenarioNameDraft = '';
		scenarioDescriptionDraft = '';
		scenarioModalOpen = true;
	}

	function openEditScenario(scenario: ScenarioOption) {
		scenarioModalMode = 'edit';
		scenarioModalId = scenario.id;
		scenarioNameDraft = scenario.name ?? '';
		scenarioDescriptionDraft = scenario.description ?? '';
		scenarioModalOpen = true;
	}

	async function saveScenario() {
		if (!selectedEditionId) return;
		if (scenarioModalSaving) return;

		const name = scenarioNameDraft.trim();
		if (!name) {
			alert('Scenario name is required.');
			return;
		}

		scenarioModalSaving = true;
		try {
			const description = normalizeOptionalText(scenarioDescriptionDraft);

			if (scenarioModalMode === 'create') {
				const nextOrderNum = scenarios.reduce((max, s) => Math.max(max, s.order_num ?? 0), -1) + 1;
				const { data, error: insertErr } = await supabase
					.from('abyss_scenarios')
					.insert({ edition_id: selectedEditionId, name, description, order_num: nextOrderNum })
					.select('id')
					.single();
				if (insertErr) throw insertErr;

				const createdId = data?.id as string | undefined;
				await loadScenarios();
				if (createdId) selectScenario(createdId);
			} else if (scenarioModalId) {
				const { error: updateErr } = await supabase
					.from('abyss_scenarios')
					.update({ name, description })
					.eq('id', scenarioModalId);
				if (updateErr) throw updateErr;
				await loadScenarios();
				selectScenario(scenarioModalId);
			}

			scenarioModalOpen = false;
		} catch (err) {
			alert(`Failed to save scenario: ${getErrorMessage(err)}`);
		} finally {
			scenarioModalSaving = false;
		}
	}

	async function deleteScenario(scenario: ScenarioOption) {
		const ok = confirm(`Delete scenario "${scenario.name}"? This removes its monster/stage-card assignments.`);
		if (!ok) return;

		try {
			const { error: deleteErr } = await supabase.from('abyss_scenarios').delete().eq('id', scenario.id);
			if (deleteErr) throw deleteErr;

			if (selectedScenarioId === scenario.id) {
				selectedScenarioId = '';
				setStored(STORAGE_SCENARIO_KEY, null);
			}

			await loadScenarios();
		} catch (err) {
			alert(`Failed to delete scenario: ${getErrorMessage(err)}`);
		}
	}

	async function setScenarioMonsterCardOrder(ordered: ScenarioCardLink[]) {
		if (!selectedScenarioId) return;
		const updates = ordered.map((card, idx) => ({
			scenario_id: selectedScenarioId,
			card_type: 'monster' as const,
			card_id: card.card_id,
			order_num: idx,
			quantity: Math.max(1, Math.trunc(Number(card.quantity ?? 1)))
		}));

		if (updates.length === 0) return;
		const { error: upsertErr } = await supabase
			.from('scenario_cards')
			.upsert(updates, { onConflict: 'scenario_id,card_type,card_id' });
		if (upsertErr) throw upsertErr;
	}

	async function moveScenarioMonsterCard(cardId: string, direction: 'up' | 'down') {
		const current = scenarioMonsterCards;
		const idx = current.findIndex((c) => c.id === cardId);
		if (idx < 0) return;
		const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
		if (targetIdx < 0 || targetIdx >= current.length) return;

		const next = [...current];
		const [moved] = next.splice(idx, 1);
		next.splice(targetIdx, 0, moved);

		try {
			await setScenarioMonsterCardOrder(next);
			await loadScenarioCards();
		} catch (err) {
			alert(`Failed to reorder monster cards: ${getErrorMessage(err)}`);
		}
	}

	async function removeScenarioMonsterCard(cardId: string) {
		if (!selectedScenarioId) return;
		const ok = confirm('Remove this monster card from the scenario?');
		if (!ok) return;

		try {
			const { error: deleteErr } = await supabase
				.from('scenario_cards')
				.delete()
				.eq('scenario_id', selectedScenarioId)
				.eq('card_type', 'monster')
				.eq('card_id', cardId);
			if (deleteErr) throw deleteErr;

			await loadScenarioCards();

			// normalize ordering (remove gaps)
			await setScenarioMonsterCardOrder(scenarioMonsterCards);
			await loadScenarioCards();
		} catch (err) {
			alert(`Failed to remove monster card: ${getErrorMessage(err)}`);
		}
	}

	async function addMonsterToScenario() {
		if (!selectedScenarioId) return;
		if (addingMonster) return;
		const monsterId = monsterToAddId.trim();
		if (!monsterId) return;

		addingMonster = true;
		try {
			const quantity = Math.max(1, Math.trunc(Number(monsterToAddQuantity ?? 1)));
			const orderNum = scenarioMonsterCards.length;
			const { error: insertErr } = await supabase.from('scenario_cards').insert({
				scenario_id: selectedScenarioId,
				card_type: 'monster',
				card_id: monsterId,
				order_num: orderNum,
				quantity
			});
			if (insertErr) throw insertErr;

			monsterToAddId = '';
			monsterToAddQuantity = 1;
			await loadScenarioCards();
		} catch (err) {
			alert(`Failed to add monster: ${getErrorMessage(err)}`);
		} finally {
			addingMonster = false;
		}
	}

		async function addStageLocationToScenario() {
			if (!selectedScenarioId) return;
			if (addingStageLocation) return;
			const gameLocationId = stageLocationToAddId.trim();
			if (!gameLocationId) return;

			const location = gameLocationsById.get(gameLocationId) ?? null;
			if (!location) {
				alert('Select a valid game location first.');
				return;
			}

			addingStageLocation = true;
			try {
				const stageCardId = crypto.randomUUID();
				const now = new Date().toISOString();
				const { error: insertCardErr } = await supabase.from('stage_cards').insert({
					id: stageCardId,
					name: stageCardId,
					card_kind: 'stage_location',
					game_location_id: gameLocationId,
					stage: stageLocationStage,
					title: location.name,
					description: null,
					image_path: location.background_image_path ?? null,
					card_image_path: null,
					reward_rows: [],
					stage_completion: null,
					order_num: 0,
					data: setStageCardRenderStyleInData({}, stageLocationRenderStyle),
					updated_at: now
				});
				if (insertCardErr) throw insertCardErr;

				const order_num = scenarioStageCardDeckCards.length;
				const { error: insertErr } = await supabase.from('scenario_cards').insert({
					scenario_id: selectedScenarioId,
					card_type: 'stage_card',
					card_id: stageCardId,
					order_num,
					quantity: 1
				});
				if (insertErr) throw insertErr;

				await loadScenarioCards();
			} catch (err) {
				alert(`Failed to add stage location: ${getErrorMessage(err)}`);
			} finally {
				addingStageLocation = false;
			}
		}

		function travelerStateToStage(state: TravelerOption['state'] | null | undefined): EventType {
			switch (state) {
				case 'tainted':
					return 'stage_1';
				case 'corrupt':
					return 'stage_2';
				case 'fallen':
					return 'stage_3';
				case 'boss':
					return 'final_stage';
				default:
					return 'stage_1';
			}
		}

		async function addTravelerToScenario() {
			if (!selectedScenarioId) return;
			if (addingTraveler) return;
			const travelerId = travelerToAddId.trim();
			if (!travelerId) return;

			const traveler = travelersById.get(travelerId) ?? null;
			if (!traveler) {
				alert('Select a valid traveler first.');
				return;
			}

			addingTraveler = true;
			try {
				const stageCardId = crypto.randomUUID();
				const now = new Date().toISOString();
				const { error: insertCardErr } = await supabase.from('stage_cards').insert({
					id: stageCardId,
					name: stageCardId,
					card_kind: 'traveler',
					traveler_id: travelerId,
					game_location_id: null,
					stage: travelerStateToStage(traveler.state),
					title: traveler.name,
					description: traveler.traveler_description ?? null,
					image_path: traveler.image_path ?? null,
					card_image_path: traveler.card_image_path ?? null,
					reward_rows: [],
					stage_completion: null,
					order_num: 0,
					data: {},
					updated_at: now
				});
				if (insertCardErr) throw insertCardErr;

				const order_num = scenarioStageCardDeckCards.length;
				const { error: insertErr } = await supabase.from('scenario_cards').insert({
					scenario_id: selectedScenarioId,
					card_type: 'stage_card',
					card_id: stageCardId,
					order_num,
					quantity: 1
				});
				if (insertErr) throw insertErr;

				travelerToAddId = '';
				await loadScenarioCards();
			} catch (err) {
				alert(`Failed to add traveler: ${getErrorMessage(err)}`);
			} finally {
				addingTraveler = false;
			}
		}

		function openStageLocationEdit(stageCardId: string) {
			const id = (stageCardId ?? '').trim();
			if (!id) return;

			const card = scenarioEvents.find((c) => c.id === id) ?? null;
			if (!card || card.card_kind !== 'stage_location') {
				alert('Stage location card not found.');
				return;
			}

			stageLocationEditId = id;
			stageLocationEditStage = card.stage ?? DEFAULT_EVENT_TYPE;
			stageLocationEditRenderStyle = getStageCardRenderStyle('stage_location', (card as unknown as { data?: unknown }).data) as StageLocationRenderStyle;
			stageLocationEditOpen = true;
		}

		async function saveStageLocationEdit() {
			const id = stageLocationEditId;
			if (!selectedScenarioId) return;
			if (!id) return;
			if (stageLocationEditSaving) return;

			stageLocationEditSaving = true;
			try {
				const now = new Date().toISOString();
				const nextData = setStageCardRenderStyleInData(stageLocationEditCard?.data, stageLocationEditRenderStyle);
				const { error: updateErr } = await supabase
					.from('stage_cards')
					.update({ stage: stageLocationEditStage, data: nextData, updated_at: now })
					.eq('id', id)
					.eq('card_kind', 'stage_location');
				if (updateErr) throw updateErr;

				stageLocationEditOpen = false;
				stageLocationEditId = null;
				await loadScenarioCards();
			} catch (err) {
				alert(`Failed to update stage location card: ${getErrorMessage(err)}`);
			} finally {
				stageLocationEditSaving = false;
			}
		}

		async function updateMonsterQuantity(monsterId: string, nextRaw: string) {
			if (!selectedScenarioId) return;
			const next = Math.max(1, Math.trunc(Number(nextRaw)));
			if (!Number.isFinite(next)) return;

		try {
			const { error: updateErr } = await supabase
				.from('scenario_cards')
				.update({ quantity: next })
				.eq('scenario_id', selectedScenarioId)
				.eq('card_type', 'monster')
				.eq('card_id', monsterId);
			if (updateErr) throw updateErr;
			await loadScenarioCards();
		} catch (err) {
				alert(`Failed to update quantity: ${getErrorMessage(err)}`);
			}
		}

		async function handleWorkspaceMonsterSave(_formData: unknown, _id: string | null): Promise<string> {
			throw new Error('Monster cards are managed in the Monster Cards page.');
		}

		async function handleWorkspaceMonsterDelete(_id: string): Promise<void> {
			throw new Error('Monster cards are managed in the Monster Cards page.');
		}

		async function handleScenarioEventSave(formData: AbyssEventFormData, id: string | null): Promise<string> {
			if (!selectedScenarioId) {
				throw new Error('Select a scenario first.');
			}

			if (!formData.title.trim()) {
				throw new Error('Event title is required.');
			}

			const now = new Date().toISOString();
				const orderNum = Math.max(0, Math.trunc(Number(formData.order_num ?? 0)));
				const existingCard = id ? (scenarioEvents.find((c) => c.id === id) ?? null) : null;
				const nextData = setStageCardRenderStyleInData(
					existingCard?.data,
					formData.render_style ?? DEFAULT_STAGE_EVENT_RENDER_STYLE
				);

			let eventId: string;
			if (id) {
				const { error: updateErr } = await supabase
					.from('stage_cards')
					.update({
						name: id,
						card_kind: 'event',
						stage: formData.event_type,
						title: formData.title,
						description: formData.description,
						stage_completion: formData.stage_completion ?? null,
						image_path: formData.image_path,
						reward_rows: formData.reward_rows,
						order_num: orderNum,
						data: nextData,
						updated_at: now
					})
					.eq('id', id);
				if (updateErr) throw updateErr;
				eventId = id;
			} else {
				const newEventId = crypto.randomUUID();
				const { data, error: insertErr } = await supabase
					.from('stage_cards')
					.insert({
						id: newEventId,
						name: newEventId,
						card_kind: 'event',
						stage: formData.event_type,
						data: nextData,
						title: formData.title,
						description: formData.description,
						stage_completion: formData.stage_completion ?? null,
						image_path: formData.image_path,
						reward_rows: formData.reward_rows,
						order_num: orderNum,
						updated_at: now
					})
					.select('id')
					.single();
				if (insertErr) throw insertErr;
				eventId = data.id as string;

				const { error: linkErr } = await supabase.from('scenario_cards').insert({
					scenario_id: selectedScenarioId,
					card_type: 'stage_card',
					card_id: eventId,
					order_num: scenarioStageCardDeckCards.length,
					quantity: 1
				});
				if (linkErr) throw linkErr;
			}

			await loadScenarioCards();
			return eventId;
		}

		async function handleScenarioEventDelete(eventId: string): Promise<void> {
			if (!selectedScenarioId) return;

			const { error: unlinkErr } = await supabase
				.from('scenario_cards')
				.delete()
				.eq('scenario_id', selectedScenarioId)
				.eq('card_type', 'stage_card')
				.eq('card_id', eventId);
			if (unlinkErr) throw unlinkErr;

			const cardKind = scenarioEvents.find((card) => card.id === eventId)?.card_kind ?? null;
			if (cardKind === 'event' || cardKind === 'stage_location' || cardKind === 'traveler') {
				const { error: deleteErr } = await supabase.from('stage_cards').delete().eq('id', eventId);
				if (deleteErr) throw deleteErr;
			}

			await loadScenarioCards();
			await saveScenarioStageCardOrder(scenarioStageCardDeckCards.map((link) => ({ type: 'event', id: link.card_id })));
		}

		async function saveScenarioStageCardOrder(order: DeckOrderItem[]) {
			if (!selectedScenarioId) return;

			const orderedIds = order.filter((item) => item.type === 'event').map((item) => item.id);

			const updates = orderedIds.map((id, order_num) => ({
				scenario_id: selectedScenarioId,
				card_type: 'stage_card' as const,
				card_id: id,
				order_num,
				quantity: 1 as const
			}));

			if (updates.length === 0) return;
			const { error: upsertErr } = await supabase
				.from('scenario_cards')
				.upsert(updates, { onConflict: 'scenario_id,card_type,card_id' });
			if (upsertErr) throw upsertErr;

			await loadScenarioCards();
		}
	</script>

<PageLayout
	title="Scenarios"
	subtitle="Assign monster and stage cards per edition"
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
			<aside class="sidebar">
				<div class="sidebar-header">
					<h3>Scenarios</h3>
					<span class="count">{scenarios.length}</span>
				</div>

				{#if scenarios.length === 0}
					<div class="empty">No scenarios yet.</div>
				{:else}
					<ul class="scenario-list">
						{#each scenarios as scenario (scenario.id)}
							<li class="scenario-item-row">
								<button
									class="scenario-item"
									class:selected={scenario.id === selectedScenarioId}
									onclick={() => selectScenario(scenario.id)}
								>
									<span class="scenario-name">{scenario.name}</span>
								</button>
								<CardActionMenu onEdit={() => openEditScenario(scenario)} onDelete={() => deleteScenario(scenario)} />
							</li>
						{/each}
					</ul>
				{/if}
			</aside>

			<main class="content">
				{#if selectedScenario}
					<div class="scenario-header">
						<div class="scenario-header__title">
							<h2>{selectedScenario.name}</h2>
							{#if selectedScenario.description}
								<p class="muted">{selectedScenario.description}</p>
							{/if}
						</div>
						<Button variant="secondary" onclick={() => openEditScenario(selectedScenario)}>Edit</Button>
					</div>

					{#if activeTab === 'manage'}
						<section class="section">
							<div class="section-header">
								<h3>Monster Cards</h3>
								<span class="badge">{scenarioMonsterCards.length}</span>
							</div>

							<div class="add-row">
								<FormField label="Add monster">
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
								<Button
									variant="primary"
									onclick={addMonsterToScenario}
									disabled={addingMonster || monsterToAddId.trim().length === 0}
								>
									{addingMonster ? 'Adding…' : 'Add'}
								</Button>
							</div>

							{#if scenarioMonsterCards.length === 0}
								<div class="empty">No monster cards assigned.</div>
							{:else}
								<ul class="card-list">
									{#each scenarioMonsterCards as card, idx (card.id)}
										{@const monster = monsterById.get(card.card_id)}
										<li class="card-row">
											<div class="card-row__meta">
													<span class="pos">#{idx + 1}</span>
													<span class="name">{monster?.name ?? 'Unknown Monster'}</span>
													{#if monster?.stage}
														<span class={`pill pill--${monster.stage}`}>{getMonsterStageLabel(monster.stage)}</span>
													{/if}
												</div>
												<div class="card-row__actions">
													<Input
													type="number"
													min={1}
													step={1}
													value={String(card.quantity ?? 1)}
													onblur={(e) => updateMonsterQuantity(card.card_id, (e.target as HTMLInputElement).value)}
												/>
												<button class="btn" onclick={() => moveScenarioMonsterCard(card.id, 'up')} disabled={idx === 0}>
													↑
												</button>
												<button
													class="btn"
													onclick={() => moveScenarioMonsterCard(card.id, 'down')}
													disabled={idx === scenarioMonsterCards.length - 1}
												>
													↓
												</button>
												<button class="btn danger" onclick={() => removeScenarioMonsterCard(card.card_id)}>Remove</button>
											</div>
										</li>
									{/each}
								</ul>
							{/if}
						</section>

						<section class="section">
							<div class="section-header">
								<div class="section-header__title">
									<h3>Stage Cards</h3>
									<span class="badge">{scenarioStageCardDeckCards.length}</span>
								</div>
								<div class="section-header__actions">
									<Button variant="primary" onclick={openCreateEvent} disabled={!selectedScenarioId}>+ Event</Button>
									<Button variant="secondary" onclick={openCreateGameLocation}>+ Game Location</Button>
								</div>
							</div>

							{#if !selectedScenarioId}
								<div class="empty">Select a scenario to manage stage cards.</div>
							{:else}
								<div class="add-row">
									<FormField label="Add stage location">
										<Select
											bind:value={stageLocationToAddId}
											options={availableStageLocationOptions}
											placeholder={
												availableStageLocationOptions.length === 0 ? 'No game locations available' : 'Select location'
											}
											disabled={addingStageLocation || availableStageLocationOptions.length === 0}
										/>
									</FormField>
									<FormField label="Stage">
										<Select
											bind:value={stageLocationStage}
											options={EVENT_TYPE_OPTIONS}
											disabled={addingStageLocation || stageLocationToAddId.trim().length === 0}
										/>
									</FormField>
									<FormField label="Style">
										<Select
											bind:value={stageLocationRenderStyle}
											options={STAGE_LOCATION_RENDER_STYLE_OPTIONS}
											disabled={addingStageLocation || stageLocationToAddId.trim().length === 0}
										/>
									</FormField>
									<Button
										variant="primary"
										onclick={addStageLocationToScenario}
										disabled={addingStageLocation || stageLocationToAddId.trim().length === 0}
									>
										{addingStageLocation ? 'Adding…' : 'Add'}
									</Button>
								</div>
								<div class="add-row">
									<FormField label="Add traveler">
										<Select
											bind:value={travelerToAddId}
											options={travelerOptions}
											placeholder={travelerOptions.length === 0 ? 'No travelers available' : 'Select traveler'}
											disabled={addingTraveler || travelerOptions.length === 0}
										/>
									</FormField>
									<Button
										variant="primary"
										onclick={addTravelerToScenario}
										disabled={addingTraveler || travelerToAddId.trim().length === 0}
									>
										{addingTraveler ? 'Adding…' : 'Add'}
									</Button>
								</div>
								<AbyssDeckWorkspace
									monsters={[]}
									events={scenarioEvents}
									locations={[]}
									specialEffects={[]}
									monsterSpecialEffects={{}}
									onMonsterSave={handleWorkspaceMonsterSave}
									onMonsterDelete={handleWorkspaceMonsterDelete}
									onEventSave={handleScenarioEventSave}
									onEventDelete={handleScenarioEventDelete}
									onEventLocationEdit={(id) => {
										openStageLocationEdit(id);
									}}
									onSaveDeckOrder={saveScenarioStageCardOrder}
									defaultShowCardPreviews={false}
									showMonsters={false}
									showEvents={true}
									showStats={false}
									showInvadeLocation={false}
									showSpecialEffects={false}
									showRewardRows={false}
									showEventRewardRows={true}
									enableOrdering={true}
								/>
							{/if}
						</section>
					{:else if activeTab === 'gallery'}
						<section class="section">
							<div class="section-header">
								<div class="section-header__title">
									<h3>Scenario Gallery</h3>
									<span class="badge">{scenarioMonsterCards.length + scenarioStageCardDeckCards.length}</span>
									<span class="badge">{scenarioStageCardsGeneratedCount}/{scenarioStageCardDeckCards.length} PNGs</span>
								</div>
							</div>

							<div class="gallery-controls">
								<div class="gallery-filters">
									<input
										type="text"
										class="gallery-search"
										placeholder="Search stage cards…"
										bind:value={stageCardGallerySearchQuery}
									/>
									<select class="gallery-select" bind:value={stageCardGalleryKindFilter}>
										<option value="all">All Kinds</option>
										<option value="event">Events</option>
										<option value="stage_location">Stage Locations</option>
										<option value="traveler">Travelers</option>
									</select>
									<select class="gallery-select" bind:value={stageCardGalleryStatusFilter}>
										<option value="all">All Status</option>
										<option value="generated">Generated PNG</option>
										<option value="not-generated">Not Generated</option>
									</select>
								</div>

								<div class="gallery-actions">
									{#if selectedScenarioStageCardCount > 0}
										<Button variant="secondary" onclick={deselectAllStageCards} disabled={generatingStageCardIds.size > 0}>
											Deselect All
										</Button>
										<Button
											variant="primary"
											onclick={generateSelectedStageCardPNGs}
											disabled={generatingStageCardIds.size > 0}
										>
											Generate Selected ({selectedScenarioStageCardCount})
										</Button>
									{:else}
										<Button
											variant="secondary"
											onclick={selectAllFilteredStageCards}
											disabled={filteredScenarioStageCards.length === 0 || generatingStageCardIds.size > 0}
										>
											Select All ({filteredScenarioStageCards.length})
										</Button>
									{/if}
									<Button
										variant="primary"
										onclick={generateAllStageCardPNGs}
										disabled={filteredScenarioStageCards.length === 0 || generatingStageCardIds.size > 0}
									>
										Generate All
									</Button>
								</div>
							</div>

							{#if stageCardGalleryProgressMessage}
								<div class="gallery-progress">{stageCardGalleryProgressMessage}</div>
							{/if}

							<div class="gallery-grid">
								{#each filteredScenarioStageCards as card (card.id)}
										{@const isSelected = selectedStageCardIds.has(card.id)}
										{@const isGenerating = generatingStageCardIds.has(card.id)}
										{@const hasCardImage = Boolean(card.card_image_path)}
										{@const stageLocation = card.card_kind === 'stage_location' ? (gameLocationsById.get(card.game_location_id) ?? null) : null}

										<div class="gallery-card" class:selected={isSelected}>
											<div class="gallery-checkbox">
												<input
													type="checkbox"
												checked={isSelected}
												onchange={() => toggleStageCardSelection(card.id)}
												disabled={isGenerating}
											/>
											</div>

											<div class="gallery-preview">
												<StageCardPreview card={card} location={stageLocation} />
												{#if hasCardImage}
													<div class="gallery-status generated" title="PNG generated">✓</div>
												{/if}

												{#if isGenerating}
													<div class="gallery-generating">
														<div class="spinner" aria-hidden="true"></div>
													</div>
											{/if}
										</div>

											<div class="gallery-info">
											<div class="gallery-info__header">
												<h4 class="gallery-name">{card.title}</h4>
												<span class="gallery-badge">
													{card.card_kind === 'event' ? 'Event' : card.card_kind === 'traveler' ? 'Traveler' : 'Location'}
												</span>
											</div>
											<div class="gallery-meta">
												<span class={`pill pill--${card.stage}`}>{eventTypeLabel(card.stage)}</span>
											</div>
											<div class="gallery-info__footer">
												<span class="gallery-order">#{(card.order_num ?? 0) + 1}</span>
												<Button
													variant="secondary"
													onclick={() => generateStageCardPNG(card.id)}
													disabled={isGenerating}
												>
													{isGenerating ? 'Generating…' : hasCardImage ? 'Regenerate' : 'Generate'}
												</Button>
											</div>
										</div>
									</div>
								{/each}
							</div>

							{#if filteredScenarioStageCards.length === 0}
								<div class="empty">No stage cards match the current filters.</div>
							{/if}

							<div class="gallery-divider" aria-hidden="true"></div>

							<div class="gallery-subheader">
								<h4>Monsters</h4>
								<span class="badge">{scenarioMonsterCards.length}</span>
							</div>

								<div class="gallery-grid">
									{#each scenarioMonsterCards as link (link.id)}
										{@const monster = monsterById.get(link.card_id) ?? null}
										{@const monsterImageUrl = monster
										? publicAssetUrl(monster.card_image_path, { updatedAt: monster.updated_at ?? undefined })
										: null}
									{@const monsterEmoji = monster?.icon && !monster.icon.includes('/') ? monster.icon : '👹'}

									<div class="gallery-card">
										<div class="gallery-preview">
											{#if monsterImageUrl}
												<img src={monsterImageUrl} alt={monster?.name ?? 'Monster'} loading="lazy" />
												<div class="gallery-status generated" title="PNG generated">✓</div>
											{:else}
												<div class="gallery-placeholder">
													<div class="placeholder-emoji">{monsterEmoji}</div>
													<div class="placeholder-text">{monster?.name ?? 'Unknown Monster'}</div>
												</div>
											{/if}
										</div>

										<div class="gallery-info">
											<div class="gallery-info__header">
												<h4 class="gallery-name">{monster?.name ?? 'Unknown Monster'}</h4>
												<span class="gallery-badge">Monster</span>
											</div>
											<div class="gallery-meta">
												{#if monster?.stage}
													<span class={`pill pill--${monster.stage}`}>{getMonsterStageLabel(monster.stage)}</span>
												{/if}
												<span class="gallery-meta__qty">x{link.quantity ?? 1}</span>
											</div>
											<div class="gallery-info__footer">
												<span class="gallery-order">#{(link.order_num ?? 0) + 1}</span>
											</div>
										</div>
									</div>
									{/each}
								</div>
							</section>
						{:else if activeTab === 'styles'}
							<section class="section">
								<div class="section-header">
									<div class="section-header__title">
										<h3>Stage Card Styles</h3>
										<span class="badge">{STAGE_EVENT_RENDER_STYLE_OPTIONS.length + STAGE_LOCATION_RENDER_STYLE_OPTIONS.length}</span>
									</div>
								</div>

								<div class="styles-section">
									<div class="styles-header">
										<h4>Event Styles</h4>
										<FormField label="Base Event">
											<Select
												bind:value={stylePreviewEventCardId}
												options={stylePreviewEventOptions}
												placeholder={stylePreviewEventOptions.length === 0 ? 'No events in scenario' : 'Select event'}
												disabled={stylePreviewEventOptions.length === 0}
											/>
										</FormField>
									</div>

									{#if stylePreviewBaseEvent === null}
										<div class="empty">Create an event in this scenario to preview event styles.</div>
									{:else}
										<div class="styles-grid">
											{#each stylePreviewEventStyles as item (item.style)}
												<div class="styles-card">
													<div class="styles-preview">
														<StageCardPreview card={item.card} />
													</div>
													<div class="styles-info">
														<div class="styles-info__name">{item.label}</div>
														<div class="styles-info__id">{item.style}</div>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>

								<div class="gallery-divider" aria-hidden="true"></div>

								<div class="styles-section">
									<div class="styles-header">
										<h4>Stage Location Styles</h4>
										<FormField label="Base Stage Location">
											<Select
												bind:value={stylePreviewStageLocationCardId}
												options={stylePreviewStageLocationOptions}
												placeholder={stylePreviewStageLocationOptions.length === 0 ? 'No stage locations in scenario' : 'Select stage location'}
												disabled={stylePreviewStageLocationOptions.length === 0}
											/>
										</FormField>
									</div>

									{#if stylePreviewBaseStageLocationCard === null}
										<div class="empty">Add a stage location card to preview stage location styles.</div>
									{:else}
										<div class="styles-grid">
											{#each stylePreviewStageLocationStyles as item (item.style)}
												<div class="styles-card">
													<div class="styles-preview">
														<StageCardPreview card={item.card} location={stylePreviewBaseStageLocation} />
													</div>
													<div class="styles-info">
														<div class="styles-info__name">{item.label}</div>
														<div class="styles-info__id">{item.style}</div>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</section>
						{/if}
					{:else}
						<div class="empty-state">Select a scenario or create a new one.</div>
					{/if}
			</main>
		</div>
	{/if}
</PageLayout>

<Modal bind:open={scenarioModalOpen} title={scenarioModalMode === 'create' ? 'Create Scenario' : 'Edit Scenario'}>
	<FormField label="Name">
		<Input bind:value={scenarioNameDraft} placeholder="Scenario name" disabled={scenarioModalSaving} />
	</FormField>
	<FormField label="Description">
		<Textarea bind:value={scenarioDescriptionDraft} placeholder="Optional" disabled={scenarioModalSaving} />
	</FormField>

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (scenarioModalOpen = false)} disabled={scenarioModalSaving}>Cancel</Button>
		<Button variant="primary" onclick={saveScenario} disabled={scenarioModalSaving}>
			{scenarioModalSaving ? 'Saving…' : 'Save'}
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={eventCreateOpen} title="Create Event">
	<FormField label="Stage">
		<Select bind:value={eventCreateForm.stage} options={EVENT_TYPE_OPTIONS} disabled={eventCreateSaving} />
	</FormField>
	<FormField label="Style">
		<Select bind:value={eventCreateForm.render_style} options={STAGE_EVENT_RENDER_STYLE_OPTIONS} disabled={eventCreateSaving} />
	</FormField>
	<FormField label="Title" required>
		<Input bind:value={eventCreateForm.title} placeholder="Event title" disabled={eventCreateSaving} />
	</FormField>
	<FormField label="Description">
		<Textarea bind:value={eventCreateForm.description} placeholder="Optional" disabled={eventCreateSaving} />
	</FormField>

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (eventCreateOpen = false)} disabled={eventCreateSaving}>
			Cancel
		</Button>
		<Button variant="primary" onclick={createEvent} disabled={eventCreateSaving}>
			{eventCreateSaving ? 'Creating…' : 'Create'}
		</Button>
	{/snippet}
</Modal>

<Modal bind:open={stageLocationEditOpen} title="Edit Stage Location">
		{#if stageLocationEditCard}
			<FormField label="Location" helperText="Edit rewards/art in Game Locations if needed." required={false}>
				<Input
					value={stageLocationEditGameLocation?.name ?? stageLocationEditCard.title ?? 'Unknown Location'}
					disabled={true}
				/>
			</FormField>
			<FormField label="Stage">
				<Select bind:value={stageLocationEditStage} options={EVENT_TYPE_OPTIONS} disabled={stageLocationEditSaving} />
			</FormField>
			<FormField label="Style">
				<Select
					bind:value={stageLocationEditRenderStyle}
					options={STAGE_LOCATION_RENDER_STYLE_OPTIONS}
					disabled={stageLocationEditSaving}
				/>
			</FormField>
		{:else}
			<div class="empty-state">Stage location card not found.</div>
		{/if}

	{#snippet footer()}
		<Button
			variant="secondary"
			onclick={() => {
				stageLocationEditOpen = false;
				stageLocationEditId = null;
			}}
			disabled={stageLocationEditSaving}
		>
			Cancel
		</Button>
		<Button
			variant="secondary"
			onclick={() => {
				const locationId = stageLocationEditCard ? (stageLocationEditCard.game_location_id ?? stageLocationEditCard.id) : null;
				if (locationId) goto(`/game-locations?edit=${locationId}`);
			}}
			disabled={!stageLocationEditCard}
		>
			Edit Game Location
		</Button>
		<Button variant="primary" onclick={saveStageLocationEdit} disabled={stageLocationEditSaving || !stageLocationEditCard}>
			{stageLocationEditSaving ? 'Saving…' : 'Save'}
		</Button>
	{/snippet}
</Modal>

<style>
	.loading-state,
	.error-state,
	.empty-state {
		padding: 1rem;
		color: #cbd5e1;
	}

	.error-state {
		color: #fecaca;
	}

	.layout {
		display: grid;
		grid-template-columns: 260px 1fr;
		gap: 0.75rem;
		align-items: start;
	}

	.sidebar {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		padding: 0.75rem;
		position: sticky;
		top: 0.5rem;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.5rem;
	}

	.sidebar-header h3 {
		margin: 0;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #e2e8f0;
	}

	.count {
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.scenario-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.scenario-item-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.scenario-item {
		flex: 1;
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid transparent;
		border-radius: 8px;
		padding: 0.5rem 0.6rem;
		color: #cbd5e1;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.scenario-item:hover {
		background: rgba(51, 65, 85, 0.65);
	}

	.scenario-item.selected {
		background: rgba(168, 85, 247, 0.18);
		border-color: rgba(168, 85, 247, 0.5);
		color: #e9d5ff;
	}

	.scenario-name {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}

	.scenario-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		padding: 0.75rem;
	}

	.scenario-header h2 {
		margin: 0;
		font-size: 1.15rem;
		color: #f8fafc;
	}

	.muted {
		margin: 0.25rem 0 0;
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.section {
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.section-header__title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.section-header__actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.section-header h3 {
		margin: 0;
		font-size: 0.95rem;
		color: #f8fafc;
	}

	.badge {
		font-size: 0.75rem;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: rgba(59, 130, 246, 0.15);
		border: 1px solid rgba(59, 130, 246, 0.3);
		color: #bfdbfe;
	}

	.add-row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.gallery-controls {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		flex-wrap: wrap;
	}

	.gallery-filters,
	.gallery-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.gallery-search {
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
		min-width: 220px;
	}

	.gallery-select {
		padding: 0.5rem 0.6rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
	}

	.gallery-progress {
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.25);
		color: #cbd5e1;
		font-size: 0.85rem;
	}

		.gallery-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			gap: 0.75rem;
		}

		.styles-section {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
		}

		.styles-header {
			display: flex;
			align-items: end;
			justify-content: space-between;
			gap: 0.75rem;
			flex-wrap: wrap;
		}

		.styles-header h4 {
			margin: 0;
			font-size: 0.8rem;
			text-transform: uppercase;
			letter-spacing: 0.06em;
			color: #e2e8f0;
		}

		.styles-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			gap: 0.75rem;
		}

		.styles-card {
			background: rgba(2, 6, 23, 0.35);
			border: 1px solid rgba(148, 163, 184, 0.12);
			border-radius: 12px;
			overflow: hidden;
		}

		.styles-preview {
			position: relative;
			width: 100%;
			aspect-ratio: 600 / 437;
			background: rgba(15, 23, 42, 0.5);
			overflow: hidden;
		}

		.styles-info {
			padding: 0.6rem 0.75rem;
			display: flex;
			flex-direction: column;
			gap: 0.15rem;
		}

		.styles-info__name {
			font-weight: 800;
			font-size: 0.85rem;
			color: #f8fafc;
		}

		.styles-info__id {
			font-size: 0.72rem;
			color: rgba(148, 163, 184, 0.95);
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		}

		.gallery-card {
			position: relative;
			background: rgba(2, 6, 23, 0.35);
			border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		overflow: hidden;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.gallery-card:hover {
		border-color: rgba(148, 163, 184, 0.25);
		transform: translateY(-1px);
	}

	.gallery-card.selected {
		border-color: rgba(96, 165, 250, 0.6);
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
	}

	.gallery-checkbox {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 3;
	}

	.gallery-checkbox input {
		width: 16px;
		height: 16px;
		accent-color: #60a5fa;
	}

	.gallery-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 600 / 437;
		background: rgba(15, 23, 42, 0.5);
		display: grid;
		place-items: center;
		overflow: hidden;
	}

	.gallery-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.live-preview {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.live-preview__inner {
		width: 600px;
		height: 437px;
		transform-origin: top left;
		transform: scale(0.4);
		pointer-events: none;
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

	.gallery-generating {
		position: absolute;
		inset: 0;
		background: rgba(2, 6, 23, 0.65);
		display: grid;
		place-items: center;
		z-index: 2;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 3px solid rgba(148, 163, 184, 0.35);
		border-top-color: rgba(96, 165, 250, 0.9);
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.gallery-info {
		padding: 0.65rem 0.75rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.gallery-info__header {
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
		min-width: 0;
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
		flex-shrink: 0;
	}

	.gallery-meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.gallery-meta__qty {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.gallery-info__footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.gallery-order {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.gallery-divider {
		height: 1px;
		background: rgba(148, 163, 184, 0.12);
		margin: 0.25rem 0;
	}

	.gallery-subheader {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.gallery-subheader h4 {
		margin: 0;
		font-size: 0.9rem;
		color: #f8fafc;
	}

	.card-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.card-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.6rem;
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
	}

	.card-row__meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.pos {
		font-size: 0.75rem;
		color: #94a3b8;
		width: 2.2rem;
		flex-shrink: 0;
	}

	.name {
		font-weight: 600;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 42ch;
	}

	.pill {
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #cbd5e1;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

		.pill--stage_1 {
			background: rgba(192, 132, 252, 0.15);
			border-color: rgba(192, 132, 252, 0.35);
			color: #e9d5ff;
		}
		.pill--stage_2 {
			background: rgba(107, 33, 168, 0.15);
			border-color: rgba(107, 33, 168, 0.35);
			color: #e9d5ff;
		}
		.pill--stage_3 {
			background: rgba(6, 95, 70, 0.15);
			border-color: rgba(6, 95, 70, 0.35);
			color: #bbf7d0;
		}
		.pill--final_stage {
			background: rgba(14, 165, 233, 0.15);
			border-color: rgba(14, 165, 233, 0.35);
			color: #bae6fd;
		}
	.pill--inactive {
		background: rgba(100, 116, 139, 0.15);
		border-color: rgba(100, 116, 139, 0.35);
		color: #e2e8f0;
	}

	.pill--event {
		background: rgba(96, 165, 250, 0.12);
		border-color: rgba(96, 165, 250, 0.3);
		color: #bfdbfe;
	}

	.card-row__actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.btn {
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(30, 41, 59, 0.6);
		color: #e2e8f0;
		border-radius: 8px;
		padding: 0.25rem 0.45rem;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.btn:hover:enabled {
		background: rgba(51, 65, 85, 0.75);
		border-color: rgba(148, 163, 184, 0.35);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn.danger {
		background: rgba(248, 113, 113, 0.12);
		border-color: rgba(248, 113, 113, 0.25);
		color: #fecaca;
	}

	.btn.danger:hover:enabled {
		background: rgba(248, 113, 113, 0.2);
		border-color: rgba(248, 113, 113, 0.4);
	}

	.empty {
		color: #94a3b8;
		font-size: 0.85rem;
		padding: 0.5rem 0;
	}

	@media (max-width: 960px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.sidebar {
			position: static;
		}

		.name {
			max-width: 28ch;
		}
	}
</style>
