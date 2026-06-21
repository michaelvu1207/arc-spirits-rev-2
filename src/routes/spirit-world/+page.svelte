<script lang="ts">
	import { onMount } from 'svelte';
	import html2canvas from 'html2canvas';
	import { supabase } from '$lib/api/supabaseClient';
	import type { GameLocationRewardRow, GameLocationRow, GameLocationRowCompositionRow, RewardRowAssignment } from '$lib/types/gameData';
	import { configToRewardRow } from '$lib/types/gameData';
	import { getErrorMessage } from '$lib/utils';
	import { loadAllIcons, getIconPoolUrl } from '$lib/utils/iconPool';
	import { isRewardOrIconToken, rewardIconTokensHaveAnyIcons } from '$lib/utils/rewardIconTokens';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { fetchAll } from '$lib/services/dataService';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { ImageUploader } from '$lib/components/shared';
	import { Button, Input } from '$lib/components/ui';
	import { fetchSpiritWorldMapConfig, upsertSpiritWorldMapConfig } from '$lib/api/spiritWorldMapConfig';
	import type { SpiritWorldLocationPlacement, SpiritWorldMapConfig } from '$lib/generators/spirit-world/spiritWorldMapConfig';

	type Location = Pick<GameLocationRow, 'id' | 'name'>;
	type LocationRowItem = {
		placementId: string;
		locationId: string;
		locationName: string;
		rowIndex: number;
		row: GameLocationRewardRow;
	};

	const tabs: Tab[] = [{ id: 'map', label: 'Spirit World Map', icon: '🗺️' }];
	let activeTab = $state('map');

	const PLACEMENT_ID_SEPARATOR = ':';
	const EXPORT_ICON_SIZE = 56;
	const EXPORT_ICON_GAP = 10;
	const EXPORT_ROW_GAP = 12;
	const LEGACY_ROW_HEIGHT = EXPORT_ICON_SIZE + EXPORT_ROW_GAP;

	let locations = $state<Location[]>([]);
	let rewardRowRecords = $state<GameLocationRowCompositionRow[]>([]);
	let rewardRowAssignments = $state<RewardRowAssignment[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	/** Get resolved reward rows for a location from the junction table. */
	function getLocationRewardRows(locationId: string): GameLocationRewardRow[] {
		const assigned = rewardRowAssignments
			.filter((a) => a.location_id === locationId)
			.sort((a, b) => a.row_index - b.row_index);

		return assigned.map((a) => {
			const row = rewardRowRecords.find((r) => r.id === a.row_id);
			if (!row) return { type: 'gain', gain_icon_ids: [] } as GameLocationRewardRow;
			return configToRewardRow(row.type, row.config);
		});
	}

	let mapConfig = $state<SpiritWorldMapConfig>({
		background_image_path: null,
		generated_image_path: null,
		placements: {}
	});

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	let selectedPlacementId = $state<string | null>(null);
	let searchQuery = $state('');

	let bgSize = $state<{ w: number; h: number } | null>(null);
	let baseScale = $state(1);
	let zoomPercent = $state(100);
	const mapScale = $derived(baseScale * (zoomPercent / 100));

	let generatedStamp = $state<number>(0);

	const locationById = $derived.by(() => new Map(locations.map((l) => [l.id, l])));

	function placementIdFor(locationId: string, rowIndex: number): string {
		return `${locationId}${PLACEMENT_ID_SEPARATOR}${rowIndex}`;
	}

	function rowLabel(row: GameLocationRewardRow, rowIndex: number): string {
		const kind = row.type === 'trade' ? 'Trade' : row.type === 'text' ? 'Text' : 'Gain';
		return `${kind} • Row ${rowIndex + 1}`;
	}

	const rowItems = $derived.by<LocationRowItem[]>(() => {
		const items: LocationRowItem[] = [];
		for (const loc of locations) {
			const rows = getLocationRewardRows(loc.id);
			for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
				const row = rows[rowIndex];
				if (!row || !hasRewardContent(row)) continue;
				items.push({
					placementId: placementIdFor(loc.id, rowIndex),
					locationId: loc.id,
					locationName: loc.name,
					rowIndex,
					row
				});
			}
		}
		return items;
	});

	const rowItemByPlacementId = $derived.by(() => new Map(rowItems.map((item) => [item.placementId, item])));

	const placedPlacementIds = $derived.by(() => new Set(Object.keys(mapConfig.placements ?? {})));
	const placedRows = $derived.by(() => {
		const placements = mapConfig.placements ?? {};
		return rowItems
			.filter((item) => !!placements[item.placementId])
			.map((item) => ({ item, placement: placements[item.placementId]! }));
	});

	const placedCount = $derived(placedRows.length);

	function hasRewardContent(row: GameLocationRewardRow): boolean {
		if (row.type === 'text') return row.text.trim().length > 0;
		if (row.type === 'trade') {
			return rewardIconTokensHaveAnyIcons(row.cost_icon_ids) || rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
		}
		return rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
	}

	const backgroundUrl = $derived.by(() =>
		publicAssetUrl(mapConfig.background_image_path, { updatedAt: 0 })
	);

	const generatedUrl = $derived.by(() =>
		mapConfig.generated_image_path
			? publicAssetUrl(mapConfig.generated_image_path, { updatedAt: generatedStamp || 0 })
			: null
	);

	const filteredRowItems = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		return rowItems.filter((item) => {
			if (!term) return true;
			if (item.locationName.toLowerCase().includes(term)) return true;
			if (rowLabel(item.row, item.rowIndex).toLowerCase().includes(term)) return true;
			if (item.row.type === 'text' && item.row.text.toLowerCase().includes(term)) return true;
			return false;
		});
	});

	let dragging = $state<{ placementId: string; offsetX: number; offsetY: number } | null>(null);
	let pendingSave = $state(false);
	let exportCanvasEl = $state<HTMLDivElement | null>(null);

	onMount(loadData);

	async function loadData() {
		loading = true;
		error = null;
		try {
			await Promise.all([loadAllIcons(), loadLocations(), loadRewardRowData(), loadConfig()]);
			const migrated = migrateLegacyLocationPlacements(mapConfig);
			if (migrated) {
				mapConfig = migrated;
				await saveConfig(migrated);
			}
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadLocations() {
		const { data, error: err } = await supabase
			.from('game_locations')
			.select('id, name')
			.order('name');
		if (err) throw new Error(err.message);
		locations = (data ?? []) as Location[];
	}

	async function loadRewardRowData() {
		const [rows, assignments] = await Promise.all([
			fetchAll<GameLocationRowCompositionRow>('game_location_rows', '*'),
			fetchAll<RewardRowAssignment>('reward_row_assignments', '*')
		]);
		rewardRowRecords = rows;
		rewardRowAssignments = assignments;
	}

	async function loadConfig() {
		mapConfig = await fetchSpiritWorldMapConfig();
	}

	function migrateLegacyLocationPlacements(config: SpiritWorldMapConfig): SpiritWorldMapConfig | null {
		const placements = config.placements ?? {};
		if (Object.keys(placements).length === 0) return null;

		const nextPlacements: Record<string, SpiritWorldLocationPlacement> = { ...placements };
		let changed = false;

		for (const [key, placement] of Object.entries(placements)) {
			if (key.includes(PLACEMENT_ID_SEPARATOR)) continue;
			const loc = locationById.get(key);
			if (!loc) continue;

			const locRows = getLocationRewardRows(loc.id);
			const rowsWithIndex = locRows
				.map((row, rowIndex) => ({ row, rowIndex }))
				.filter(({ row }) => !!row && hasRewardContent(row));

			for (let displayIndex = 0; displayIndex < rowsWithIndex.length; displayIndex++) {
				const entry = rowsWithIndex[displayIndex];
				if (!entry) continue;
				const placementId = placementIdFor(loc.id, entry.rowIndex);
				if (nextPlacements[placementId]) continue;

				const scale = placement.scale ?? 1;
				nextPlacements[placementId] = {
					...placement,
					y: placement.y + displayIndex * LEGACY_ROW_HEIGHT * scale
				};
				changed = true;
			}

			delete nextPlacements[key];
			changed = true;
		}

		if (!changed) return null;

		return {
			...config,
			generated_image_path: null,
			placements: nextPlacements
		};
	}

	async function saveConfig(next: SpiritWorldMapConfig) {
		saving = true;
		saveError = null;
		try {
			mapConfig = await upsertSpiritWorldMapConfig(next);
			pendingSave = false;
		} catch (err) {
			saveError = getErrorMessage(err);
		} finally {
			saving = false;
		}
	}

	async function measureBackground(url: string) {
		try {
			const img = new Image();
			img.crossOrigin = 'anonymous';
			img.src = url;
			await img.decode();
			bgSize = { w: img.width, h: img.height };
			const maxW = 1280;
			baseScale = img.width > maxW ? maxW / img.width : 1;
		} catch {
			bgSize = null;
		}
	}

	$effect(() => {
		if (!backgroundUrl) {
			bgSize = null;
			return;
		}
		void measureBackground(backgroundUrl);
	});

	function setPlacement(placementId: string, placement: SpiritWorldLocationPlacement) {
		mapConfig = {
			...mapConfig,
			placements: {
				...(mapConfig.placements ?? {}),
				[placementId]: placement
			}
		};
		pendingSave = true;
	}

	function removePlacement(placementId: string) {
		const next = { ...(mapConfig.placements ?? {}) };
		delete next[placementId];
		mapConfig = { ...mapConfig, placements: next };
		if (selectedPlacementId === placementId) selectedPlacementId = null;
		pendingSave = true;
	}

	function defaultPlacementForIndex(index: number): SpiritWorldLocationPlacement {
		const col = index % 6;
		const row = Math.floor(index / 6);
		return {
			x: 32 + col * 220,
			y: 32 + row * 170,
			scale: 0.8,
			rotation: 0
		};
	}

	function addToMap(placementId: string) {
		if ((mapConfig.placements ?? {})[placementId]) return;
		const nextIdx = Object.keys(mapConfig.placements ?? {}).length;
		const placement = defaultPlacementForIndex(nextIdx);
		setPlacement(placementId, placement);
		selectedPlacementId = placementId;
		void saveConfig(mapConfig);
	}

	function onPlacedPointerDown(e: PointerEvent, placementId: string) {
		const canvas = (e.currentTarget as HTMLElement).closest('.spirit-world__canvas') as HTMLElement | null;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;
		const placement = mapConfig.placements?.[placementId];
		if (!placement) return;

		selectedPlacementId = placementId;
		const left = placement.x * mapScale;
		const top = placement.y * mapScale;
		dragging = { placementId, offsetX: pointerX - left, offsetY: pointerY - top };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onCanvasPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const canvas = e.currentTarget as HTMLElement;
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left - dragging.offsetX) / mapScale;
		const y = (e.clientY - rect.top - dragging.offsetY) / mapScale;
		const current = mapConfig.placements?.[dragging.placementId];
		if (!current) return;
		setPlacement(dragging.placementId, { ...current, x, y });
	}

	function onCanvasPointerUp() {
		if (!dragging) return;
		dragging = null;
		if (pendingSave) {
			void saveConfig(mapConfig);
		}
	}

	function updateSelectedScale(scale: number) {
		if (!selectedPlacementId) return;
		const current = mapConfig.placements?.[selectedPlacementId];
		if (!current) return;
		setPlacement(selectedPlacementId, { ...current, scale });
	}

	function applyScaleToAllPlacements(scale: number) {
		const placements = mapConfig.placements ?? {};
		if (Object.keys(placements).length === 0) return;

		const nextPlacements: Record<string, SpiritWorldLocationPlacement> = {};
		for (const [placementId, placement] of Object.entries(placements)) {
			nextPlacements[placementId] = { ...placement, scale };
		}

		const next: SpiritWorldMapConfig = { ...mapConfig, placements: nextPlacements };
		mapConfig = next;
		pendingSave = true;
		void saveConfig(next);
	}

	function applyRotationToAllPlacements(rotation: number) {
		const placements = mapConfig.placements ?? {};
		if (Object.keys(placements).length === 0) return;

		const nextPlacements: Record<string, SpiritWorldLocationPlacement> = {};
		for (const [placementId, placement] of Object.entries(placements)) {
			nextPlacements[placementId] = { ...placement, rotation };
		}

		const next: SpiritWorldMapConfig = { ...mapConfig, placements: nextPlacements };
		mapConfig = next;
		pendingSave = true;
		void saveConfig(next);
	}

	function updateSelectedRotation(rotation: number) {
		if (!selectedPlacementId) return;
		const current = mapConfig.placements?.[selectedPlacementId];
		if (!current) return;
		setPlacement(selectedPlacementId, { ...current, rotation });
	}

	function toggleHideAllTooltips() {
		const next: SpiritWorldMapConfig = { ...mapConfig, hide_all_labels: !(mapConfig.hide_all_labels ?? false) };
		mapConfig = next;
		void saveConfig(next);
	}

	let exporting = $state(false);
	let exportError = $state<string | null>(null);
	const EXPORT_IMAGE_TYPE = 'image/jpeg';
	const EXPORT_IMAGE_QUALITY = 0.92;
	const EXPORT_IMAGE_FILENAME = 'spirit_world_with_rewards.jpg';
	const EXPORT_IMAGE_STORAGE_PATH = `spirit_world/${EXPORT_IMAGE_FILENAME}`;

	async function exportMap() {
		if (!backgroundUrl || !bgSize) {
			alert('Upload a Spirit World background first.');
			return;
		}
		if (!exportCanvasEl) {
			alert('Export canvas is not ready yet.');
			return;
		}

		exporting = true;
		exportError = null;
		try {
			// Ensure the background is loaded in the browser cache for html2canvas.
			try {
				const bg = new Image();
				bg.crossOrigin = 'anonymous';
				bg.src = backgroundUrl;
				await bg.decode();
			} catch {
				// ignore
			}

			// Wait for icons to load before capturing.
			const imgs = Array.from(exportCanvasEl.querySelectorAll('img'));
			await Promise.all(
				imgs.map(
					(img) =>
						img.complete
							? Promise.resolve()
							: new Promise<void>((resolve) => {
									img.addEventListener('load', () => resolve(), { once: true });
									img.addEventListener('error', () => resolve(), { once: true });
								})
				)
			);

			const canvas = await html2canvas(exportCanvasEl, {
				backgroundColor: null,
				scale: 1,
				useCORS: true,
				allowTaint: false,
				logging: false,
				width: bgSize.w,
				height: bgSize.h
			});

			const blob: Blob = await new Promise((resolve, reject) => {
				canvas.toBlob((value) => {
					if (!value) return reject(new Error('Failed to render export JPG.'));
					resolve(value);
				}, EXPORT_IMAGE_TYPE, EXPORT_IMAGE_QUALITY);
			});

			const storagePath = EXPORT_IMAGE_STORAGE_PATH;
			const { error: uploadError } = await supabase.storage.from('game_assets').upload(storagePath, blob, {
				contentType: EXPORT_IMAGE_TYPE,
				upsert: true
			});
			if (uploadError) throw uploadError;

			generatedStamp = Date.now();
			const next = { ...mapConfig, generated_image_path: storagePath };
			mapConfig = next;
			await saveConfig(next);

			// Also offer a direct download
			const objectUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = objectUrl;
			a.download = EXPORT_IMAGE_FILENAME;
			a.click();
			URL.revokeObjectURL(objectUrl);
		} catch (err) {
			exportError = getErrorMessage(err);
		} finally {
			exporting = false;
		}
	}
</script>

<PageLayout
	title="Spirit World"
	subtitle="Place location rewards on the Spirit World background and export a composite JPG"
	{tabs}
	{activeTab}
	onTabChange={(id) => (activeTab = id)}
>
	{#snippet tabActions()}
		<span class="count">{placedCount}/{rowItems.length} placed</span>
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading…</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else}
		<div class="spirit-world">
			<aside class="spirit-world__controls">
				<div class="panel">
					<div class="panel__header">
						<h2>Background</h2>
						{#if saving}
							<span class="pill">Saving…</span>
						{:else if pendingSave}
							<span class="pill pill--warn">Unsaved</span>
						{/if}
					</div>
					<ImageUploader
						value={mapConfig.background_image_path}
						folder="spirit_world/background"
						maxSizeMB={50}
						cropTransparent={false}
						onupload={(path) => {
							const next = { ...mapConfig, background_image_path: path, generated_image_path: null };
							mapConfig = next;
							void saveConfig(next);
						}}
						onremove={() => {
							const next = { ...mapConfig, background_image_path: null, generated_image_path: null };
							mapConfig = next;
							void saveConfig(next);
						}}
						onerror={(e) => alert(`Upload failed: ${e}`)}
					>
						<p>Upload the Spirit World background image.</p>
					</ImageUploader>
					{#if saveError}
						<div class="banner banner--error">{saveError}</div>
					{/if}
				</div>

				<div class="panel">
					<div class="panel__header">
						<h2>Reward Rows</h2>
						<span class="pill">{rowItems.length}</span>
					</div>
					<div class="panel__row">
						<Input bind:value={searchQuery} placeholder="Search locations…" />
					</div>
					<div class="locations">
						{#each filteredRowItems as item (item.placementId)}
							{@const isPlaced = placedPlacementIds.has(item.placementId)}
							<div
								class="location-item"
								class:is-placed={isPlaced}
								class:is-selected={selectedPlacementId === item.placementId}
							>
								<div class="location-item__thumb">
									<div class="reward-preview">
										<div class="reward-preview__row" class:is-trade={item.row.type === 'trade'} class:is-text={item.row.type === 'text'}>
											{#if item.row.type === 'trade'}
												<div class="reward-preview__icons">
													{#each item.row.cost_icon_ids as token, iconIdx (iconIdx)}
														<div class="reward-preview__icon">
															{#if typeof token === 'string'}
																{@const url = getIconPoolUrl(token)}
																{#if url}
																	<img src={url} alt="Cost icon" loading="lazy" />
																{/if}
															{:else if isRewardOrIconToken(token)}
																{#each token.icon_ids as iconId, j (j)}
																	{@const url = getIconPoolUrl(iconId)}
																	{#if url}
																		<img src={url} alt="OR icon" loading="lazy" />
																	{/if}
																	{#if j < token.icon_ids.length - 1}
																		<span class="reward-preview__or-slash">/</span>
																	{/if}
																{/each}
															{/if}
														</div>
													{/each}
												</div>
												<span class="reward-preview__arrow">→</span>
												<div class="reward-preview__icons">
													{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
														<div class="reward-preview__icon">
															{#if typeof token === 'string'}
																{@const url = getIconPoolUrl(token)}
																{#if url}
																	<img src={url} alt="Gain icon" loading="lazy" />
																{/if}
															{:else if isRewardOrIconToken(token)}
																{#each token.icon_ids as iconId, j (j)}
																	{@const url = getIconPoolUrl(iconId)}
																	{#if url}
																		<img src={url} alt="OR icon" loading="lazy" />
																	{/if}
																	{#if j < token.icon_ids.length - 1}
																		<span class="reward-preview__or-slash">/</span>
																	{/if}
																{/each}
															{/if}
														</div>
													{/each}
												</div>
											{:else if item.row.type === 'gain'}
												<div class="reward-preview__icons">
													{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
														<div class="reward-preview__icon">
															{#if typeof token === 'string'}
																{@const url = getIconPoolUrl(token)}
																{#if url}
																	<img src={url} alt="Reward icon" loading="lazy" />
																{/if}
															{:else if isRewardOrIconToken(token)}
																{#each token.icon_ids as iconId, j (j)}
																	{@const url = getIconPoolUrl(iconId)}
																	{#if url}
																		<img src={url} alt="OR icon" loading="lazy" />
																	{/if}
																	{#if j < token.icon_ids.length - 1}
																		<span class="reward-preview__or-slash">/</span>
																	{/if}
																{/each}
															{/if}
														</div>
													{/each}
												</div>
											{:else}
												<div class="reward-preview__text">{item.row.text}</div>
											{/if}
										</div>
									</div>
								</div>
								<div class="location-item__meta">
									<div class="location-item__name">{item.locationName}</div>
									<div class="location-item__sub">{rowLabel(item.row, item.rowIndex)}</div>
									<div class="location-item__actions">
										{#if isPlaced}
											<Button size="sm" onclick={() => (selectedPlacementId = item.placementId)}>Select</Button>
											<Button
												size="sm"
												variant="danger"
												onclick={() => (removePlacement(item.placementId), void saveConfig(mapConfig))}
											>
												Remove
											</Button>
										{:else}
											<Button size="sm" variant="primary" onclick={() => addToMap(item.placementId)}>Add</Button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				{#if selectedPlacementId && mapConfig.placements?.[selectedPlacementId]}
					{@const placement = mapConfig.placements[selectedPlacementId]!}
					{@const selectedItem = rowItemByPlacementId.get(selectedPlacementId)}
					<div class="panel">
						<div class="panel__header">
							<h2>Selected</h2>
							<span class="pill">
								{selectedItem
									? `${selectedItem.locationName} · ${rowLabel(selectedItem.row, selectedItem.rowIndex)}`
									: 'Unknown'}
							</span>
						</div>
						<div class="field">
							<div class="field__label-row">
								<div class="field__label">Scale</div>
								<Button size="sm" variant="secondary" onclick={() => applyScaleToAllPlacements(placement.scale)}>
									Apply to all
								</Button>
							</div>
							<input
								type="range"
								min="0.05"
								max="4"
								step="0.01"
								value={placement.scale}
								oninput={(e) => updateSelectedScale(parseFloat((e.currentTarget as HTMLInputElement).value))}
								onchange={() => void saveConfig(mapConfig)}
							/>
							<div class="field__hint">{placement.scale.toFixed(2)}x</div>
						</div>
						<div class="field">
							<div class="field__label-row">
								<div class="field__label">Rotation</div>
								<Button
									size="sm"
									variant="secondary"
									onclick={() => applyRotationToAllPlacements(placement.rotation ?? 0)}
								>
									Apply to all
								</Button>
							</div>
							<input
								type="range"
								min="0"
								max="360"
								step="1"
								value={placement.rotation ?? 0}
								oninput={(e) => updateSelectedRotation(parseFloat((e.currentTarget as HTMLInputElement).value))}
								onchange={() => void saveConfig(mapConfig)}
							/>
							<div class="field__hint">{Math.round(placement.rotation ?? 0)}°</div>
						</div>
						<div class="field field--row">
							<div class="field__label">Tooltips</div>
							<Button size="sm" variant="secondary" onclick={toggleHideAllTooltips}>
								{mapConfig.hide_all_labels ? 'Show all' : 'Hide all'}
							</Button>
						</div>
						<div class="field field--row">
							<div class="field__hint">x: {Math.round(placement.x)} · y: {Math.round(placement.y)}</div>
							<Button size="sm" variant="secondary" onclick={() => void saveConfig(mapConfig)} disabled={!pendingSave}>
								Save
							</Button>
						</div>
					</div>
				{/if}

				<div class="panel">
					<div class="panel__header">
						<h2>Export</h2>
						<span class="pill">JPG</span>
					</div>
					<Button variant="primary" onclick={exportMap} loading={exporting}>
						Export Spirit World
					</Button>
					{#if exportError}
						<div class="banner banner--error">{exportError}</div>
					{/if}
					{#if generatedUrl}
						<div class="generated">
							<img src={generatedUrl} alt="Generated Spirit World" loading="lazy" />
						</div>
					{/if}
				</div>
			</aside>

			<section class="spirit-world__stage">
				<div class="stage__toolbar">
					<div class="stage__tool">
						<span>Zoom</span>
						<input type="range" min="25" max="200" step="5" bind:value={zoomPercent} />
						<span class="stage__tool-val">{zoomPercent}%</span>
					</div>
					{#if bgSize}
						<div class="stage__dims">{bgSize.w}×{bgSize.h}</div>
					{/if}
				</div>

				{#if !backgroundUrl || !bgSize}
					<div class="stage__empty">
						<div>Upload a Spirit World background to start placing rewards.</div>
					</div>
				{:else}
					<div class="stage__canvas-wrap">
						<div
							class="spirit-world__canvas"
							style={`width:${bgSize.w * mapScale}px;height:${bgSize.h * mapScale}px;background-image:url('${backgroundUrl}');`}
							onpointermove={onCanvasPointerMove}
							onpointerup={onCanvasPointerUp}
								onpointerleave={onCanvasPointerUp}
						>
							{#each placedRows as { item, placement } (item.placementId)}
								<div
									class="placed"
									class:is-selected={selectedPlacementId === item.placementId}
									style={`left:${placement.x * mapScale}px;top:${placement.y * mapScale}px;transform:rotate(${placement.rotation ?? 0}deg) scale(${placement.scale * mapScale});transform-origin:top left;`}
									role="button"
									tabindex="0"
									onclick={() => (selectedPlacementId = item.placementId)}
									onkeydown={(e) => e.key === 'Enter' && (selectedPlacementId = item.placementId)}
									onpointerdown={(e) => onPlacedPointerDown(e, item.placementId)}
								>
									<div class="placed__rewards">
										<div class="reward-preview__row" class:is-trade={item.row.type === 'trade'} class:is-text={item.row.type === 'text'}>
											{#if item.row.type === 'trade'}
												<div class="reward-preview__icons">
													{#each item.row.cost_icon_ids as token, iconIdx (iconIdx)}
														<div class="reward-preview__icon">
															{#if typeof token === 'string'}
																{@const url = getIconPoolUrl(token)}
																{#if url}
																	<img src={url} alt="Cost icon" draggable="false" />
																{/if}
															{:else if isRewardOrIconToken(token)}
																{#each token.icon_ids as iconId, j (j)}
																	{@const url = getIconPoolUrl(iconId)}
																	{#if url}
																		<img src={url} alt="OR icon" draggable="false" />
																	{/if}
																	{#if j < token.icon_ids.length - 1}
																		<span class="reward-preview__or-slash">/</span>
																	{/if}
																{/each}
															{/if}
														</div>
													{/each}
												</div>
												<span class="reward-preview__arrow">→</span>
												<div class="reward-preview__icons">
													{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
														<div class="reward-preview__icon">
															{#if typeof token === 'string'}
																{@const url = getIconPoolUrl(token)}
																{#if url}
																	<img src={url} alt="Gain icon" draggable="false" />
																{/if}
															{:else if isRewardOrIconToken(token)}
																{#each token.icon_ids as iconId, j (j)}
																	{@const url = getIconPoolUrl(iconId)}
																	{#if url}
																		<img src={url} alt="OR icon" draggable="false" />
																	{/if}
																	{#if j < token.icon_ids.length - 1}
																		<span class="reward-preview__or-slash">/</span>
																	{/if}
																{/each}
															{/if}
														</div>
													{/each}
												</div>
											{:else if item.row.type === 'gain'}
												<div class="reward-preview__icons">
													{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
														<div class="reward-preview__icon">
															{#if typeof token === 'string'}
																{@const url = getIconPoolUrl(token)}
																{#if url}
																	<img src={url} alt="Reward icon" draggable="false" />
																{/if}
															{:else if isRewardOrIconToken(token)}
																{#each token.icon_ids as iconId, j (j)}
																	{@const url = getIconPoolUrl(iconId)}
																	{#if url}
																		<img src={url} alt="OR icon" draggable="false" />
																	{/if}
																	{#if j < token.icon_ids.length - 1}
																		<span class="reward-preview__or-slash">/</span>
																	{/if}
																{/each}
															{/if}
														</div>
													{/each}
												</div>
											{:else}
												<div class="reward-preview__text">{item.row.text}</div>
											{/if}
										</div>
									</div>
									{#if !(mapConfig.hide_all_labels ?? false)}
										<div class="placed__label">{item.locationName} · {rowLabel(item.row, item.rowIndex)}</div>
									{/if}
								</div>
							{/each}
						</div>
						<!-- Offscreen export DOM: same rendering as preview, but at native map size -->
						<div class="spirit-world__export-sandbox" aria-hidden="true">
							<div
								class="spirit-world__canvas spirit-world__canvas--export"
								bind:this={exportCanvasEl}
								style={`width:${bgSize.w}px;height:${bgSize.h}px;background-image:url('${backgroundUrl}');`}
							>
								{#each placedRows as { item, placement } (item.placementId)}
									<div
										class="placed"
										style={`left:${placement.x}px;top:${placement.y}px;transform:rotate(${placement.rotation ?? 0}deg) scale(${placement.scale});transform-origin:top left;`}
									>
										<div class="placed__rewards">
											<div class="reward-preview__row" class:is-trade={item.row.type === 'trade'} class:is-text={item.row.type === 'text'}>
												{#if item.row.type === 'trade'}
													<div class="reward-preview__icons">
														{#each item.row.cost_icon_ids as token, iconIdx (iconIdx)}
															<div class="reward-preview__icon">
																{#if typeof token === 'string'}
																	{@const url = getIconPoolUrl(token)}
																	{#if url}
																		<img src={url} alt="Cost icon" draggable="false" />
																	{/if}
																{:else if isRewardOrIconToken(token)}
																	{#each token.icon_ids as iconId, j (j)}
																		{@const url = getIconPoolUrl(iconId)}
																		{#if url}
																			<img src={url} alt="OR icon" draggable="false" />
																		{/if}
																		{#if j < token.icon_ids.length - 1}
																			<span class="reward-preview__or-slash">/</span>
																		{/if}
																	{/each}
																{/if}
															</div>
														{/each}
													</div>
													<span class="reward-preview__arrow">→</span>
													<div class="reward-preview__icons">
														{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
															<div class="reward-preview__icon">
																{#if typeof token === 'string'}
																	{@const url = getIconPoolUrl(token)}
																	{#if url}
																		<img src={url} alt="Gain icon" draggable="false" />
																	{/if}
																{:else if isRewardOrIconToken(token)}
																	{#each token.icon_ids as iconId, j (j)}
																		{@const url = getIconPoolUrl(iconId)}
																		{#if url}
																			<img src={url} alt="OR icon" draggable="false" />
																		{/if}
																		{#if j < token.icon_ids.length - 1}
																			<span class="reward-preview__or-slash">/</span>
																		{/if}
																	{/each}
																{/if}
															</div>
														{/each}
													</div>
												{:else if item.row.type === 'gain'}
													<div class="reward-preview__icons">
														{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
															<div class="reward-preview__icon">
																{#if typeof token === 'string'}
																	{@const url = getIconPoolUrl(token)}
																	{#if url}
																		<img src={url} alt="Reward icon" draggable="false" />
																	{/if}
																{:else if isRewardOrIconToken(token)}
																	{#each token.icon_ids as iconId, j (j)}
																		{@const url = getIconPoolUrl(iconId)}
																		{#if url}
																			<img src={url} alt="OR icon" draggable="false" />
																		{/if}
																		{#if j < token.icon_ids.length - 1}
																			<span class="reward-preview__or-slash">/</span>
																		{/if}
																	{/each}
																{/if}
															</div>
														{/each}
													</div>
												{:else}
													<div class="reward-preview__text">{item.row.text}</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</section>
		</div>
	{/if}
</PageLayout>

<style>
	.spirit-world {
		display: grid;
		grid-template-columns: 380px minmax(0, 1fr);
		gap: 0.75rem;
		min-height: 0;
	}

	.spirit-world__controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-height: 0;
		overflow: auto;
		padding-right: 0.25rem;
	}

	.panel {
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(2, 6, 23, 0.25);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.panel__header h2 {
		margin: 0;
		font-size: 0.9rem;
	}

	.panel__row {
		display: flex;
		gap: 0.5rem;
	}

	.pill {
		font-size: 0.72rem;
		color: #cbd5e1;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 999px;
		padding: 0.15rem 0.45rem;
		background: rgba(15, 23, 42, 0.5);
	}

	.pill--warn {
		border-color: rgba(251, 191, 36, 0.35);
		color: #fcd34d;
		background: rgba(251, 191, 36, 0.08);
	}

	.locations {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 420px;
		overflow: auto;
		padding-right: 0.25rem;
	}

	.location-item {
		display: grid;
		grid-template-columns: 160px minmax(0, 1fr);
		gap: 0.6rem;
		align-items: center;
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(15, 23, 42, 0.35);
		border-radius: 10px;
		padding: 0.5rem;
	}

	.location-item.is-placed {
		border-color: rgba(34, 197, 94, 0.22);
	}

	.location-item.is-selected {
		border-color: rgba(168, 85, 247, 0.5);
		box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.2) inset;
	}

	.location-item__thumb {
		--reward-icon-size: 18px;
		--reward-icon-gap: 4px;
		--reward-row-gap: 4px;

		width: 160px;
		height: 64px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.45);
		display: flex;
		align-items: flex-start;
		justify-content: flex-start;
		padding: 0.25rem;
	}

	.thumb-placeholder {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.reward-preview {
		display: flex;
		flex-direction: column;
		gap: var(--reward-row-gap);
		width: 100%;
	}

	.reward-preview__row {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
		min-width: 0;
		padding: 0.35rem 0.45rem;
		border-radius: 12px;
		position: relative;
		background: rgba(56, 35, 20, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.5);
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4);
	}

	.reward-preview__row > * {
		filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.55));
	}

	.reward-preview__icons {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
		min-width: 0;
		flex-wrap: nowrap;
	}

	.reward-preview__icon {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
	}

	.reward-preview__icon img {
		height: var(--reward-icon-size);
		width: auto;
		max-width: calc(var(--reward-icon-size) * 1.8);
		display: block;
		pointer-events: none;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55));
	}

	.reward-preview__arrow {
		font-size: calc(var(--reward-icon-size) * 0.7);
		font-weight: 800;
		color: rgba(226, 232, 240, 0.9);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.reward-preview__or-slash {
		font-size: calc(var(--reward-icon-size) * 0.65);
		font-weight: 900;
		color: rgba(226, 232, 240, 0.9);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.reward-preview__text {
		font-size: 0.72rem;
		color: rgba(226, 232, 240, 0.85);
		line-height: 1.05;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.location-item__meta {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 0;
	}

	.location-item__name {
		font-size: 0.85rem;
		font-weight: 700;
		color: #f8fafc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.location-item__sub {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.9);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.location-item__actions {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field--row {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.field__label {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.9);
	}

	.field__label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.field__hint {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.banner {
		border-radius: 10px;
		padding: 0.5rem 0.6rem;
		font-size: 0.85rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.55);
	}

	.banner--error {
		border-color: rgba(248, 113, 113, 0.35);
		color: #fecaca;
		background: rgba(248, 113, 113, 0.08);
	}

	.generated img {
		width: 100%;
		height: auto;
		display: block;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.spirit-world__stage {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-height: 0;
	}

	.stage__toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(2, 6, 23, 0.25);
		border-radius: 12px;
	}

	.stage__tool {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.9);
	}

	.stage__tool input[type='range'] {
		width: 160px;
	}

	.stage__tool-val {
		min-width: 48px;
		text-align: right;
		color: #e2e8f0;
		font-weight: 700;
	}

	.stage__dims {
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.stage__empty {
		flex: 1;
		border: 1px dashed rgba(148, 163, 184, 0.25);
		border-radius: 12px;
		background: rgba(2, 6, 23, 0.2);
		display: grid;
		place-items: center;
		color: rgba(148, 163, 184, 0.85);
		min-height: 420px;
	}

	.stage__canvas-wrap {
		flex: 1;
		min-height: 0;
		overflow: auto;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(2, 6, 23, 0.2);
		padding: 0.75rem;
	}

	.spirit-world__canvas {
		position: relative;
		background-size: contain;
		background-repeat: no-repeat;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		user-select: none;
		touch-action: none;
	}

	.spirit-world__export-sandbox {
		position: fixed;
		left: -100000px;
		top: 0;
	}

	.spirit-world__canvas--export {
		user-select: none;
	}

	.placed {
		position: absolute;
		cursor: grab;
	}

	.placed.is-selected .placed__rewards,
	.placed.is-selected .placed__fallback {
		outline: 2px solid rgba(168, 85, 247, 0.8);
		outline-offset: 2px;
	}

	.placed__rewards {
		--reward-icon-size: 56px;
		--reward-icon-gap: 10px;
		--reward-row-gap: 12px;

		display: flex;
		flex-direction: column;
		gap: var(--reward-row-gap);
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.55));
	}

	.placed__fallback {
		padding: 0.5rem 0.6rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.75);
		color: #e2e8f0;
		font-size: 0.85rem;
		font-weight: 700;
	}

	.placed__label {
		position: absolute;
		left: 10px;
		top: -26px;
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #e2e8f0;
		font-size: 0.75rem;
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		pointer-events: none;
		white-space: nowrap;
	}

	.count {
		font-size: 0.85rem;
		color: rgba(148, 163, 184, 0.9);
	}

	@media (max-width: 980px) {
		.spirit-world {
			grid-template-columns: 1fr;
		}

		.spirit-world__controls {
			max-height: 420px;
		}
	}
</style>
