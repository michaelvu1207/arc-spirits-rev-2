<script lang="ts">
	import { onMount } from 'svelte';
	import type { GameLocationRow, GameLocationRewardRow, LocationIconPlacementConfigRow, GameLocationRowCompositionRow } from '$lib/types/gameData';
	import { supabase } from '$lib/api/supabaseClient';
	import { fetchLocationIconPlacementConfig, upsertLocationIconPlacementConfig } from '$lib/api/locationIconPlacementConfig';
	import { fetchGameLocationRows, upsertGameLocationRow, updateGameLocationRow } from '$lib/api/gameLocationRows';
	import { loadAllIcons, getIconPoolUrl } from '$lib/utils/iconPool';
	import { getErrorMessage } from '$lib/utils';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { Modal, type Tab } from '$lib/components/layout';
	import { Button } from '$lib/components/ui';
	import { ImageUploader } from '$lib/components/shared';
	import {
		loadLocationIconPlacementConfig,
		normalizeLocationIconPlacementConfig,
		type LocationIconPlacementConfig,
		type LocationRowPlacement,
		type IconSlot
	} from '$lib/generators/locations/locationIconPlacer';
	import {
		generateLocationFromRowImages,
		generateLocationRowFromTemplate,
		generateLocationTextRowFromTemplate
	} from '$lib/generators/locations/locationRowComposer';

	interface Props {
		isOpen?: boolean;
		locations: GameLocationRow[];
		onClose?: () => void;
		onUpdated?: () => void;
	}

	let { isOpen = $bindable(false), locations, onClose, onUpdated }: Props = $props();

	const tabs: Tab[] = [
		{ id: 'row', label: 'Row Editor', icon: '🧩' },
		{ id: 'location', label: 'Location Editor', icon: '🗺️' }
	];
	let activeTab = $state('row');

	let selectedLocationId = $state<string>('');
	let selectedRowIndex = $state<number>(0);

	let loading = $state(false);
	let error = $state<string | null>(null);

	let config = $state<LocationIconPlacementConfig>(loadLocationIconPlacementConfig());
	let locationRows = $state<GameLocationRowCompositionRow[]>([]);

	const gameAssets = supabase.storage.from('game_assets');

	let lastOpen = $state(false);
	$effect(() => {
		if (isOpen && !lastOpen) {
			lastOpen = true;
			void refresh();
		}
		if (!isOpen && lastOpen) {
			lastOpen = false;
			onClose?.();
		}
	});

	const selectedLocation = $derived.by(
		() => locations.find((l) => l.id === selectedLocationId) ?? null
	);

	const rowsByIndex = $derived.by(() => new Map(locationRows.map((r) => [r.row_index, r])));

	const selectedRewardRow = $derived.by(() => {
		const loc = selectedLocation;
		if (!loc) return null;
		return loc.reward_rows?.[selectedRowIndex] ?? null;
	});

	const template = $derived.by<LocationRowPlacement>(() => config.rows?.[0] ?? loadLocationIconPlacementConfig().rows[0]);
	const iconSize = $derived.by(() => config._icon_size ?? 80);

	const gainRowBackgroundUrl = $derived.by(() => publicAssetUrl(config.gain_row_background?.path ?? null));
	const tradeRowBackgroundUrl = $derived.by(() => publicAssetUrl(config.trade_row_background?.path ?? null));
	const textRowBackgroundUrl = $derived.by(() => publicAssetUrl(config.text_row_background?.path ?? null));
	const currentRowBackgroundType = $derived.by<'gain' | 'trade'>(() => (currentSlotKind === 'gain' ? 'gain' : 'trade'));
	const currentRowBackgroundUrl = $derived.by(() => rowBackgroundUrlFor(currentRowBackgroundType));

	function rowBackgroundUrlFor(type: 'gain' | 'trade' | 'text') {
		if (type === 'trade') return tradeRowBackgroundUrl;
		if (type === 'text') return textRowBackgroundUrl ?? gainRowBackgroundUrl;
		return gainRowBackgroundUrl;
	}

	function resolveIconUrl(iconId: string) {
		return getIconPoolUrl(iconId);
	}

	async function refresh() {
		error = null;
		loading = true;
		try {
			await loadAllIcons();
			if (!selectedLocationId && locations.length > 0) selectedLocationId = locations[0].id;
			config = await fetchLocationIconPlacementConfig();
			if (selectedLocationId) {
				locationRows = await fetchGameLocationRows(selectedLocationId);
			} else {
				locationRows = [];
			}
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		if (!selectedLocationId && locations.length > 0) selectedLocationId = locations[0].id;
		await refresh();
	});

	// =========================
	// Row template editor state
	// =========================
	type SlotKind = 'gain' | 'trade_cost' | 'trade_gain';
	let currentSlotKind = $state<SlotKind>('gain');

	let rowBgSize = $state<{ w: number; h: number } | null>(null);
	let rowScale = $state(1);

	async function measureRowBackground() {
		const type = currentSlotKind === 'gain' ? 'gain' : 'trade';
		const url = rowBackgroundUrlFor(type);
		if (!url) {
			rowBgSize = null;
			return;
		}
		try {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.src = url;
			await img.decode();
			rowBgSize = { w: img.width, h: img.height };
			const maxW = 760;
			rowScale = img.width > maxW ? maxW / img.width : 1;
		} catch {
			rowBgSize = null;
		}
	}

	$effect(() => {
		if (activeTab !== 'row') return;
		void measureRowBackground();
	});

	function getSlots(kind: SlotKind): IconSlot[] {
		if (kind === 'gain') return template.gain_slots;
		if (kind === 'trade_cost') return template.trade_cost_slots;
		return template.trade_gain_slots;
	}

	function setSlots(kind: SlotKind, slots: IconSlot[]) {
		const defaultSize = iconSize;
		const normalized = slots.map((s) => ({
			x: s.x,
			y: s.y,
			w: s.w ?? defaultSize,
			h: s.h ?? defaultSize
		}));
		const nextTemplate: LocationRowPlacement = {
			gain_slots: kind === 'gain' ? normalized : template.gain_slots,
			trade_cost_slots: kind === 'trade_cost' ? normalized : template.trade_cost_slots,
			trade_gain_slots: kind === 'trade_gain' ? normalized : template.trade_gain_slots
		};
		config = normalizeLocationIconPlacementConfig({
			...config,
			rows: [nextTemplate]
		});
	}

	let draggingSlot = $state<{ kind: SlotKind; index: number; offsetX: number; offsetY: number } | null>(null);
	let resizingSlot = $state<{
		kind: SlotKind;
		index: number;
		startX: number;
		startY: number;
		startW: number;
		startH: number;
	} | null>(null);

	function onSlotPointerDown(e: PointerEvent, kind: SlotKind, index: number) {
		const canvas = (e.currentTarget as HTMLElement).closest('.row-template__canvas') as HTMLElement | null;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;
		const slot = getSlots(kind)[index];
		const slotLeft = slot.x * rowScale;
		const slotTop = slot.y * rowScale;
		draggingSlot = { kind, index, offsetX: pointerX - slotLeft, offsetY: pointerY - slotTop };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onSlotResizePointerDown(e: PointerEvent, kind: SlotKind, index: number) {
		e.stopPropagation();
		const canvas = (e.currentTarget as HTMLElement).closest('.row-template__canvas') as HTMLElement | null;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const pointerX = (e.clientX - rect.left) / rowScale;
		const pointerY = (e.clientY - rect.top) / rowScale;
		const slot = getSlots(kind)[index];
		resizingSlot = {
			kind,
			index,
			startX: pointerX,
			startY: pointerY,
			startW: slot.w ?? iconSize,
			startH: slot.h ?? iconSize
		};
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onRowCanvasPointerMove(e: PointerEvent) {
		if (resizingSlot) {
			const canvas = e.currentTarget as HTMLElement;
			const rect = canvas.getBoundingClientRect();
			const pointerX = (e.clientX - rect.left) / rowScale;
			const pointerY = (e.clientY - rect.top) / rowScale;

			const dx = pointerX - resizingSlot.startX;
			const dy = pointerY - resizingSlot.startY;
			const delta = Math.max(dx, dy);
			const nextSize = Math.max(8, resizingSlot.startW + delta);

			const slots = [...getSlots(resizingSlot.kind)];
			const slot = slots[resizingSlot.index];
			slots[resizingSlot.index] = { ...slot, w: nextSize, h: nextSize };
			setSlots(resizingSlot.kind, slots);
			return;
		}

		if (!draggingSlot) return;
		const canvas = e.currentTarget as HTMLElement;
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left - draggingSlot.offsetX) / rowScale;
		const y = (e.clientY - rect.top - draggingSlot.offsetY) / rowScale;

		const slots = [...getSlots(draggingSlot.kind)];
		slots[draggingSlot.index] = { x, y };
		setSlots(draggingSlot.kind, slots);
	}

	function onRowCanvasPointerUp() {
		draggingSlot = null;
		resizingSlot = null;
	}

	async function saveTemplate() {
		try {
			config = await upsertLocationIconPlacementConfig(config);
		} catch (err) {
			alert(getErrorMessage(err));
		}
	}

	// =========================
	// Row PNG generation
	// =========================
	async function ensureLocationRowRecord(locationId: string, rowIndex: number, type: 'gain' | 'trade' | 'text') {
		const existing = await supabase
			.from('game_location_rows')
			.select('*')
			.eq('location_id', locationId)
			.eq('row_index', rowIndex)
			.maybeSingle<GameLocationRowCompositionRow>();

		if (existing.data) return existing.data;
		return await upsertGameLocationRow({
			location_id: locationId,
			row_index: rowIndex,
			type,
			config: {} as any
		});
	}

	function clampRewardRow(row: GameLocationRewardRow): GameLocationRewardRow {
		if (row.type === 'text') {
			return { type: 'text', text: String(row.text ?? '').trim() };
		}
		if (row.type === 'trade') {
			return {
				type: 'trade',
				cost_icon_ids: (row.cost_icon_ids ?? []).slice(0, 2),
				gain_icon_ids: (row.gain_icon_ids ?? []).slice(0, 3)
			};
		}
		return { type: 'gain', gain_icon_ids: (row.gain_icon_ids ?? []).slice(0, 4) };
	}

	async function renderRowPngForLocation(location: GameLocationRow, rowIndex: number) {
		const row = location.reward_rows?.[rowIndex];
		if (!row) return;

		const clamped = clampRewardRow(row);
		const type = clamped.type;
		const bgUrl = rowBackgroundUrlFor(type);
		if (!bgUrl) throw new Error(`Missing ${type} row background.`);

		if (type === 'text') {
			const blob = await generateLocationTextRowFromTemplate({
				backgroundUrl: bgUrl,
				text: clamped.text
			});
			return { type, blob };
		}

		if (type === 'gain') {
			const blob = await generateLocationRowFromTemplate({
				backgroundUrl: bgUrl,
				iconSize,
				slots: template.gain_slots,
				iconIds: clamped.gain_icon_ids ?? [],
				resolveIconUrl
			});
			return { type, blob };
		}

		// trade: render cost on cost slots and gain on gain slots, composited onto same background
		const isSingleTradePair = (clamped.cost_icon_ids?.length ?? 0) === 1 && (clamped.gain_icon_ids?.length ?? 0) === 1;
		const costSlots = isSingleTradePair ? template.trade_cost_slots.slice(-1) : template.trade_cost_slots;
		const gainSlots = isSingleTradePair ? template.trade_gain_slots.slice(0, 1) : template.trade_gain_slots;

		const base = await generateLocationRowFromTemplate({
			backgroundUrl: bgUrl,
			iconSize,
			slots: costSlots,
			iconIds: clamped.cost_icon_ids ?? [],
			resolveIconUrl
		});

		// Second pass: draw rewards on top of the first render
		const tmpUrl = URL.createObjectURL(base);
		try {
			const final = await generateLocationRowFromTemplate({
				backgroundUrl: tmpUrl,
				iconSize,
				slots: gainSlots,
				iconIds: clamped.gain_icon_ids ?? [],
				resolveIconUrl
			});
			return { type, blob: final };
		} finally {
			URL.revokeObjectURL(tmpUrl);
		}
	}

	async function renderRowsForLocation(location: GameLocationRow) {
		const targetCount = location.reward_rows?.length ?? 0;
		for (let i = 0; i < targetCount; i++) {
			const row = location.reward_rows[i];
			const result = await renderRowPngForLocation(location, i);
			if (!result) continue;

			const record = await ensureLocationRowRecord(location.id, i, result.type);
			const stamp = Date.now();
			const storagePath = `game_locations/${location.id}/rows/row_${i + 1}_${stamp}.png`;
			const { error: uploadError } = await gameAssets.upload(storagePath, result.blob, {
				contentType: 'image/png',
				upsert: true
			});
			if (uploadError) throw uploadError;

			if (record.row_image_path && record.row_image_path !== storagePath) {
				const { error: removeError } = await gameAssets.remove([record.row_image_path]);
				if (removeError) {
					console.warn('Failed to remove old row image', removeError);
				}
			}

			const updatedRow = await updateGameLocationRow(record.id, { row_image_path: storagePath });
			locationRows = locationRows.some((r) => r.id === updatedRow.id)
				? locationRows.map((r) => (r.id === updatedRow.id ? updatedRow : r))
				: [...locationRows, updatedRow];
		}

		await cleanupExtraRows(location.id, targetCount);
	}

	async function cleanupExtraRows(locationId: string, keepCount: number) {
		const { data, error: fetchError } = await supabase
			.from('game_location_rows')
			.select('id, row_index, row_image_path')
			.eq('location_id', locationId)
			.order('row_index', { ascending: true });
		if (fetchError) throw fetchError;

		const extras = (data ?? []).filter((row) => (row.row_index ?? 0) >= keepCount);
		if (extras.length === 0) return;

		const paths = extras
			.map((row) => row.row_image_path)
			.filter((path): path is string => typeof path === 'string' && path.length > 0);

		if (paths.length > 0) {
			const { error: removeError } = await gameAssets.remove(paths);
			if (removeError) {
				console.warn('Failed to remove orphaned row images', removeError);
			}
		}

		const ids = extras.map((row) => row.id);
		if (ids.length > 0) {
			const { error: deleteError } = await supabase.from('game_location_rows').delete().in('id', ids);
			if (deleteError) throw deleteError;
		}
		locationRows = locationRows.filter(
			(row) => row.location_id !== locationId || (row.row_index ?? 0) < keepCount
		);
	}

	let batchRunning = $state(false);
	let batchProgress = $state<{ processed: number; total: number; current: string }>({ processed: 0, total: 0, current: '' });
	let layoutSyncRunning = $state(false);
	let imageBatchRunning = $state(false);
	let imageBatchProgress = $state<{ processed: number; total: number; current: string }>({ processed: 0, total: 0, current: '' });

	async function renderRowsForAllLocations() {
		const needsGain = locations.some((loc) => (loc.reward_rows ?? []).some((rr) => rr.type === 'gain'));
		const needsTrade = locations.some((loc) => (loc.reward_rows ?? []).some((rr) => rr.type === 'trade'));
		const needsText = locations.some((loc) => (loc.reward_rows ?? []).some((rr) => rr.type === 'text'));

		if (needsGain && !gainRowBackgroundUrl) {
			alert('Upload the Gain row background first.');
			return;
		}
		if (needsTrade && !tradeRowBackgroundUrl) {
			alert('Upload the Trade row background first.');
			return;
		}
		if (needsText && !textRowBackgroundUrl && !gainRowBackgroundUrl) {
			alert('Upload the Text row background (or set Gain as the fallback background) first.');
			return;
		}
		batchRunning = true;
		batchProgress = { processed: 0, total: locations.length, current: '' };
		const errors: string[] = [];

		try {
			for (const location of locations) {
				batchProgress.current = location.name;
				try {
					await renderRowsForLocation(location);
				} catch (err) {
					errors.push(`${location.name}: ${getErrorMessage(err)}`);
				} finally {
					batchProgress.processed += 1;
				}
			}
		} finally {
			batchRunning = false;
			batchProgress.current = '';
		}

		await refresh();
		onUpdated?.();

		if (errors.length > 0) {
			alert(`Rendered rows with ${errors.length} error(s):\n${errors.slice(0, 6).join('\n')}`);
		} else {
			alert('Rendered row PNGs for all locations.');
		}
	}

	// =========================
	// Location editor (row placement + final image)
	// =========================
	let locBgSize = $state<{ w: number; h: number } | null>(null);
	let locScale = $state(1);

	async function measureLocationBackground() {
		const loc = selectedLocation;
		if (!loc?.background_image_path) {
			locBgSize = null;
			return;
		}
		const url = publicAssetUrl(loc.background_image_path, { updatedAt: loc.updated_at ?? undefined });
		if (!url) return;
		try {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.src = url;
			await img.decode();
			locBgSize = { w: img.width, h: img.height };
			const maxW = 820;
			locScale = img.width > maxW ? maxW / img.width : 1;
		} catch {
			locBgSize = null;
		}
	}

	$effect(() => {
		if (activeTab !== 'location') return;
		void measureLocationBackground();
	});

	let draggingRow = $state<{ rowId: string; offsetX: number; offsetY: number } | null>(null);
	let dirtyRowPositionIds = $state<Set<string>>(new Set());

	function onRowBlockPointerDown(e: PointerEvent, rowId: string) {
		const canvas = (e.currentTarget as HTMLElement).closest('.location-editor__canvas') as HTMLElement | null;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;
		const row = locationRows.find((r) => r.id === rowId);
		const rowLeft = Number(row?.pos_x ?? 0) * locScale;
		const rowTop = Number(row?.pos_y ?? 0) * locScale;
		draggingRow = { rowId, offsetX: pointerX - rowLeft, offsetY: pointerY - rowTop };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onLocationCanvasPointerMove(e: PointerEvent) {
		if (!draggingRow) return;
		const canvas = e.currentTarget as HTMLElement;
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left - draggingRow.offsetX) / locScale;
		const y = (e.clientY - rect.top - draggingRow.offsetY) / locScale;
		locationRows = locationRows.map((r) => (r.id === draggingRow!.rowId ? { ...r, pos_x: x, pos_y: y } : r));
		dirtyRowPositionIds = new Set([...dirtyRowPositionIds, draggingRow.rowId]);
	}

	async function onLocationCanvasPointerUp() {
		if (draggingRow) {
			const row = locationRows.find((r) => r.id === draggingRow!.rowId);
			if (row && dirtyRowPositionIds.has(row.id)) {
				try {
					const updated = await updateGameLocationRow(row.id, { pos_x: row.pos_x, pos_y: row.pos_y });
					locationRows = locationRows.map((r) => (r.id === updated.id ? updated : r));
				} finally {
					const next = new Set(dirtyRowPositionIds);
					next.delete(row.id);
					dirtyRowPositionIds = next;
				}
			}
		}
		draggingRow = null;
	}

	async function applyRowLayoutToAllLocations() {
		const loc = selectedLocation;
		if (!loc) {
			alert('Select a location first.');
			return;
		}
		const requiredCount = loc.reward_rows?.length ?? 0;
		if (requiredCount === 0) {
			alert('Selected location has no reward rows.');
			return;
		}
		const refRows = locationRows
			.filter((row) => row.location_id === loc.id)
			.sort((a, b) => a.row_index - b.row_index);
		const refByIndex = new Map(refRows.map((row) => [row.row_index, row]));
		const missing = Array.from({ length: requiredCount }, (_, i) => i).filter((i) => !refByIndex.has(i));
		if (missing.length > 0) {
			alert(`Missing row placements for rows: ${missing.map((i) => i + 1).join(', ')}. Render row PNGs first.`);
			return;
		}

		layoutSyncRunning = true;
		const errors: string[] = [];
		try {
			for (const location of locations) {
				const rowCount = location.reward_rows?.length ?? 0;
				for (let i = 0; i < rowCount; i++) {
					const ref = refByIndex.get(i);
					if (!ref) {
						errors.push(`${location.name}: missing reference for row ${i + 1}`);
						continue;
					}
					const rowType = location.reward_rows?.[i]?.type === 'trade'
						? 'trade'
						: location.reward_rows?.[i]?.type === 'text'
							? 'text'
							: 'gain';
					const record = await ensureLocationRowRecord(location.id, i, rowType);
					const updated = await updateGameLocationRow(record.id, {
						pos_x: ref.pos_x,
						pos_y: ref.pos_y,
						scale: ref.scale
					});
					if (location.id === loc.id) {
						locationRows = locationRows.map((r) => (r.id === updated.id ? updated : r));
					}
				}
			}
		} catch (err) {
			errors.push(getErrorMessage(err));
		} finally {
			layoutSyncRunning = false;
		}

		if (errors.length > 0) {
			alert(`Applied layout with ${errors.length} error(s):\n${errors.slice(0, 6).join('\n')}`);
		} else {
			alert('Applied row layout to all locations.');
		}
	}

	async function getLocationRowsForLocation(loc: GameLocationRow) {
		if (loc.id === selectedLocationId && locationRows.length > 0) return locationRows;
		return await fetchGameLocationRows(loc.id);
	}

	async function generateLocationImageForLocation(loc: GameLocationRow) {
		if (!loc.background_image_path) {
			throw new Error('Missing location background.');
		}
		const bgUrl = publicAssetUrl(loc.background_image_path, { updatedAt: loc.updated_at ?? undefined });
		if (!bgUrl) throw new Error('Missing background URL.');

		const rows = await getLocationRowsForLocation(loc);
		const usableRows = rows
			.sort((a, b) => a.row_index - b.row_index)
			.filter((r) => !!r.row_image_path);
		if (usableRows.length === 0) {
			throw new Error('Render row PNGs first.');
		}

		const composed = await generateLocationFromRowImages({
			backgroundUrl: bgUrl,
			rows: usableRows.map((r) => ({
				rowImageUrl: publicAssetUrl(r.row_image_path!, { updatedAt: r.updated_at ?? undefined })!,
				x: Number(r.pos_x ?? 0),
				y: Number(r.pos_y ?? 0),
				scale: Number(r.scale ?? 1)
			}))
		});

		const stamp = Date.now();
		const storagePath = `game_locations/${loc.id}/location_with_icons_${stamp}.png`;
		const { error: uploadError } = await gameAssets.upload(storagePath, composed, {
			contentType: 'image/png',
			upsert: true
		});
		if (uploadError) throw uploadError;

		if (loc.image_with_icons_path && loc.image_with_icons_path !== storagePath) {
			const { error: removeError } = await gameAssets.remove([loc.image_with_icons_path]);
			if (removeError) {
				console.warn('Failed to remove old location image', removeError);
			}
		}

		const { error: updateError } = await supabase
			.from('game_locations')
			.update({ image_with_icons_path: storagePath, updated_at: new Date().toISOString() })
			.eq('id', loc.id);
		if (updateError) throw updateError;
	}

	async function generateLocationImage() {
		const loc = selectedLocation;
		try {
			if (!loc) {
				alert('Select a location first.');
				return;
			}
			await generateLocationImageForLocation(loc);
			onUpdated?.();
			alert('Generated location image!');
		} catch (err) {
			alert(`Failed to generate location image: ${getErrorMessage(err)}`);
		}
	}

	async function generateLocationImagesForAllLocations() {
		imageBatchRunning = true;
		imageBatchProgress = { processed: 0, total: locations.length, current: '' };
		const errors: string[] = [];

		try {
			for (const location of locations) {
				imageBatchProgress.current = location.name;
				try {
					await generateLocationImageForLocation(location);
				} catch (err) {
					errors.push(`${location.name}: ${getErrorMessage(err)}`);
				} finally {
					imageBatchProgress.processed += 1;
				}
			}
		} finally {
			imageBatchRunning = false;
			imageBatchProgress.current = '';
		}

		onUpdated?.();

		if (errors.length > 0) {
			alert(`Generated locations with ${errors.length} error(s):\n${errors.slice(0, 6).join('\n')}`);
		} else {
			alert('Generated location images for all locations.');
		}
	}
</script>

<Modal bind:open={isOpen} title="Location Placer" size="xl">
	{#snippet children()}
		{#if error}
			<div class="banner banner--error">{error}</div>
		{/if}

		<div class="placer__top">
			<div class="placer__selectors">
				<label>
					<span>Location</span>
					<select
						class="control-select"
						bind:value={selectedLocationId}
						onchange={async () => {
							selectedRowIndex = 0;
							if (selectedLocationId) {
								locationRows = await fetchGameLocationRows(selectedLocationId);
							}
						}}
					>
						{#each locations as loc (loc.id)}
							<option value={loc.id}>{loc.name}</option>
						{/each}
					</select>
				</label>

				<label>
					<span>Row</span>
					<select
						class="control-select"
						value={String(selectedRowIndex)}
						onchange={(e) => (selectedRowIndex = Number((e.currentTarget as HTMLSelectElement).value))}
						disabled={!selectedLocation}
					>
						{#if selectedLocation}
							{#each selectedLocation.reward_rows as rr, idx (idx)}
								<option value={String(idx)}>{rr.type} row {idx + 1}</option>
							{/each}
						{/if}
					</select>
				</label>
			</div>

			<div class="placer__tabs">
				{#each tabs as tab (tab.id)}
					<button
						type="button"
						class={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
						onclick={() => (activeTab = tab.id)}
					>
						<span class="tab-btn__icon">{tab.icon}</span>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		{#if loading}
			<p class="muted">Loading…</p>
		{:else if activeTab === 'row'}
			<div class="row-template">
				<div class="row-template__sidebar">
					<h4>Row Backgrounds</h4>
					<div class="row-template__bg-grid">
						<div class="row-template__bg">
							<div class="row-template__bg-title">Gain</div>
							<ImageUploader
								bind:value={config.gain_row_background.path}
								folder="game_locations/reward_row_backgrounds/gain"
								maxSizeMB={25}
								cropTransparent={false}
							/>
						</div>
						<div class="row-template__bg">
							<div class="row-template__bg-title">Trade</div>
							<ImageUploader
								bind:value={config.trade_row_background.path}
								folder="game_locations/reward_row_backgrounds/trade"
								maxSizeMB={25}
								cropTransparent={false}
							/>
						</div>
						<div class="row-template__bg">
							<div class="row-template__bg-title">Text</div>
							<ImageUploader
								bind:value={config.text_row_background.path}
								folder="game_locations/reward_row_backgrounds/text"
								maxSizeMB={25}
								cropTransparent={false}
							/>
						</div>
					</div>

					<h4 style="margin-top: 1rem;">Slot Set</h4>
					<div class="row-template__slot-buttons">
						<button
							type="button"
							class={`slot-btn ${currentSlotKind === 'gain' ? 'active' : ''}`}
							onclick={() => (currentSlotKind = 'gain')}
						>
							Gain (4)
						</button>
						<button
							type="button"
							class={`slot-btn ${currentSlotKind === 'trade_cost' ? 'active' : ''}`}
							onclick={() => (currentSlotKind = 'trade_cost')}
						>
							Trade Cost (2)
						</button>
						<button
							type="button"
							class={`slot-btn ${currentSlotKind === 'trade_gain' ? 'active' : ''}`}
							onclick={() => (currentSlotKind = 'trade_gain')}
						>
							Trade Reward (3)
						</button>
					</div>

					<div class="row-template__actions">
						<Button variant="secondary" onclick={saveTemplate}>Save Template</Button>
						<Button variant="primary" onclick={renderRowsForAllLocations} loading={batchRunning}>
							Render Row PNGs (All Locations)
						</Button>
					</div>

					{#if batchRunning}
						<div class="banner">
							Rendering {batchProgress.processed}/{batchProgress.total}
							{#if batchProgress.current}
								· {batchProgress.current}
							{/if}
						</div>
					{/if}
				</div>

				<div class="row-template__main">
					{#if !currentRowBackgroundUrl || !rowBgSize}
						<p class="muted">Upload a {currentRowBackgroundType} row background to edit slots.</p>
					{:else}
						<div
							class="row-template__canvas"
							style={`width:${rowBgSize.w * rowScale}px;height:${rowBgSize.h * rowScale}px;background-image:url('${currentRowBackgroundUrl}');`}
							onpointermove={onRowCanvasPointerMove}
							onpointerup={onRowCanvasPointerUp}
							onpointerleave={onRowCanvasPointerUp}
						>
							{#each getSlots(currentSlotKind) as slot, idx (idx)}
								{@const w = (slot.w ?? iconSize) * rowScale}
								{@const h = (slot.h ?? iconSize) * rowScale}
								<div
									class="row-template__slot"
									style={`left:${slot.x * rowScale}px;top:${slot.y * rowScale}px;width:${w}px;height:${h}px;`}
									onpointerdown={(e) => onSlotPointerDown(e, currentSlotKind, idx)}
								>
									<span>{idx + 1}</span>
									<button
										type="button"
										class="row-template__resize"
										aria-label="Resize slot"
										onpointerdown={(e) => onSlotResizePointerDown(e, currentSlotKind, idx)}
									></button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="location-editor">
				{#if !selectedLocation}
					<p class="muted">Select a location.</p>
				{:else if !selectedLocation.background_image_path}
					<p class="muted">Upload a location background on the Game Locations page first.</p>
				{:else}
					{@const bgUrl = publicAssetUrl(selectedLocation.background_image_path, { updatedAt: selectedLocation.updated_at ?? undefined })}
					{#if !bgUrl || !locBgSize}
						<p class="muted">Loading…</p>
					{:else}
						<div
							class="location-editor__canvas"
							style={`width:${locBgSize.w * locScale}px;height:${locBgSize.h * locScale}px;background-image:url('${bgUrl}');`}
							onpointermove={onLocationCanvasPointerMove}
							onpointerup={onLocationCanvasPointerUp}
							onpointerleave={onLocationCanvasPointerUp}
						>
							{#each selectedLocation.reward_rows as rr, idx (idx)}
								{@const rowRec = rowsByIndex.get(idx)}
								{@const rowUrl = rowRec?.row_image_path ? publicAssetUrl(rowRec.row_image_path, { updatedAt: rowRec.updated_at ?? undefined }) : null}
								{#if rowRec && rowUrl}
									<div
										class="location-editor__row"
										style={`left:${Number(rowRec.pos_x ?? 0) * locScale}px;top:${Number(rowRec.pos_y ?? 0) * locScale}px;transform:scale(${Number(rowRec.scale ?? 1) * locScale});transform-origin:top left;`}
									>
										<img src={rowUrl} alt="Row" draggable="false" onpointerdown={(e) => onRowBlockPointerDown(e, rowRec.id)} />
										<div class="location-editor__row-badge">{rr.type} {idx + 1}</div>
									</div>
								{:else}
									<div class="location-editor__missing">
										<div>{rr.type} row {idx + 1}: render row PNGs first</div>
									</div>
								{/if}
							{/each}
						</div>
					{/if}

					<div class="location-editor__actions">
						<Button variant="secondary" onclick={() => selectedLocation && renderRowsForLocation(selectedLocation)}>
							Render Row PNGs (This Location)
						</Button>
						<Button variant="secondary" onclick={applyRowLayoutToAllLocations} loading={layoutSyncRunning}>
							Apply Row Layout To All Locations
						</Button>
						<Button variant="primary" onclick={generateLocationImage}>Generate Location Image</Button>
						<Button variant="primary" onclick={generateLocationImagesForAllLocations} loading={imageBatchRunning}>
							Generate Location Images (All)
						</Button>
					</div>
					{#if imageBatchRunning}
						<p class="muted">
							Generating {imageBatchProgress.processed}/{imageBatchProgress.total}
							{#if imageBatchProgress.current}
								· {imageBatchProgress.current}
							{/if}
						</p>
					{/if}
				{/if}
			</div>
		{/if}
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (isOpen = false)}>Close</Button>
	{/snippet}
</Modal>

<style>
	.placer__top {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.placer__selectors {
		display: grid;
		grid-template-columns: 1fr 220px;
		gap: 0.75rem;
		align-items: end;
	}

	.placer__selectors label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.control-select {
		width: 100%;
		padding: 0.5rem 0.6rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.55);
		color: #e2e8f0;
	}

	.placer__tabs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tab-btn {
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.35);
		color: #cbd5e1;
		padding: 0.45rem 0.6rem;
		border-radius: 999px;
		cursor: pointer;
		display: flex;
		gap: 0.35rem;
		align-items: center;
		font-size: 0.85rem;
	}

	.tab-btn.active {
		border-color: rgba(96, 165, 250, 0.7);
		background: rgba(30, 58, 138, 0.35);
		color: #e2e8f0;
	}

	.row-template {
		display: grid;
		grid-template-columns: 360px 1fr;
		gap: 1rem;
		align-items: start;
	}

	.row-template__sidebar {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.row-template__bg-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}

	.row-template__bg {
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 12px;
		padding: 0.6rem;
		background: rgba(15, 23, 42, 0.25);
	}

	.row-template__bg-title {
		color: #94a3b8;
		font-size: 0.8rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.35rem;
	}

	.row-template__slot-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.slot-btn {
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.35);
		color: #cbd5e1;
		padding: 0.45rem 0.6rem;
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.slot-btn.active {
		border-color: rgba(96, 165, 250, 0.7);
		background: rgba(30, 58, 138, 0.35);
		color: #e2e8f0;
	}

	.row-template__actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.row-template__main {
		min-height: 420px;
		display: flex;
		justify-content: center;
		align-items: start;
	}

	.row-template__canvas {
		position: relative;
		background-size: contain;
		background-repeat: no-repeat;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		user-select: none;
		touch-action: none;
	}

	.row-template__slot {
		position: absolute;
		border: 2px dashed rgba(148, 163, 184, 0.7);
		border-radius: 12px;
		display: grid;
		place-items: center;
		color: rgba(226, 232, 240, 0.9);
		background: rgba(2, 6, 23, 0.15);
		cursor: grab;
		font-weight: 700;
	}

	.row-template__resize {
		position: absolute;
		right: -7px;
		bottom: -7px;
		width: 14px;
		height: 14px;
		border-radius: 4px;
		border: 1px solid rgba(148, 163, 184, 0.6);
		background: rgba(2, 6, 23, 0.9);
		cursor: nwse-resize;
		padding: 0;
	}

	.row-template__resize::after {
		content: '';
		position: absolute;
		inset: 3px;
		border-right: 2px solid rgba(226, 232, 240, 0.75);
		border-bottom: 2px solid rgba(226, 232, 240, 0.75);
	}

	.location-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
	}

	.location-editor__canvas {
		position: relative;
		background-size: contain;
		background-repeat: no-repeat;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		user-select: none;
		touch-action: none;
	}

	.location-editor__row {
		position: absolute;
	}

	.location-editor__row img {
		display: block;
		pointer-events: auto;
		cursor: grab;
	}

	.location-editor__row-badge {
		position: absolute;
		left: 8px;
		top: 8px;
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #e2e8f0;
		font-size: 0.75rem;
		padding: 0.2rem 0.4rem;
		border-radius: 999px;
		pointer-events: none;
	}

	.location-editor__missing {
		position: absolute;
		left: 12px;
		bottom: 12px;
		background: rgba(15, 23, 42, 0.65);
		color: #94a3b8;
		border: 1px dashed rgba(148, 163, 184, 0.25);
		padding: 0.4rem 0.6rem;
		border-radius: 10px;
	}

	.location-editor__actions {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.muted {
		color: #94a3b8;
	}
</style>
