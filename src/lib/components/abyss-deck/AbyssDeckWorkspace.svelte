<script lang="ts">
	import type { RewardRow, SpecialEffectRow } from '$lib/types/gameData';
	import { DEFAULT_EVENT_TYPE, EVENT_TYPE_OPTIONS, type EventType } from '$lib/types/eventTypes';
	import {
		DEFAULT_STAGE_EVENT_RENDER_STYLE,
		STAGE_EVENT_RENDER_STYLE_OPTIONS,
		getStageCardRenderStyle,
		type StageEventRenderStyle
	} from '$lib/types/stageCardStyles';
	import { getErrorMessage } from '$lib/utils';
	import { getIconPoolUrl } from '$lib/utils/iconPool';
	import { MonsterCardPreview } from '$lib/components/monsters';
	import { RewardRowsEditor } from '$lib/components/monsters';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import LazyMount from '$lib/components/shared/LazyMount.svelte';
	import Modal from '../layout/Modal.svelte';
	import { ConfirmDialog, IconPicker, ImageUploader, SpecialEffectPicker } from '$lib/components/shared';
	import EventCardPreview from './EventCardPreview.svelte';
	import type { Event, Monster } from './types';

	export type DeckOrderItem = {
		type: 'monster' | 'event';
		id: string;
	};

	export type MonsterFormData = {
		/** Internal: indicates where this save originated so parents can react accordingly. */
		__save_source?: 'editor' | 'inline';
		name: string;
		subtext: string | null;
		description: string | null;
		damage: number;
		barrier: number;
		card_image_path: string | null;
		/** Flat array of up to 6 icon IDs awarded on kill. */
		reward_track: string[];
		stage: 'stage_1' | 'stage_2' | 'stage_3' | 'final_stage' | 'inactive';
		monster_classification: 'monster' | 'abyss_guardian' | 'boss' | 'final_boss';
		icon: string | null;
		image_path: string | null;
		invade_location_id: string | null;
		order_num: number;
		special_effect_ids: string[];
		dice_pool: string[];
		attack_type: 'damage' | 'dice_pool';
		stage_num: number;
		quantity: number;
		choose_amount: number;
	};

	export type EventFormData = {
		event_type: EventType;
		render_style: StageEventRenderStyle;
		title: string;
		description: string | null;
		image_path: string | null;
		reward_rows: RewardRow[];
		order_num: number;
	};

	interface Props {
		monsters: Monster[];
		events: Event[];
		locations: { id: string; name: string }[];
		specialEffects: SpecialEffectRow[];
		monsterSpecialEffects: Record<string, string[]>;
		language?: 'base' | string;
		/** When false, hides all deck reordering UI (drag, move, save order). */
		enableOrdering?: boolean;
		/** When false, treats all monster quantities as 1 and hides quantity controls. */
		enableQuantities?: boolean;
		onMonsterSave: (formData: MonsterFormData, id: string | null) => Promise<string>;
		onEventSave?: (formData: EventFormData, id: string | null) => Promise<string>;
		onMonsterDelete: (id: string) => Promise<void>;
		onEventDelete?: (id: string) => Promise<void>;
		onEventLocationEdit?: (id: string) => void;
		onSaveDeckOrder: (order: DeckOrderItem[]) => Promise<void>;
		onSelectMonster?: (monster: Monster | null) => void;
		monsterLabel?: string;
		monsterLabelPlural?: string;
		monsterIcon?: string;
		monsterPreviewComponent?: any;
		monsterPreviewVariants?: number[];
		defaultShowCardPreviews?: boolean;
		showMonsters?: boolean;
		showEvents?: boolean;
		showSubtext?: boolean;
		showDescription?: boolean;
		showImageUpload?: boolean;
		imageUploadFolder?: string;
		imageUploadAspectRatio?: string;
		imageUploadCropTransparent?: boolean;
		imageUploadMaxSizeMB?: number;
		showCardImageUpload?: boolean;
		cardImageUploadFolder?: string;
		cardImageUploadAspectRatio?: string;
		cardImageUploadCropTransparent?: boolean;
		cardImageUploadMaxSizeMB?: number;
		showStats?: boolean;
		showInvadeLocation?: boolean;
		showSpecialEffects?: boolean;
		showRewardRows?: boolean;
		showEventRewardRows?: boolean;
		showAttackTypeToggle?: boolean;
		showStageAsInteger?: boolean;
	}

	let {
		monsters,
		events,
		locations,
		specialEffects,
		monsterSpecialEffects,
		language = 'base',
		enableOrdering = true,
		enableQuantities = true,
		onMonsterSave,
		onEventSave = async () => {
			throw new Error('Event save handler not provided.');
		},
		onMonsterDelete,
		onEventDelete = async () => {
			throw new Error('Event delete handler not provided.');
		},
		onEventLocationEdit,
		onSaveDeckOrder,
		onSelectMonster,
		monsterLabel = 'Monster',
		monsterLabelPlural = 'Monsters',
		monsterIcon = '👹',
		monsterPreviewComponent = MonsterCardPreview,
		monsterPreviewVariants = [],
		defaultShowCardPreviews = true,
		showMonsters = true,
		showEvents = true,
		showSubtext = false,
		showDescription = false,
		showImageUpload = false,
		imageUploadFolder = 'uploads',
		imageUploadAspectRatio,
		imageUploadCropTransparent = true,
		imageUploadMaxSizeMB = 12,
		showCardImageUpload = false,
		cardImageUploadFolder = 'card_images/monsters/en',
		cardImageUploadAspectRatio = '600 / 437',
		cardImageUploadCropTransparent = false,
		cardImageUploadMaxSizeMB = 12,
		showStats = true,
		showInvadeLocation = true,
		showSpecialEffects = true,
		showRewardRows = true,
		showEventRewardRows = false,
		showAttackTypeToggle = false,
		showStageAsInteger = false
	}: Props = $props();

	const monsterLabelLower = $derived.by(() => monsterLabel.toLowerCase());
	let showCardPreviews = $state(defaultShowCardPreviews);

	type InlineStats = { damage: number; barrier: number };
	let inlineStatsEdits = $state<Record<string, InlineStats>>({});
	let inlineStatsSaving = $state<Record<string, boolean>>({});
	let inlineStatsError = $state<Record<string, string | null>>({});

	const INLINE_SPECIAL_EFFECT_MAX = 6;
	let inlineEffectEdits = $state<Record<string, string[]>>({});
	let inlineEffectOpenId = $state<string | null>(null);
	let inlineStageEdits = $state<Record<string, MonsterStage>>({});
	const inlineAutosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

	let rewardTrackPickerOpen = $state(false);
	let dicePoolPickerOpen = $state(false);

	const specialEffectById = $derived.by(() => new Map(specialEffects.map((effect) => [effect.id, effect])));
	const sortedSpecialEffects = $derived.by(() => [...specialEffects].sort((a, b) => a.name.localeCompare(b.name)));

	function scheduleInlineAutosave(monsterId: string, delayMs = 0) {
		const existing = inlineAutosaveTimers.get(monsterId);
		if (existing) {
			clearTimeout(existing);
		}

		inlineAutosaveTimers.set(
			monsterId,
			setTimeout(() => {
				inlineAutosaveTimers.delete(monsterId);
				void saveInlineEdits(monsterId);
			}, delayMs)
		);
	}

	function handleInlineStatsFocusOut(monsterId: string, e: FocusEvent) {
		const current = e.currentTarget as HTMLElement | null;
		const next = e.relatedTarget as Node | null;
		if (current && next && current.contains(next)) return;
		scheduleInlineAutosave(monsterId, 0);
	}

	function closeInlineEffectsPanel(monsterId: string) {
		inlineEffectOpenId = null;
		scheduleInlineAutosave(monsterId, 0);
	}

	function toggleInlineEffectsPanel(monsterId: string) {
		if (inlineEffectOpenId === monsterId) {
			closeInlineEffectsPanel(monsterId);
			return;
		}

		const previous = inlineEffectOpenId;
		inlineEffectOpenId = monsterId;
		if (previous) {
			scheduleInlineAutosave(previous, 0);
		}
	}

	function keyToString(k: DeckOrderItem) {
		return `${k.type}:${k.id}`;
	}

	function buildCanonicalOrder(m: Monster[], e: Event[], includeEvents: boolean): DeckOrderItem[] {
		return [
			...m.map((monster) => ({ type: 'monster' as const, id: monster.id, order_num: monster.order_num ?? 0 })),
			...(includeEvents
				? e.map((event) => ({ type: 'event' as const, id: event.id, order_num: event.order_num ?? 0 }))
				: [])
		]
			.sort((a, b) => a.order_num - b.order_num)
			.map(({ type, id }) => ({ type, id }));
	}

	function isSameOrder(a: DeckOrderItem[], b: DeckOrderItem[]) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i].type !== b[i].type) return false;
			if (a[i].id !== b[i].id) return false;
		}
		return true;
	}

	let deckOrder = $state<DeckOrderItem[]>([]);
	let orderChanged = $state(false);
	let savingOrder = $state(false);

	$effect(() => {
		const canonical = buildCanonicalOrder(showMonsters ? monsters : [], events, showEvents);

		if (deckOrder.length === 0) {
			if (canonical.length > 0) {
				deckOrder = canonical;
			}
			orderChanged = false;
			return;
		}

		if (!orderChanged) {
			if (!isSameOrder(deckOrder, canonical)) {
				deckOrder = canonical;
			}
			return;
		}

		const canonicalSet = new Set(canonical.map(keyToString));
		const kept = deckOrder.filter((k) => canonicalSet.has(keyToString(k)));
		const keptSet = new Set(kept.map(keyToString));
		const appended = canonical.filter((k) => !keptSet.has(keyToString(k)));
		const reconciled = [...kept, ...appended];

		if (!isSameOrder(deckOrder, reconciled)) {
			deckOrder = reconciled;
		}
	});

	const monsterById = $derived.by(() => new Map(monsters.map((m) => [m.id, m])));
	const eventById = $derived.by(() => new Map(events.map((e) => [e.id, e])));
	const locationNameById = $derived.by(() => new Map(locations.map((l) => [l.id, l.name])));

	// UI state
	let typeFilter = $state<'all' | 'monster' | 'event'>('all');
	let searchQuery = $state('');
	let scalePercent = $state(82);

	// Editor selection/state
	let editorType = $state<'monster' | 'event' | null>(null);
	let editingId = $state<string | null>(null);
	let editorOpen = $state(false);

	// Delete confirm
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<{ type: 'monster' | 'event'; id: string; label: string } | null>(null);
	let deleting = $state(false);
	let duplicatingId = $state<string | null>(null);

	// Drag state (full-order indices)
	let draggedIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	// Forms
	function normalizeRewardTrack(raw: unknown): string[] {
		if (!Array.isArray(raw)) return [];
		return raw
			.filter((id): id is string => typeof id === 'string')
			.map((id) => id.trim())
			.filter(Boolean)
			.slice(0, 6);
	}

		function monsterToFormData(monster: Monster): MonsterFormData {
			return {
				name: monster.name,
				subtext: null,
				description: monster.special_conditions ?? null,
				damage: monster.damage ?? 0,
			barrier: monster.barrier ?? 0,
			card_image_path: (monster as { card_image_path?: string | null }).card_image_path ?? null,
			reward_track: normalizeRewardTrack((monster as { reward_track?: unknown }).reward_track),
			stage: monster.stage,
			monster_classification: monster.monster_classification ?? 'monster',
			icon: monster.icon,
				image_path: monster.image_path,
				invade_location_id: monster.invade_location_id ?? null,
				order_num: monster.order_num,
				special_effect_ids: monsterSpecialEffects[monster.id] ?? [],
			dice_pool: Array.isArray((monster as unknown as { dice_pool?: unknown }).dice_pool) ? ((monster as unknown as { dice_pool?: string[] }).dice_pool ?? []) : [],
			attack_type: ((monster as unknown as { attack_type?: string }).attack_type === 'dice_pool') ? 'dice_pool' : 'damage',
			stage_num: Number((monster as unknown as { stage_num?: number }).stage_num) || 1,
			quantity: enableQuantities ? (monster.quantity ?? 1) : 1,
		choose_amount: Number((monster as unknown as { choose_amount?: number }).choose_amount) || 1
		};
	}

	function parseNonNegativeInt(value: string, fallback: number): number {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return fallback;
		return Math.max(0, Math.round(parsed));
	}

	function coerceNonNegativeInt(value: unknown, fallback: number): number {
		if (typeof value === 'number') {
			return Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback;
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (!trimmed) return fallback;
			return parseNonNegativeInt(trimmed, fallback);
		}
		return fallback;
	}

	function setRewardTrack(ids: string[]) {
		monsterFormData.reward_track = ids.slice(0, 6);
	}

	function setRewardTrackCell(cellIndex: number, iconId: string) {
		const track = [...(monsterFormData.reward_track ?? [])];
		if (cellIndex >= 0 && cellIndex < 6) {
			track[cellIndex] = iconId;
			monsterFormData.reward_track = track.slice(0, 6);
		}
	}

	function moveRewardTrackIcon(fromIndex: number, toIndex: number) {
		const track = [...(monsterFormData.reward_track ?? [])];
		if (fromIndex < 0 || fromIndex >= track.length) return;
		if (toIndex < 0 || toIndex >= track.length) return;
		if (fromIndex === toIndex) return;
		const [moved] = track.splice(fromIndex, 1);
		track.splice(toIndex, 0, moved);
		monsterFormData.reward_track = track;
	}

	function removeRewardTrackIcon(index: number) {
		const track = [...(monsterFormData.reward_track ?? [])];
		if (index < 0 || index >= track.length) return;
		track.splice(index, 1);
		monsterFormData.reward_track = track;
	}

	function clearRewardTrack() {
		monsterFormData.reward_track = [];
	}

	function getInlineStats(monster: Monster): InlineStats {
		const edit = inlineStatsEdits[monster.id];
		return {
			damage: edit?.damage ?? (monster.damage ?? 0),
			barrier: edit?.barrier ?? (monster.barrier ?? 0)
		};
	}

	function getInlineStage(monster: Monster): MonsterStage {
		const edit = inlineStageEdits[monster.id];
		if (edit) return edit;
		switch (monster.stage) {
			case 'stage_1':
			case 'stage_2':
			case 'stage_3':
			case 'final_stage':
			case 'inactive':
				return monster.stage;
			default:
				return 'stage_1';
		}
	}

	function coerceMonsterStage(value: string, fallback: MonsterStage): MonsterStage {
		switch (value) {
			case 'stage_1':
			case 'stage_2':
			case 'stage_3':
			case 'final_stage':
			case 'inactive':
				return value;
			default:
				return fallback;
		}
	}

	function normalizeInlineEffectIds(ids: string[]): string[] {
		const unique = Array.from(
			new Set(
				ids
					.filter((id): id is string => typeof id === 'string')
					.map((id) => id.trim())
					.filter(Boolean)
			)
		);

		unique.sort((a, b) => {
			const aName = specialEffectById.get(a)?.name ?? a;
			const bName = specialEffectById.get(b)?.name ?? b;
			return aName.localeCompare(bName);
		});

		return unique;
	}

	function arraysEqual(a: string[], b: string[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	function getInlineEffectIds(monsterId: string): string[] {
		return inlineEffectEdits[monsterId] ?? normalizeInlineEffectIds(monsterSpecialEffects[monsterId] ?? []);
	}

	function setInlineEffectIds(monsterId: string, nextIds: string[]) {
		const base = normalizeInlineEffectIds(monsterSpecialEffects[monsterId] ?? []);
		const next = normalizeInlineEffectIds(nextIds);

		const edits = { ...inlineEffectEdits };
		if (arraysEqual(base, next)) {
			delete edits[monsterId];
		} else {
			edits[monsterId] = next;
		}
		inlineEffectEdits = edits;

		if (inlineStatsError[monsterId]) {
			inlineStatsError = { ...inlineStatsError, [monsterId]: null };
		}
	}

	function toggleInlineEffect(monsterId: string, effectId: string) {
		const current = getInlineEffectIds(monsterId);
		const selected = new Set(current);
		if (selected.has(effectId)) {
			selected.delete(effectId);
		} else {
			if (selected.size >= INLINE_SPECIAL_EFFECT_MAX) return;
			selected.add(effectId);
		}

		setInlineEffectIds(monsterId, Array.from(selected));
	}

	function setInlineStatValue(monster: Monster, field: keyof InlineStats, rawValue: string) {
		const baseDamage = monster.damage ?? 0;
		const baseBarrier = monster.barrier ?? 0;
		const current = getInlineStats(monster);
		const nextValue = parseNonNegativeInt(rawValue, current[field]);
		const next: InlineStats = { ...current, [field]: nextValue };

		const edits = { ...inlineStatsEdits };
		if (next.damage === baseDamage && next.barrier === baseBarrier) {
			delete edits[monster.id];
		} else {
			edits[monster.id] = next;
		}
		inlineStatsEdits = edits;

		if (inlineStatsError[monster.id]) {
			inlineStatsError = { ...inlineStatsError, [monster.id]: null };
		}
	}

	function setInlineStage(monster: Monster, rawValue: string) {
		const base = coerceMonsterStage(monster.stage, 'stage_1');
		const next = coerceMonsterStage(rawValue, base);
		const edits = { ...inlineStageEdits };
		if (next === base) {
			delete edits[monster.id];
		} else {
			edits[monster.id] = next;
		}
		inlineStageEdits = edits;

		if (inlineStatsError[monster.id]) {
			inlineStatsError = { ...inlineStatsError, [monster.id]: null };
		}
	}

	async function saveInlineEdits(monsterId: string) {
			if (inlineStatsSaving[monsterId]) return;
			const monster = monsterById.get(monsterId);
			if (!monster) return;

		const statsEdit = inlineStatsEdits[monsterId];
		const effectsEdit = inlineEffectEdits[monsterId];
		const stageEdit = inlineStageEdits[monsterId];
		if (!statsEdit && !effectsEdit && !stageEdit) return;

		inlineStatsSaving = { ...inlineStatsSaving, [monsterId]: true };
		inlineStatsError = { ...inlineStatsError, [monsterId]: null };
			try {
				const formData = monsterToFormData(monster);
				const nextBarrier = statsEdit?.barrier ?? formData.barrier;
					const merged: MonsterFormData = {
						...formData,
						__save_source: 'inline',
						damage: statsEdit?.damage ?? formData.damage,
						barrier: nextBarrier,
						stage: stageEdit ?? formData.stage,
						special_effect_ids: effectsEdit ?? formData.special_effect_ids
					};
					await onMonsterSave(merged, monsterId);

			const nextStats = { ...inlineStatsEdits };
			delete nextStats[monsterId];
			inlineStatsEdits = nextStats;

			const nextEffects = { ...inlineEffectEdits };
			delete nextEffects[monsterId];
			inlineEffectEdits = nextEffects;

			const nextStage = { ...inlineStageEdits };
			delete nextStage[monsterId];
			inlineStageEdits = nextStage;
		} catch (err) {
			inlineStatsError = { ...inlineStatsError, [monsterId]: getErrorMessage(err) };
		} finally {
			inlineStatsSaving = { ...inlineStatsSaving, [monsterId]: false };
		}
	}

		let monsterFormData = $state<MonsterFormData>({
				name: '',
				subtext: null,
				description: null,
				damage: 0,
				barrier: 0,
				card_image_path: null,
				reward_track: [],
				stage: 'stage_1',
				monster_classification: 'monster',
			icon: null,
			image_path: null,
			invade_location_id: null,
			order_num: 0,
			special_effect_ids: [],
		dice_pool: [],
		attack_type: 'damage',
		stage_num: 1,
		quantity: 1,
		choose_amount: 1
	});

	let eventFormData = $state<EventFormData>({
		event_type: DEFAULT_EVENT_TYPE,
		render_style: DEFAULT_STAGE_EVENT_RENDER_STYLE,
		title: '',
		description: null,
		image_path: null,
		reward_rows: [{ type: 'all_players', icon_ids: [] }],
		order_num: 0
	});

	const selectedKey = $derived(editorType && editingId ? `${editorType}:${editingId}` : null);

	function getGroupLabel(type: 'monster' | 'event', id: string): string {
		if (type === 'monster') {
			return monsterById.get(id)?.name ?? `Unknown ${monsterLabel}`;
		}
		const event = eventById.get(id);
		return event?.title ?? 'Unknown Stage Card';
	}

		function openNewMonster() {
			if (!showMonsters) return;
			editorType = 'monster';
			editingId = null;
					monsterFormData = {
						name: '',
						subtext: null,
						description: null,
						damage: 0,
						barrier: 0,
						card_image_path: null,
						reward_track: [],
						stage: 'stage_1',
						monster_classification: 'monster',
					icon: null,
					image_path: null,
				invade_location_id: null,
				order_num: deckOrder.length,
				special_effect_ids: [],
			dice_pool: [],
			attack_type: 'damage',
			stage_num: 1,
			quantity: 1,
			choose_amount: 1
		};
		onSelectMonster?.(null);
		editorOpen = true;
	}

		function openNewEvent() {
			if (!showEvents) return;
			editorType = 'event';
			editingId = null;
			eventFormData = {
				event_type: DEFAULT_EVENT_TYPE,
				render_style: DEFAULT_STAGE_EVENT_RENDER_STYLE,
				title: '',
				description: null,
				image_path: null,
				reward_rows: [{ type: 'all_players', icon_ids: [] }],
				order_num: deckOrder.length
			};
			editorOpen = true;
		}

			function openEdit(type: 'monster' | 'event', id: string) {
			if (type === 'monster' && !showMonsters) return;
			if (type === 'event' && !showEvents) return;

		if (inlineEffectOpenId) {
			const openId = inlineEffectOpenId;
			inlineEffectOpenId = null;
			scheduleInlineAutosave(openId, 0);
		}

		if (type === 'monster') {
			const monster = monsterById.get(id);
			if (!monster) return;
			if (inlineStatsEdits[id] || inlineEffectEdits[id] || inlineStageEdits[id]) {
				scheduleInlineAutosave(id, 0);
			}
			editorType = type;
			editingId = id;
				const baseForm = monsterToFormData(monster);
					const statsEdit = inlineStatsEdits[id];
					const effectsEdit = inlineEffectEdits[id];
					const stageEdit = inlineStageEdits[id];
					const nextBarrier = statsEdit?.barrier ?? baseForm.barrier;
					monsterFormData = {
						...baseForm,
						damage: statsEdit?.damage ?? baseForm.damage,
						barrier: nextBarrier,
						stage: stageEdit ?? baseForm.stage,
						special_effect_ids: effectsEdit ?? baseForm.special_effect_ids
					};
				onSelectMonster?.(monster);
				editorOpen = true;
			} else {
				const event = eventById.get(id);
				if (!event) return;
				if (event.card_kind === 'stage_location') {
					onEventLocationEdit?.(id);
					if (!onEventLocationEdit) {
						alert('Stage location cards are edited in the Game Locations page.');
					}
					return;
				}
						editorType = type;
					editingId = id;
					eventFormData = {
						event_type: event.stage ?? DEFAULT_EVENT_TYPE,
						render_style: getStageCardRenderStyle('event', (event as unknown as { data?: unknown }).data) as StageEventRenderStyle,
						title: event.title,
						description: event.description,
						image_path: event.image_path,
						reward_rows:
							(event.reward_rows as RewardRow[] | null | undefined) ?? [{ type: 'all_players', icon_ids: [] }],
						order_num: event.order_num
					};
				onSelectMonster?.(null);
				editorOpen = true;
			}
		}

	function closeEditor() {
		editorType = null;
		editingId = null;
		editorOpen = false;
		onSelectMonster?.(null);
	}

	function requestDelete(type: 'monster' | 'event', id: string) {
		if (type === 'monster' && !showMonsters) return;
		if (type === 'event' && !showEvents) return;
		deleteTarget = { type, id, label: getGroupLabel(type, id) };
		showDeleteConfirm = true;
	}

		async function duplicateMonster(id: string) {
			if (!showMonsters) return;
			const monster = monsterById.get(id);
			if (!monster) return;

			duplicatingId = id;
			const copyForm: MonsterFormData = {
				...monsterToFormData(monster),
				card_image_path: null,
				order_num: monster.order_num ?? deckOrder.length
			};

		try {
			const newId = await onMonsterSave(copyForm, null);
			if (!newId) {
				throw new Error('Duplicate did not return a new id.');
			}
			const cleaned = deckOrder.filter((k) => !(k.type === 'monster' && k.id === newId));
			const insertIndex = cleaned.findIndex((k) => k.type === 'monster' && k.id === id);
			const next = [...cleaned];
			if (insertIndex >= 0) {
				next.splice(insertIndex + 1, 0, { type: 'monster', id: newId });
			} else {
				next.push({ type: 'monster', id: newId });
			}
			deckOrder = next;
			orderChanged = true;
			monsterFormData = { ...copyForm };
			editorType = 'monster';
			editingId = newId;
			await saveDeckOrder();
		} catch (err) {
			alert(`Failed to duplicate ${monsterLabelLower}: ${getErrorMessage(err)}`);
		} finally {
			duplicatingId = null;
		}
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			if (deleteTarget.type === 'monster') {
				await onMonsterDelete(deleteTarget.id);
			} else {
				await onEventDelete(deleteTarget.id);
			}

			// Remove from local order and immediately normalize order numbers in DB.
			deckOrder = deckOrder.filter((k) => !(k.type === deleteTarget!.type && k.id === deleteTarget!.id));
			orderChanged = true;
			await saveDeckOrder();

			if (editorType === deleteTarget.type && editingId === deleteTarget.id) {
				closeEditor();
			}
		} catch (err) {
			alert(`Failed to delete: ${getErrorMessage(err)}`);
		} finally {
			deleting = false;
			deleteTarget = null;
			showDeleteConfirm = false;
		}
	}

	function handleDragStart(e: DragEvent, fullIndex: number) {
		draggedIndex = fullIndex;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', '');
		}
	}

	function handleDragOver(e: DragEvent, fullIndex: number) {
		e.preventDefault();
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = fullIndex;
	}

	function handleDragLeave() {
		dragOverIndex = null;
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggedIndex === null) return;
		if (draggedIndex === dropIndex) {
			draggedIndex = null;
			dragOverIndex = null;
			return;
		}

		const next = [...deckOrder];
		const [removed] = next.splice(draggedIndex, 1);
		next.splice(dropIndex, 0, removed);
		deckOrder = next;
		orderChanged = true;
		draggedIndex = null;
		dragOverIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		dragOverIndex = null;
	}

	function moveGroup(fromIndex: number, direction: 'up' | 'down') {
		const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
		if (toIndex < 0 || toIndex >= deckOrder.length) return;
		const next = [...deckOrder];
		const [removed] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, removed);
		deckOrder = next;
		orderChanged = true;
	}

	function resetOrder() {
		deckOrder = buildCanonicalOrder(showMonsters ? monsters : [], events, showEvents);
		orderChanged = false;
	}

	function resetMonsterOrderByStage() {
		if (!showMonsters) return;
		const current = deckOrder.length > 0 ? deckOrder : buildCanonicalOrder(showMonsters ? monsters : [], events, showEvents);
		if (current.length === 0) return;

		const stageRank = new Map<string, number>([
			['stage_1', 0],
			['stage_2', 1],
			['stage_3', 2],
			['final_stage', 3],
			['inactive', 4]
		]);

		const originalMonsterIndex = new Map<string, number>();
		for (let i = 0; i < current.length; i++) {
			const item = current[i];
			if (item.type === 'monster') {
				originalMonsterIndex.set(item.id, i);
			}
		}

		const monstersOnly = current.filter((item) => item.type === 'monster');
		const eventsOnly = current.filter((item) => item.type === 'event');

		const sortedMonsters = [...monstersOnly].sort((a, b) => {
			const monsterA = monsterById.get(a.id);
			const monsterB = monsterById.get(b.id);

			const stageA = monsterA ? (inlineStageEdits[monsterA.id] ?? normalizeStageKey(monsterA.stage)) : null;
			const stageB = monsterB ? (inlineStageEdits[monsterB.id] ?? normalizeStageKey(monsterB.stage)) : null;

			const rankA = stageA ? (stageRank.get(stageA) ?? 999) : 999;
			const rankB = stageB ? (stageRank.get(stageB) ?? 999) : 999;
			if (rankA !== rankB) return rankA - rankB;

			const idxA = originalMonsterIndex.get(a.id) ?? 0;
			const idxB = originalMonsterIndex.get(b.id) ?? 0;
			if (idxA !== idxB) return idxA - idxB;

			const nameA = monsterA?.name ?? '';
			const nameB = monsterB?.name ?? '';
			return nameA.localeCompare(nameB);
		});

		const nextOrder = [...sortedMonsters, ...eventsOnly];
		if (isSameOrder(current, nextOrder)) return;

		deckOrder = nextOrder;
		orderChanged = true;
		void saveDeckOrder();
	}

	async function saveDeckOrder() {
		if (!orderChanged || savingOrder) return;
		savingOrder = true;
		try {
			await onSaveDeckOrder(deckOrder);
			orderChanged = false;
		} catch (err) {
			alert(`Failed to save deck order: ${getErrorMessage(err)}`);
		} finally {
			savingOrder = false;
		}
	}

		async function saveMonster() {
			if (!showMonsters) return;
			if (!monsterFormData.name.trim()) {
				alert(`${monsterLabel} name is required.`);
			return;
		}

			try {
				const barrierValue = coerceNonNegativeInt(monsterFormData.barrier, 0);
					const sanitized: MonsterFormData = {
						...monsterFormData,
						__save_source: 'editor',
						damage: coerceNonNegativeInt(monsterFormData.damage, 0),
						barrier: barrierValue,
						reward_track: normalizeRewardTrack(monsterFormData.reward_track)
					};
				const id = await onMonsterSave(sanitized, editingId);
				if (!editingId && !deckOrder.some((k) => k.type === 'monster' && k.id === id)) {
					deckOrder = [...deckOrder, { type: 'monster', id }];
				}
			orderChanged = true;
			void saveDeckOrder();
			closeEditor();
		} catch (err) {
			alert(`Failed to save ${monsterLabelLower}: ${getErrorMessage(err)}`);
		}
	}

	async function saveEvent() {
		if (!showEvents) return;
		if (!eventFormData.title.trim()) {
			alert('Stage card title is required.');
			return;
		}

		try {
			const id = await onEventSave(eventFormData, editingId);
				if (!editingId && !deckOrder.some((k) => k.type === 'event' && k.id === id)) {
					deckOrder = [...deckOrder, { type: 'event', id }];
				}
			orderChanged = true;
			void saveDeckOrder();
			closeEditor();
		} catch (err) {
			alert(`Failed to save event: ${getErrorMessage(err)}`);
		}
	}

	const scale = $derived(scalePercent / 100);
	const totalGroups = $derived(deckOrder.length);
	const totalPhysicalCards = $derived.by(() => {
		let count = 0;
		for (const item of deckOrder) {
			if (item.type === 'monster') {
				count += enableQuantities ? (monsterById.get(item.id)?.quantity ?? 1) : 1;
			} else {
				count += 1;
			}
		}
		return count;
	});

	const visibleGroups = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		return deckOrder
			.map((item, orderIndex) => ({ item, orderIndex }))
			.filter(({ item }) => {
				if (!showMonsters && item.type === 'monster') return false;
				if (!showEvents && item.type === 'event') return false;
				if (typeFilter !== 'all' && item.type !== typeFilter) return false;
				if (!query) return true;
				const label = getGroupLabel(item.type, item.id).toLowerCase();
				return label.includes(query);
			});
	});

	type MonsterStage = 'stage_1' | 'stage_2' | 'stage_3' | 'final_stage' | 'inactive';
	type DeckSection = {
		key: string;
		label: string;
		accentColor: string;
		groups: { item: DeckOrderItem; orderIndex: number }[];
	};

	const monsterStageGroupOrder: MonsterStage[] = ['stage_1', 'stage_2', 'stage_3', 'final_stage', 'inactive'];
	const monsterStageGroupOrderSet = new Set<string>(monsterStageGroupOrder);

	function normalizeStageKey(stage: string | null | undefined): string | null {
		if (typeof stage !== 'string') return null;
		const normalized = stage.trim().toLowerCase();
		return normalized ? normalized : null;
	}

	function getMonsterStageLabel(stage: string): string {
		switch (stage) {
			case 'stage_1':
				return 'Stage 1';
			case 'stage_2':
				return 'Stage 2';
			case 'stage_3':
				return 'Stage 3';
			case 'final_stage':
				return 'Final Stage';
			case 'inactive':
				return 'Inactive';
			default:
				return stage.charAt(0).toUpperCase() + stage.slice(1);
		}
	}

	function getMonsterStageAccentColor(stage: string): string {
		switch (stage) {
			case 'stage_1':
				return '#c084fc';
			case 'stage_2':
				return '#6b21a8';
			case 'stage_3':
				return '#065f46';
			case 'final_stage':
				return '#a855f7';
			case 'inactive':
				return '#64748b';
			default:
				return '#94a3b8';
		}
	}

	const deckSections = $derived.by((): DeckSection[] => {
		const groups = visibleGroups;
		if (groups.length === 0) return [];

		const monsters = groups.filter((g) => g.item.type === 'monster');
		const events = groups.filter((g) => g.item.type === 'event');

		const sections: DeckSection[] = [];

		if (typeFilter !== 'event') {
			const effectiveStageByMonsterId = new Map<string, string | null>();
			const extraStages = new Set<string>();

			for (const g of monsters) {
				const monster = monsterById.get(g.item.id);
				const effective = monster
					? (inlineStageEdits[monster.id] ?? normalizeStageKey(monster.stage))
					: null;
				effectiveStageByMonsterId.set(g.item.id, effective);
				if (effective && !monsterStageGroupOrderSet.has(effective)) {
					extraStages.add(effective);
				}
			}

			const extraStageOrder = [...extraStages].sort((a, b) => a.localeCompare(b));

			if (monsters.length > 0) {
				for (const stage of monsterStageGroupOrder) {
					const stageGroups = monsters.filter((g) => effectiveStageByMonsterId.get(g.item.id) === stage);
					sections.push({
						key: `stage:${stage}`,
						label: getMonsterStageLabel(stage),
						accentColor: getMonsterStageAccentColor(stage),
						groups: stageGroups
					});
				}
			}

			for (const stage of extraStageOrder) {
				const stageGroups = monsters.filter((g) => effectiveStageByMonsterId.get(g.item.id) === stage);
				if (stageGroups.length === 0) continue;
				sections.push({
					key: `stage:${stage}`,
					label: getMonsterStageLabel(stage),
					accentColor: getMonsterStageAccentColor(stage),
					groups: stageGroups
				});
			}
		}

		if ((typeFilter === 'all' || typeFilter === 'event') && showEvents && events.length > 0) {
			sections.push({
				key: 'events',
				label: 'Stage Cards',
				accentColor: '#60a5fa',
				groups: events
			});
		}

		return sections;
	});

	$effect(() => {
		if (!showMonsters && editorType === 'monster') {
			closeEditor();
		}
	});

	$effect(() => {
		if (!showEvents && editorType === 'event') {
			closeEditor();
		}
	});

	$effect(() => {
		if (!showMonsters && typeFilter === 'monster') {
			typeFilter = 'all';
		}
	});

	$effect(() => {
		if (!showEvents && typeFilter === 'event') {
			typeFilter = 'all';
		}
	});

	$effect(() => {
		if (!editorOpen && editorType !== null) {
			closeEditor();
		}
	});

	const previewVariants = $derived.by(() =>
		monsterPreviewVariants && monsterPreviewVariants.length > 0 ? monsterPreviewVariants : []
	);
	const listPreviewVariant = $derived.by(() => previewVariants[0]);
	const MonsterPreviewComponent = $derived.by(() => monsterPreviewComponent);

	const MONSTER_PRINT_PREVIEW_W = 360;
	const MONSTER_PRINT_PREVIEW_H = 466; // 2550×3300 aspect ratio
	const LEGACY_CARD_PREVIEW_W = 600;
	const LEGACY_CARD_PREVIEW_H = 437;
	const editorTitle = $derived.by(() => {
		if (editorType === 'monster') {
			return editingId ? `Edit ${monsterLabel}` : `New ${monsterLabel}`;
		}
		if (editorType === 'event') {
			return editingId ? 'Edit Stage Card' : 'New Stage Card';
		}
		return 'Deck Editor';
	});
</script>

<div class="workspace">
	<section class="deck">
		<header class="deck-toolbar">
			<div class="toolbar-left">
				{#if showMonsters}
					<Button variant="primary" onclick={openNewMonster}>+ {monsterLabel}</Button>
					{#if enableOrdering}
						<Button
							variant="secondary"
							onclick={resetMonsterOrderByStage}
							disabled={savingOrder || deckOrder.length === 0}
						>
							Reset Monster Order
						</Button>
					{/if}
				{/if}
				{#if showEvents}
					<Button variant="primary" onclick={openNewEvent}>+ Stage Card</Button>
				{/if}
				{#if enableOrdering && orderChanged}
					<Button variant="secondary" onclick={resetOrder} disabled={savingOrder}>Reset</Button>
					<Button variant="primary" onclick={saveDeckOrder} disabled={savingOrder}>
						{savingOrder ? 'Saving…' : 'Save Order'}
					</Button>
				{/if}
			</div>
			<div class="toolbar-right">
				<div class="counts">
					<span class="badge">{totalGroups} entries</span>
					<span class="badge">{totalPhysicalCards} cards</span>
				</div>
				<Button
					variant="secondary"
					onclick={() => (showCardPreviews = !showCardPreviews)}
				>
					{showCardPreviews ? 'Disable Preview' : 'Enable Preview'}
				</Button>
				<input
					type="text"
					class="search"
					placeholder="Search…"
					bind:value={searchQuery}
				/>
				<select class="select" bind:value={typeFilter}>
					<option value="all">All</option>
					{#if showMonsters}
						<option value="monster">{monsterLabelPlural}</option>
					{/if}
					{#if showEvents}
						<option value="event">Stage Cards</option>
					{/if}
				</select>
				{#if showCardPreviews}
					<label class="scale">
						<span>Scale</span>
						<input type="range" min="35" max="120" step="5" bind:value={scalePercent} />
						<span class="scale-val">{scalePercent}%</span>
					</label>
				{/if}
			</div>
		</header>

		<div class="deck-list">
			{#if deckSections.length > 0}
				{#each deckSections as section (section.key)}
					<div class="deck-section" style="--section-accent: {section.accentColor};">
						<div class="deck-section__header">
							<h3>{section.label}</h3>
							<span class="deck-section__count">{section.groups.length}</span>
						</div>
						<div class="deck-section__body" role="list">
							{#each section.groups as { item, orderIndex } (item.type + ':' + item.id)}
								{@const isDragging = draggedIndex === orderIndex}
								{@const isDragOver = dragOverIndex === orderIndex}
								{@const isSelected = selectedKey === `${item.type}:${item.id}`}
								{@const monster = item.type === 'monster' ? monsterById.get(item.id) : null}
								{@const event = item.type === 'event' ? eventById.get(item.id) : null}
								{@const copies = item.type === 'monster' && enableQuantities ? (monster?.quantity ?? 1) : 1}

								<div
									class="group"
									class:selected={isSelected}
									class:dragging={isDragging}
									class:drag-over={isDragOver}
									draggable={enableOrdering}
									role="listitem"
									ondragstart={(e) => handleDragStart(e, orderIndex)}
									ondragover={(e) => handleDragOver(e, orderIndex)}
									ondragleave={handleDragLeave}
									ondrop={(e) => handleDrop(e, orderIndex)}
									ondragend={handleDragEnd}
								>
								<div class="group-header">
									<div class="group-meta">
										<span class="pos">#{orderIndex + 1}</span>
										<span class="type">{item.type === 'monster' ? `${monsterIcon} ${monsterLabel}` : '🎴 Stage Card'}</span>
										<span class="name">{getGroupLabel(item.type, item.id)}</span>
										{#if item.type === 'monster' && monster?.invade_location_id}
											{@const invadeName =
												(monster as unknown as { invade_location_name?: string | null }).invade_location_name ??
												locationNameById.get(monster.invade_location_id) ??
												null}
											{#if invadeName}
												<span class="invades">Invades: {invadeName}</span>
											{/if}
										{/if}
										{#if enableQuantities && item.type === 'monster' && copies > 1}
											<span class="copies">x{copies}</span>
										{/if}
									</div>

										<div class="group-actions">
											{#if !showCardPreviews && showStats && item.type === 'monster' && monster}
												{@const inlineStats = getInlineStats(monster)}
												{@const isSaving = inlineStatsSaving[monster.id] ?? false}
												{@const saveError = inlineStatsError[monster.id]}

												<div
													class="inline-stats"
													class:error={Boolean(saveError)}
													title={saveError ?? ''}
													onfocusout={(e) => handleInlineStatsFocusOut(monster.id, e)}
												>
													<label class="inline-stat">
														<span>DMG</span>
														<input
															type="number"
															min="0"
															step="1"
															value={inlineStats.damage}
															disabled={isSaving}
															aria-label="Damage"
															oninput={(e) =>
																setInlineStatValue(monster, 'damage', (e.target as HTMLInputElement).value)}
															onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), void saveInlineEdits(monster.id))}
														/>
													</label>
														<label class="inline-stat">
															<span>BAR</span>
															<input
																type="number"
																min="0"
																step="1"
																value={inlineStats.barrier}
																disabled={isSaving}
																aria-label="Barrier"
																oninput={(e) =>
																	setInlineStatValue(monster, 'barrier', (e.target as HTMLInputElement).value)}
																onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), void saveInlineEdits(monster.id))}
															/>
														</label>
														{#if isSaving}
															<span class="inline-stat-status">Saving…</span>
														{/if}
													{#if saveError}
														<span class="inline-stat-error">!</span>
													{/if}
												</div>
											{/if}
											{#if !showCardPreviews && item.type === 'monster' && monster}
												{@const isSaving = inlineStatsSaving[monster.id] ?? false}
												{@const saveError = inlineStatsError[monster.id]}
												<label class="inline-state" class:error={Boolean(saveError)} title={saveError ?? ''}>
													<span>Stage</span>
													<select
														value={getInlineStage(monster)}
														disabled={isSaving}
														aria-label="Stage"
														onchange={(e) => {
															setInlineStage(monster, (e.target as HTMLSelectElement).value);
															scheduleInlineAutosave(monster.id, 0);
														}}
													>
														<option value="stage_1">Stage 1</option>
														<option value="stage_2">Stage 2</option>
														<option value="stage_3">Stage 3</option>
														<option value="final_stage">Final Stage</option>
														<option value="inactive">Inactive</option>
													</select>
												</label>
											{/if}
												{#if !showCardPreviews && showSpecialEffects && item.type === 'monster' && monster && specialEffects.length > 0}
													{@const selectedEffects = getInlineEffectIds(monster.id)}
													{@const effectCount = selectedEffects.length}
													{@const isSaving = inlineStatsSaving[monster.id] ?? false}
												<button
													class="btn"
													onclick={() => toggleInlineEffectsPanel(monster.id)}
													disabled={isSaving}
												>
													Effects{effectCount > 0 ? ` (${effectCount})` : ''}
												</button>
											{/if}
												{#if item.type === 'event' && event?.card_kind === 'stage_location'}
													<button class="btn" onclick={() => openEdit(item.type, item.id)}>Edit Location</button>
												{:else}
													<button class="btn" onclick={() => openEdit(item.type, item.id)}>Edit</button>
												{/if}
												{#if item.type === 'monster'}
													<button class="btn" onclick={() => duplicateMonster(item.id)} disabled={duplicatingId === item.id}>
														{duplicatingId === item.id ? 'Duplicating…' : 'Duplicate'}
												</button>
											{/if}
											<button class="btn danger" onclick={() => requestDelete(item.type, item.id)}>Delete</button>
											{#if enableOrdering}
												<button class="btn" disabled={orderIndex === 0} onclick={() => moveGroup(orderIndex, 'up')}>
													↑
												</button>
												<button
													class="btn"
													disabled={orderIndex === deckOrder.length - 1}
													onclick={() => moveGroup(orderIndex, 'down')}
												>
													↓
												</button>
												<span class="drag-handle" title="Drag to reorder">⋮⋮</span>
											{/if}
										</div>
									</div>

									{#if !showCardPreviews && showSpecialEffects && item.type === 'monster' && monster && specialEffects.length > 0 && inlineEffectOpenId === monster.id}
										{@const selectedEffects = getInlineEffectIds(monster.id)}
										{@const isSaving = inlineStatsSaving[monster.id] ?? false}
										<div class="inline-effects-panel">
											<div class="inline-effects-panel__header">
												<div class="inline-effects-panel__title">
													Special Effects ({selectedEffects.length}/{INLINE_SPECIAL_EFFECT_MAX})
												</div>
												<button class="btn" onclick={() => closeInlineEffectsPanel(monster.id)} disabled={isSaving}>
													Close
												</button>
											</div>
											<div class="inline-effects-panel__list" role="list">
												{#each sortedSpecialEffects as effect (effect.id)}
													{@const isSelected = selectedEffects.includes(effect.id)}
													{@const atLimit = selectedEffects.length >= INLINE_SPECIAL_EFFECT_MAX && !isSelected}
													<label
														class="inline-effect-option"
														class:disabled={isSaving || atLimit}
														role="listitem"
													>
														<input
															type="checkbox"
															checked={isSelected}
															disabled={isSaving || atLimit}
															onchange={() => toggleInlineEffect(monster.id, effect.id)}
														/>
														{#if effect.icon}
															<span class="inline-effect-icon">{effect.icon}</span>
														{/if}
														<span class="inline-effect-name">{effect.name}</span>
													</label>
												{/each}
											</div>
											{#if inlineStatsError[monster.id]}
												<div class="inline-effects-panel__error">{inlineStatsError[monster.id]}</div>
											{/if}
										</div>
									{/if}

									{#if showCardPreviews}
										<div class="group-copies">
											{#if item.type === 'monster' && monster}
												{#each Array.from({ length: copies }, (_, i) => i) as idx (idx)}
													{@const previewW = MONSTER_PRINT_PREVIEW_W}
													{@const previewH = MONSTER_PRINT_PREVIEW_H}
													<div
														class="copy"
														class:selected={isSelected}
														style="--scale: {scale}; width: {previewW * scale}px; height: {previewH * scale}px;"
														role="button"
														tabindex="0"
														onclick={() => openEdit('monster', item.id)}
														onkeydown={(e) => e.key === 'Enter' && openEdit('monster', item.id)}
													>
														{#if copies > 1}
															<div class="copy-badge">{idx + 1}/{copies}</div>
														{/if}
														<LazyMount style="width: 100%; height: 100%; display: block;" rootMargin="1200px 0px">
															<div class="copy-inner">
																{#if listPreviewVariant !== undefined}
																	<MonsterPreviewComponent
																		monster={monster}
																		{language}
																		footerLabel={monsterLabel}
																		variant={listPreviewVariant}
																		renderMode="fast"
																	/>
																{:else}
																	<MonsterPreviewComponent monster={monster} {language} footerLabel={monsterLabel} renderMode="fast" />
																{/if}
															</div>
															<div slot="placeholder" class="copy-placeholder" aria-hidden="true" />
														</LazyMount>
													</div>
												{/each}
												{:else if item.type === 'event' && event}
													{@const previewW = LEGACY_CARD_PREVIEW_W}
													{@const previewH = LEGACY_CARD_PREVIEW_H}
													<div
														class="copy"
														class:selected={isSelected}
														style="--scale: {scale}; width: {previewW * scale}px; height: {previewH * scale}px;"
														role="button"
														tabindex="0"
														onclick={() => openEdit('event', item.id)}
														onkeydown={(e) => e.key === 'Enter' && openEdit('event', item.id)}
													>
														<LazyMount style="width: 100%; height: 100%; display: block;" rootMargin="1200px 0px">
															<div class="copy-inner">
																{#if event.card_kind === 'stage_location'}
																	{#if event.art_url}
																		<img src={event.art_url} alt={event.title} style="width: 100%; height: 100%; object-fit: cover;" />
																	{:else}
																		<div class="missing">Missing image</div>
																	{/if}
																{:else}
																	<EventCardPreview event={{ ...event, order_num: orderIndex }} />
																{/if}
															</div>
															<div slot="placeholder" class="copy-placeholder" aria-hidden="true" />
														</LazyMount>
													</div>
											{:else}
												<div class="missing">Missing data</div>
											{/if}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			{:else}
				<div class="empty">No matching cards.</div>
			{/if}
		</div>
	</section>
</div>

<Modal bind:open={editorOpen} title={editorTitle} size="xl" closeOnBackdrop={true} closeOnEscape={true}>
	{#snippet children()}
		<div class="editor">
			{#if editorType === null}
				<div class="editor-empty">
					<h3>Deck Editor</h3>
					<p>Select a card to edit, or create a new one.</p>
					<div class="editor-empty-actions">
						<Button variant="primary" onclick={openNewMonster}>+ {monsterLabel}</Button>
						{#if showEvents}
							<Button variant="primary" onclick={openNewEvent}>+ Stage Card</Button>
						{/if}
					</div>
				</div>
			{:else if editorType === 'monster'}
				<form class="editor-form" onsubmit={(e) => (e.preventDefault(), void saveMonster())}>
					<FormField label="Name" required>
						<Input type="text" bind:value={monsterFormData.name} required />
					</FormField>

					{#if showSubtext}
						<FormField label="Subtext">
							<Input type="text" bind:value={monsterFormData.subtext} placeholder="Short flavor line..." />
						</FormField>
					{/if}

						{#if showDescription}
							<FormField label="Description">
								<Textarea rows={3} bind:value={monsterFormData.description} placeholder="Longer detail..." />
							</FormField>
						{/if}

					{#if showStats}
						{#if showAttackTypeToggle}
							<FormField label="Attack Type">
								<div class="attack-type-toggle">
									<label class="attack-type-option">
										<input
											type="radio"
											name="attack_type"
											value="damage"
											checked={monsterFormData.attack_type === 'damage'}
											onchange={() => {
												monsterFormData.attack_type = 'damage';
												monsterFormData.dice_pool = [];
											}}
										/>
										Direct Damage
									</label>
									<label class="attack-type-option">
										<input
											type="radio"
											name="attack_type"
											value="dice_pool"
											checked={monsterFormData.attack_type === 'dice_pool'}
											onchange={() => {
												monsterFormData.attack_type = 'dice_pool';
												monsterFormData.damage = 0;
											}}
										/>
										Dice Pool
									</label>
								</div>
							</FormField>
						{/if}

						<div class="grid-2">
							{#if !showAttackTypeToggle || monsterFormData.attack_type === 'damage'}
								<FormField label="Damage">
									<Input type="number" min={0} bind:value={monsterFormData.damage} />
								</FormField>
							{/if}
							<FormField label="Barrier">
								<Input type="number" min={0} bind:value={monsterFormData.barrier} />
							</FormField>
						</div>
					{/if}

					{#if showStageAsInteger}
						<FormField label="Stage">
							<Input type="number" min={1} bind:value={monsterFormData.stage_num} />
						</FormField>
					{:else if enableQuantities}
						<div class="grid-2">
							<FormField label="Quantity" helperText="Copies in deck">
								<Input type="number" min={1} bind:value={monsterFormData.quantity} />
							</FormField>
							<FormField label="Stage">
									<Select
										bind:value={monsterFormData.stage}
										options={[
											{ value: 'stage_1', label: 'Stage 1' },
											{ value: 'stage_2', label: 'Stage 2' },
											{ value: 'stage_3', label: 'Stage 3' },
											{ value: 'final_stage', label: 'Final Stage' },
											{ value: 'inactive', label: 'Inactive' }
										]}
									/>
							</FormField>
						</div>
					{:else}
						<FormField label="Stage">
								<Select
									bind:value={monsterFormData.stage}
									options={[
										{ value: 'stage_1', label: 'Stage 1' },
										{ value: 'stage_2', label: 'Stage 2' },
										{ value: 'stage_3', label: 'Stage 3' },
										{ value: 'final_stage', label: 'Final Stage' },
										{ value: 'inactive', label: 'Inactive' }
									]}
								/>
						</FormField>
					{/if}

						<FormField label="Classification">
							<Select
								bind:value={monsterFormData.monster_classification}
								options={[
									{ value: 'monster', label: 'Monster' },
									{ value: 'abyss_guardian', label: 'Abyss Guardian' },
									{ value: 'boss', label: 'Stage Boss' },
									{ value: 'final_boss', label: 'Final Boss' }
								]}
							/>
						</FormField>

					<FormField label="Icon (emoji)">
						<Input type="text" bind:value={monsterFormData.icon} placeholder={monsterIcon} />
					</FormField>

						{#if showImageUpload}
							<FormField label="Artwork">
								<ImageUploader
									bind:value={monsterFormData.image_path}
									folder={imageUploadFolder}
									aspectRatio={imageUploadAspectRatio}
									cropTransparent={imageUploadCropTransparent}
									maxSizeMB={imageUploadMaxSizeMB}
									onerror={(err) => alert(`Upload failed: ${err}`)}
								/>
							</FormField>
						{/if}

						{#if showCardImageUpload}
							<FormField label="Card Image (PNG)">
								<ImageUploader
									bind:value={monsterFormData.card_image_path}
									folder={cardImageUploadFolder}
									filename={editingId ?? undefined}
									upsert={!!editingId}
									aspectRatio={cardImageUploadAspectRatio}
									cropTransparent={cardImageUploadCropTransparent}
									maxSizeMB={cardImageUploadMaxSizeMB}
									onerror={(err) => alert(`Upload failed: ${err}`)}
								/>
							</FormField>
						{/if}

						{#if showInvadeLocation}
							<FormField label="Invade Location (optional)">
								<Select
									value={monsterFormData.invade_location_id ?? ''}
								options={[
									{ value: '', label: 'None' },
									...locations.map((loc) => ({ value: loc.id, label: loc.name }))
								]}
								onchange={(e) => {
									const v = (e.target as HTMLSelectElement).value;
									monsterFormData.invade_location_id = v === '' ? null : v;
								}}
							/>
						</FormField>
					{/if}

					{#if showSpecialEffects}
						<FormField label="Special Effects">
							<SpecialEffectPicker bind:selected={monsterFormData.special_effect_ids} maxSelection={6} />
						</FormField>
					{/if}

					{#if !showAttackTypeToggle || monsterFormData.attack_type === 'dice_pool'}
					<div class="full-width dice-pool-editor">
							<div class="reward-track-editor__header">
								<div class="reward-track-editor__title">Dice Pool</div>
								<div class="reward-track-editor__hint">{monsterFormData.dice_pool.length} icons</div>
							</div>

							<div class="reward-track-editor__slots">
								{#each monsterFormData.dice_pool as iconId, idx (`dice:${iconId}:${idx}`)}
									{@const url = getIconPoolUrl(iconId)}
									<div class="reward-track-slot reward-track-slot--inline">
										<div class="reward-track-slot__icons">
											{#if url}
												<img src={url} alt="" loading="lazy" decoding="async" />
											{:else}
												<span class="reward-track-slot__placeholder">?</span>
											{/if}
										</div>
										<div class="reward-track-slot__actions">
											<button
												type="button"
												class="mini-btn"
												onclick={() => {
													const ids = [...monsterFormData.dice_pool];
													if (idx > 0) { [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]]; monsterFormData.dice_pool = ids; }
												}}
												disabled={idx === 0}
											>
												↑
											</button>
											<button
												type="button"
												class="mini-btn"
												onclick={() => {
													const ids = [...monsterFormData.dice_pool];
													if (idx < ids.length - 1) { [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]]; monsterFormData.dice_pool = ids; }
												}}
												disabled={idx === monsterFormData.dice_pool.length - 1}
											>
												↓
											</button>
											<button
												type="button"
												class="mini-btn mini-btn--danger"
												onclick={() => { monsterFormData.dice_pool = monsterFormData.dice_pool.filter((_, i) => i !== idx); }}
											>
												✕
											</button>
										</div>
									</div>
								{/each}
								{#if monsterFormData.dice_pool.length === 0}
									<div class="reward-track-editor__empty">No dice pool icons.</div>
								{/if}
							</div>

							<div class="reward-track-editor__picker">
								<div class="reward-track-editor__picker-header">
									<span>Edit Dice Pool</span>
									<div class="reward-track-editor__picker-actions">
										<Button
											variant="secondary"
											size="sm"
											onclick={() => (dicePoolPickerOpen = !dicePoolPickerOpen)}
										>
											{dicePoolPickerOpen ? 'Hide picker' : 'Show picker'}
										</Button>
										<Button
											variant="danger"
											size="sm"
											onclick={() => { monsterFormData.dice_pool = []; }}
											disabled={monsterFormData.dice_pool.length === 0}
										>
											Clear all
										</Button>
									</div>
								</div>

								{#if dicePoolPickerOpen}
									<IconPicker
										selected={monsterFormData.dice_pool}
										onselect={(ids) => { monsterFormData.dice_pool = ids; }}
										multiple={true}
										allowDuplicates={true}
									/>
								{/if}
							</div>
						</div>
					{/if}

					{#if showRewardRows}
							{@const rewardIcons = monsterFormData.reward_track ?? []}
							<div class="full-width reward-track-editor">
								<div class="reward-track-editor__header">
									<div class="reward-track-editor__title">On-Kill Rewards</div>
									<div class="reward-track-editor__hint">{rewardIcons.length}/6 slots</div>
								</div>

								<div class="reward-track-editor__slots">
									{#each rewardIcons as iconId, idx (`kill:${iconId}:${idx}`)}
										{@const url = getIconPoolUrl(iconId)}
										<div class="reward-track-slot reward-track-slot--inline">
											<div class="reward-track-slot__icons">
												{#if url}
													<img src={url} alt="" loading="lazy" decoding="async" />
												{:else}
													<span class="reward-track-slot__placeholder">?</span>
												{/if}
											</div>
											<div class="reward-track-slot__actions">
												<button
													type="button"
													class="mini-btn"
													onclick={() => moveRewardTrackIcon(idx, idx - 1)}
													disabled={idx === 0}
												>
													↑
												</button>
												<button
													type="button"
													class="mini-btn"
													onclick={() => moveRewardTrackIcon(idx, idx + 1)}
													disabled={idx === rewardIcons.length - 1}
												>
													↓
												</button>
												<button
													type="button"
													class="mini-btn mini-btn--danger"
													onclick={() => removeRewardTrackIcon(idx)}
												>
													✕
												</button>
											</div>
										</div>
									{/each}
									{#if rewardIcons.length === 0}
										<div class="reward-track-editor__empty">No on-kill rewards.</div>
									{/if}
								</div>

								<div class="reward-track-editor__picker">
									<div class="reward-track-editor__picker-header">
										<span>Edit On-Kill Rewards</span>
										<div class="reward-track-editor__picker-actions">
											<Button
												variant="secondary"
												size="sm"
												onclick={() => (rewardTrackPickerOpen = !rewardTrackPickerOpen)}
											>
												{rewardTrackPickerOpen ? 'Hide picker' : 'Show picker'}
											</Button>
											<Button
												variant="danger"
												size="sm"
												onclick={clearRewardTrack}
												disabled={rewardIcons.length === 0}
											>
												Clear all
											</Button>
										</div>
									</div>

									{#if rewardTrackPickerOpen}
										<IconPicker
											selected={rewardIcons}
											onselect={(ids) => setRewardTrack(ids)}
											multiple={true}
											maxSelection={6}
											allowDuplicates={true}
										/>
									{/if}
								</div>
							</div>

							<FormField label="Choose Amount" helperText="0 = hidden on card">
								<Input type="number" min={0} bind:value={monsterFormData.choose_amount} />
							</FormField>
						{/if}

					<div class="editor-actions">
						<Button variant="primary" type="submit">Save</Button>
						<Button type="button" onclick={closeEditor}>Close</Button>
						{#if editingId}
							<Button type="button" variant="danger" onclick={() => requestDelete('monster', editingId!)}>
								Delete
							</Button>
						{/if}
					</div>
				</form>
				{:else if showEvents}
					<form class="editor-form" onsubmit={(e) => (e.preventDefault(), void saveEvent())}>
						<FormField label="Type" required>
							<Select bind:value={eventFormData.event_type} options={EVENT_TYPE_OPTIONS} />
						</FormField>
						<FormField label="Style" required>
							<Select bind:value={eventFormData.render_style} options={STAGE_EVENT_RENDER_STYLE_OPTIONS} />
						</FormField>
						<FormField label="Title" required>
							<Input type="text" bind:value={eventFormData.title} required />
						</FormField>
					<FormField label="Description">
						<Textarea rows={4} bind:value={eventFormData.description} />
					</FormField>
						{#if showEventRewardRows}
						<div class="full-width">
							<RewardRowsEditor bind:rewardRows={eventFormData.reward_rows} defaultType="all_players" />
						</div>
					{/if}

					<div class="editor-actions">
						<Button variant="primary" type="submit">Save</Button>
						<Button type="button" onclick={closeEditor}>Close</Button>
						{#if editingId}
							<Button type="button" variant="danger" onclick={() => requestDelete('event', editingId!)}>
								Delete
							</Button>
						{/if}
					</div>
				</form>
			{/if}
		</div>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={showDeleteConfirm}
	title="Delete card?"
	message={deleteTarget ? `Delete “${deleteTarget.label}”? This cannot be undone.` : 'Delete this card?'}
	confirmLabel={deleting ? 'Deleting…' : 'Delete'}
	cancelLabel="Cancel"
	variant="danger"
	onconfirm={() => void confirmDelete()}
	oncancel={() => (deleteTarget = null)}
/>

<style>
	.attack-type-toggle {
		display: flex;
		gap: 1rem;
	}
	.attack-type-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		font-size: 0.875rem;
	}
	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.75rem;
		height: 100%;
		min-height: 0;
	}

	.deck {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: rgba(2, 6, 23, 0.25);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		overflow: hidden;
	}

	.deck-toolbar {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		flex-wrap: wrap;
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.counts {
		display: flex;
		gap: 0.35rem;
	}

	.badge {
		padding: 0.2rem 0.45rem;
		font-size: 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(30, 41, 59, 0.4);
		color: #cbd5e1;
	}

	.search {
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
		font-size: 0.85rem;
		min-width: 220px;
	}

	.search:focus {
		outline: none;
		border-color: rgba(168, 85, 247, 0.6);
	}

	.select {
		padding: 0.4rem 0.5rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.scale {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.scale input[type='range'] {
		width: 120px;
	}

	.scale-val {
		min-width: 44px;
		text-align: right;
	}

	.deck-list {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.deck-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.deck-section__header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0 0.25rem;
		border-left: 3px solid var(--section-accent);
	}

	.deck-section__header h3 {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.9);
	}

	.deck-section__count {
		font-size: 0.72rem;
		font-weight: 700;
		color: rgba(148, 163, 184, 0.95);
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 999px;
		padding: 0.15rem 0.45rem;
	}

	.deck-section__body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.group {
		border: 2px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		background: rgba(30, 41, 59, 0.35);
		padding: 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.group.selected {
		border-color: rgba(168, 85, 247, 0.55);
		box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.25) inset;
	}

	.group.dragging {
		opacity: 0.55;
	}

	.group.drag-over {
		border-color: rgba(59, 130, 246, 0.55);
	}

	.group-header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.group-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.pos {
		font-size: 0.75rem;
		font-weight: 800;
		color: #e2e8f0;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 0.15rem 0.4rem;
	}

	.type {
		font-size: 0.75rem;
		color: #94a3b8;
		white-space: nowrap;
	}

	.name {
		font-size: 0.85rem;
		font-weight: 700;
		color: #f8fafc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 520px;
	}

	.invades {
		font-size: 0.72rem;
		font-weight: 700;
		color: rgba(226, 232, 240, 0.82);
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 999px;
		padding: 0.12rem 0.45rem;
		white-space: nowrap;
		max-width: 260px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.copies {
		font-size: 0.7rem;
		font-weight: 700;
		color: #c084fc;
		background: rgba(168, 85, 247, 0.15);
		border: 1px solid rgba(168, 85, 247, 0.25);
		border-radius: 999px;
		padding: 0.15rem 0.4rem;
		white-space: nowrap;
	}

	.group-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.inline-stats {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.15rem 0.35rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.4);
	}

	.inline-stats.error {
		border-color: rgba(248, 113, 113, 0.55);
	}

	.inline-stat {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.65rem;
		color: #94a3b8;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.inline-stat input {
		width: 52px;
		padding: 0.25rem 0.35rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(2, 6, 23, 0.35);
		color: #f8fafc;
		font-size: 0.8rem;
		font-weight: 800;
		text-align: center;
	}

	.inline-stat input:focus {
		outline: none;
		border-color: rgba(168, 85, 247, 0.55);
	}

	.inline-stat input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.inline-stat-error {
		font-size: 0.75rem;
		font-weight: 900;
		color: #f87171;
		padding: 0 0.15rem;
	}

	.inline-stat-status {
		font-size: 0.7rem;
		font-weight: 800;
		color: rgba(226, 232, 240, 0.85);
		white-space: nowrap;
		padding: 0 0.15rem;
	}

	.inline-state {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.15rem 0.4rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.4);
		font-size: 0.65rem;
		color: #94a3b8;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.inline-state.error {
		border-color: rgba(248, 113, 113, 0.55);
	}

	.inline-state select {
		padding: 0.25rem 0.35rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(2, 6, 23, 0.35);
		color: #f8fafc;
		font-size: 0.75rem;
		font-weight: 800;
	}

	.inline-state select:focus {
		outline: none;
		border-color: rgba(168, 85, 247, 0.55);
	}

	.inline-state select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.inline-effects-panel {
		margin-top: 0.25rem;
		padding: 0.6rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(2, 6, 23, 0.28);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.inline-effects-panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.inline-effects-panel__title {
		font-size: 0.75rem;
		font-weight: 800;
		color: rgba(226, 232, 240, 0.9);
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.inline-effects-panel__list {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.35rem 0.5rem;
		max-height: 220px;
		overflow: auto;
		padding-right: 0.25rem;
	}

	.inline-effect-option {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.5rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.16);
		background: rgba(15, 23, 42, 0.35);
		color: #e2e8f0;
		font-size: 0.85rem;
		cursor: pointer;
		user-select: none;
	}

	.inline-effect-option:hover:not(.disabled) {
		border-color: rgba(96, 165, 250, 0.35);
		background: rgba(30, 41, 59, 0.45);
	}

	.inline-effect-option.disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.inline-effect-option input {
		accent-color: rgba(96, 165, 250, 0.9);
	}

	.inline-effect-icon {
		font-size: 0.95rem;
	}

	.inline-effect-name {
		font-weight: 650;
	}

	.inline-effects-panel__actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.inline-effects-panel__error {
		padding: 0.4rem 0.5rem;
		border-radius: 8px;
		border: 1px solid rgba(248, 113, 113, 0.4);
		background: rgba(248, 113, 113, 0.08);
		color: #fecaca;
		font-size: 0.8rem;
	}

	.btn {
		padding: 0.25rem 0.5rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.55);
		color: #cbd5e1;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.btn:hover {
		border-color: rgba(59, 130, 246, 0.4);
		background: rgba(59, 130, 246, 0.12);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.btn.danger {
		border-color: rgba(248, 113, 113, 0.35);
		background: rgba(248, 113, 113, 0.12);
		color: #fecaca;
	}

	.btn.danger:hover {
		background: rgba(248, 113, 113, 0.18);
		border-color: rgba(248, 113, 113, 0.5);
	}

	.drag-handle {
		color: #64748b;
		padding: 0 0.25rem;
		user-select: none;
		cursor: grab;
	}

	.group-copies {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		align-items: flex-start;
	}

	.copy {
		position: relative;
		border-radius: 10px;
		border: 2px solid transparent;
		content-visibility: auto;
		contain: layout paint;
	}

	.copy.selected {
		border-color: rgba(168, 85, 247, 0.55);
	}

	.copy-inner {
		transform: scale(var(--scale));
		transform-origin: top left;
	}

	.copy-placeholder {
		width: 100%;
		height: 100%;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.copy-badge {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 10;
		padding: 0.2rem 0.4rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #e2e8f0;
	}

	.missing,
	.empty {
		padding: 1rem;
		text-align: center;
		color: #94a3b8;
	}

	.editor {
		display: flex;
		flex-direction: column;
		min-height: 0;
		background: rgba(2, 6, 23, 0.15);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 12px;
		overflow: hidden;
	}

	.editor-empty {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.editor-empty h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	.editor-empty p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.editor-empty-actions {
		display: flex;
		gap: 0.5rem;
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(15, 23, 42, 0.6);
	}

	.editor-header h3 {
		margin: 0;
		font-size: 0.95rem;
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.5);
		color: #cbd5e1;
		cursor: pointer;
	}

	.icon-btn:hover {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.35);
	}

	.editor-preview {
		padding: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.editor-preview .copy-inner {
		transform: scale(var(--scale));
		transform-origin: top left;
	}

	.editor-preview-grid {
		padding: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		justify-items: center;
		align-items: start;
	}

	.preview-cell .copy-inner {
		transform: scale(var(--scale));
		transform-origin: top left;
	}

	.editor-form {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
	}

	.checkbox-field {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.9rem;
		color: rgba(226, 232, 240, 0.85);
	}

	.checkbox-field input[type='checkbox'] {
		width: 16px;
		height: 16px;
		accent-color: rgba(59, 130, 246, 0.85);
	}

	.full-width {
		width: 100%;
	}

		.reward-track-editor {
			display: flex;
			flex-direction: column;
			gap: 0.6rem;
			padding: 0.6rem 0.65rem;
			border-radius: 10px;
			border: 1px solid rgba(148, 163, 184, 0.16);
			background: rgba(15, 23, 42, 0.35);
		}

		.reward-track-editor__header {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.5rem;
			flex-wrap: wrap;
		}

		.reward-track-editor__title {
			font-size: 0.8rem;
			font-weight: 700;
			color: #e2e8f0;
		}

		.reward-track-editor__hint {
			font-size: 0.7rem;
			color: #94a3b8;
		}

		.reward-track-editor__slots {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
			gap: 0.5rem;
		}

		.reward-track-slot {
			display: flex;
			flex-direction: column;
			gap: 0.35rem;
			padding: 0.6rem 0.65rem;
			border-radius: 10px;
			border: 1px solid rgba(148, 163, 184, 0.18);
			background: rgba(2, 6, 23, 0.35);
			cursor: pointer;
			transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
			text-align: left;
		}

		.reward-track-slot:hover {
			transform: translateY(-1px);
			border-color: rgba(168, 85, 247, 0.45);
			background: rgba(168, 85, 247, 0.1);
		}

		.reward-track-slot--active {
			border-color: rgba(168, 85, 247, 0.75);
			background: rgba(168, 85, 247, 0.12);
		}

		.reward-track-slot__label {
			font-size: 0.7rem;
			font-weight: 800;
			letter-spacing: 0.08em;
			text-transform: uppercase;
			color: rgba(226, 232, 240, 0.9);
		}

		.reward-track-slot__icons {
			display: flex;
			flex-wrap: wrap;
			gap: 0.35rem;
			align-items: center;
			min-height: 34px;
		}

		.reward-track-slot__icons img {
			width: 30px;
			height: 30px;
			object-fit: contain;
			filter:
				drop-shadow(1px 0 0 rgba(43, 26, 18, 0.9))
				drop-shadow(-1px 0 0 rgba(43, 26, 18, 0.9))
				drop-shadow(0 1px 0 rgba(43, 26, 18, 0.9))
				drop-shadow(0 -1px 0 rgba(43, 26, 18, 0.9));
		}

		.reward-track-slot__placeholder {
			width: 30px;
			height: 30px;
			display: grid;
			place-items: center;
			border-radius: 8px;
			border: 1px dashed rgba(148, 163, 184, 0.3);
			color: rgba(148, 163, 184, 0.8);
			font-size: 1.1rem;
		}

		.reward-track-slot__more {
			font-size: 0.75rem;
			font-weight: 700;
			color: rgba(226, 232, 240, 0.75);
			padding: 0 0.25rem;
		}

		.reward-track-slot--inline {
			cursor: default;
			flex-direction: row;
			align-items: center;
			justify-content: space-between;
		}

		.reward-track-slot--inline:hover {
			transform: none;
			border-color: rgba(148, 163, 184, 0.18);
			background: rgba(2, 6, 23, 0.35);
		}

		.reward-track-slot__actions {
			display: flex;
			gap: 0.25rem;
			align-items: center;
			margin-left: auto;
		}

		.mini-btn {
			border: 1px solid rgba(148, 163, 184, 0.25);
			background: rgba(30, 41, 59, 0.4);
			color: rgba(226, 232, 240, 0.9);
			border-radius: 8px;
			padding: 0.25rem 0.45rem;
			font-size: 0.8rem;
			line-height: 1;
			cursor: pointer;
		}

		.mini-btn:disabled {
			opacity: 0.4;
			cursor: not-allowed;
		}

		.mini-btn--danger {
			border-color: rgba(248, 113, 113, 0.35);
			color: rgba(248, 113, 113, 0.95);
		}

		.reward-track-editor__picker {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			margin-top: 0.25rem;
		}

		.reward-track-editor__picker-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 0.5rem;
			flex-wrap: wrap;
			font-size: 0.75rem;
			color: #cbd5e1;
		}

		.reward-track-editor__picker-actions {
			display: flex;
			gap: 0.4rem;
			flex-wrap: wrap;
		}

		.reward-track-editor__empty {
			font-size: 0.75rem;
			color: rgba(148, 163, 184, 0.9);
			padding: 0.25rem 0;
		}

		.dice-pool-editor {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
		}

		.dice-pool-name {
			font-size: 0.8rem;
			color: #e2e8f0;
			flex: 1;
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.dice-pool-select {
			padding: 0.35rem 0.5rem;
			border-radius: 8px;
			border: 1px solid rgba(148, 163, 184, 0.2);
			background: rgba(2, 6, 23, 0.35);
			color: #e2e8f0;
			font-size: 0.8rem;
		}

		.editor-actions {
			margin-top: 0.25rem;
			display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

</style>
