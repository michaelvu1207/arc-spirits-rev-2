<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { GameLocationRow } from '$lib/types/gameData';
	import { getErrorMessage } from '$lib/utils';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { ImageUploader } from '$lib/components/shared';
	import { Button, Input } from '$lib/components/ui';
	import { fetchSpiritWorldMapConfig, upsertSpiritWorldMapConfig } from '$lib/api/spiritWorldMapConfig';
	import type { SpiritWorldLocationPlacement, SpiritWorldMapConfig } from '$lib/generators/spirit-world/spiritWorldMapConfig';
	import { generateSpiritWorldMapImage } from '$lib/generators/spirit-world/spiritWorldMapGenerator';

	type Location = Pick<
		GameLocationRow,
		'id' | 'name' | 'background_image_path' | 'image_with_icons_path' | 'updated_at'
	>;

	const tabs: Tab[] = [{ id: 'map', label: 'Spirit World Map', icon: '🗺️' }];
	let activeTab = $state('map');

	let locations = $state<Location[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let mapConfig = $state<SpiritWorldMapConfig>({
		background_image_path: null,
		generated_image_path: null,
		placements: {}
	});

	let saving = $state(false);
	let saveError = $state<string | null>(null);

	let selectedLocationId = $state<string | null>(null);
	let searchQuery = $state('');

	let bgSize = $state<{ w: number; h: number } | null>(null);
	let baseScale = $state(1);
	let zoomPercent = $state(100);
	const mapScale = $derived(baseScale * (zoomPercent / 100));

	let generatedStamp = $state<number>(0);

	const locationById = $derived.by(() => new Map(locations.map((l) => [l.id, l])));
	const placedLocationIds = $derived.by(() => new Set(Object.keys(mapConfig.placements ?? {})));
	const placedCount = $derived(placedLocationIds.size);

	function getLocationImagePath(loc: Location): string | null {
		return loc.image_with_icons_path ?? loc.background_image_path ?? null;
	}

	function getLocationImageUrl(loc: Location): string | null {
		const path = getLocationImagePath(loc);
		return publicAssetUrl(path, { updatedAt: loc.updated_at ?? 0 });
	}

	const backgroundUrl = $derived.by(() =>
		publicAssetUrl(mapConfig.background_image_path, { updatedAt: 0 })
	);

	const generatedUrl = $derived.by(() =>
		mapConfig.generated_image_path
			? publicAssetUrl(mapConfig.generated_image_path, { updatedAt: generatedStamp || 0 })
			: null
	);

	const filteredLocations = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		return locations.filter((loc) => {
			if (!term) return true;
			return loc.name.toLowerCase().includes(term);
		});
	});

	const placedLocations = $derived.by(() => {
		const placements = mapConfig.placements ?? {};
		return locations
			.filter((loc) => !!placements[loc.id])
			.map((loc) => ({ loc, placement: placements[loc.id]!, imageUrl: getLocationImageUrl(loc) }));
	});

	let dragging = $state<{ locationId: string; offsetX: number; offsetY: number } | null>(null);
	let pendingSave = $state(false);

	onMount(loadData);

	async function loadData() {
		loading = true;
		error = null;
		try {
			await Promise.all([loadLocations(), loadConfig()]);
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadLocations() {
		const { data, error: err } = await supabase
			.from('game_locations')
			.select('id, name, background_image_path, image_with_icons_path, updated_at')
			.order('name');
		if (err) throw new Error(err.message);
		locations = (data ?? []) as Location[];
	}

	async function loadConfig() {
		mapConfig = await fetchSpiritWorldMapConfig();
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

	function setPlacement(locationId: string, placement: SpiritWorldLocationPlacement) {
		mapConfig = {
			...mapConfig,
			placements: {
				...(mapConfig.placements ?? {}),
				[locationId]: placement
			}
		};
		pendingSave = true;
	}

	function removePlacement(locationId: string) {
		const next = { ...(mapConfig.placements ?? {}) };
		delete next[locationId];
		mapConfig = { ...mapConfig, placements: next };
		if (selectedLocationId === locationId) selectedLocationId = null;
		pendingSave = true;
	}

	function defaultPlacementForIndex(index: number): SpiritWorldLocationPlacement {
		const col = index % 6;
		const row = Math.floor(index / 6);
		return {
			x: 32 + col * 220,
			y: 32 + row * 170,
			scale: 0.35,
			rotation: 0
		};
	}

	function addToMap(locationId: string) {
		if ((mapConfig.placements ?? {})[locationId]) return;
		const nextIdx = Object.keys(mapConfig.placements ?? {}).length;
		const placement = defaultPlacementForIndex(nextIdx);
		setPlacement(locationId, placement);
		selectedLocationId = locationId;
		void saveConfig({
			...mapConfig,
			placements: {
				...(mapConfig.placements ?? {}),
				[locationId]: placement
			}
		});
	}

	function onPlacedPointerDown(e: PointerEvent, locationId: string) {
		const canvas = (e.currentTarget as HTMLElement).closest('.spirit-world__canvas') as HTMLElement | null;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;
		const placement = mapConfig.placements?.[locationId];
		if (!placement) return;

		selectedLocationId = locationId;
		const left = placement.x * mapScale;
		const top = placement.y * mapScale;
		dragging = { locationId, offsetX: pointerX - left, offsetY: pointerY - top };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onCanvasPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const canvas = e.currentTarget as HTMLElement;
		const rect = canvas.getBoundingClientRect();
		const x = (e.clientX - rect.left - dragging.offsetX) / mapScale;
		const y = (e.clientY - rect.top - dragging.offsetY) / mapScale;
		const current = mapConfig.placements?.[dragging.locationId];
		if (!current) return;
		setPlacement(dragging.locationId, { ...current, x, y });
	}

	function onCanvasPointerUp() {
		if (!dragging) return;
		dragging = null;
		if (pendingSave) {
			void saveConfig(mapConfig);
		}
	}

	function updateSelectedScale(scale: number) {
		if (!selectedLocationId) return;
		const current = mapConfig.placements?.[selectedLocationId];
		if (!current) return;
		setPlacement(selectedLocationId, { ...current, scale });
	}

	function updateSelectedRotation(rotation: number) {
		if (!selectedLocationId) return;
		const current = mapConfig.placements?.[selectedLocationId];
		if (!current) return;
		setPlacement(selectedLocationId, { ...current, rotation });
	}

	let exporting = $state(false);
	let exportError = $state<string | null>(null);

	async function exportMap() {
		if (!backgroundUrl) {
			alert('Upload a Spirit World background first.');
			return;
		}

		exporting = true;
		exportError = null;
		try {
			const placements: { imageUrl: string; x: number; y: number; scale: number; rotation: number }[] = [];
			for (const [locationId, placement] of Object.entries(mapConfig.placements ?? {})) {
				const loc = locationById.get(locationId);
				if (!loc) continue;
				const url = getLocationImageUrl(loc);
				if (!url) continue;
				placements.push({
					imageUrl: url,
					x: placement.x,
					y: placement.y,
					scale: placement.scale,
					rotation: placement.rotation ?? 0
				});
			}

			const blob = await generateSpiritWorldMapImage({ backgroundUrl, placements });
			const storagePath = 'spirit_world/spirit_world_with_locations.png';
			const { error: uploadError } = await supabase.storage.from('game_assets').upload(storagePath, blob, {
				contentType: 'image/png',
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
			a.download = 'spirit_world_with_locations.png';
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
	subtitle="Place game locations on the Spirit World background and export a composite PNG"
	{tabs}
	{activeTab}
	onTabChange={(id) => (activeTab = id)}
>
	{#snippet tabActions()}
		<span class="count">{placedCount}/{locations.length} placed</span>
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
						<h2>Locations</h2>
						<span class="pill">{locations.length}</span>
					</div>
					<div class="panel__row">
						<Input bind:value={searchQuery} placeholder="Search locations…" />
					</div>
					<div class="locations">
						{#each filteredLocations as loc (loc.id)}
							{@const isPlaced = placedLocationIds.has(loc.id)}
							{@const thumbUrl = getLocationImageUrl(loc)}
							<div class="location-item" class:is-placed={isPlaced} class:is-selected={selectedLocationId === loc.id}>
								<div class="location-item__thumb">
									{#if thumbUrl}
										<img src={thumbUrl} alt={loc.name} loading="lazy" />
									{:else}
										<div class="thumb-placeholder">No image</div>
									{/if}
								</div>
								<div class="location-item__meta">
									<div class="location-item__name">{loc.name}</div>
									<div class="location-item__actions">
										{#if isPlaced}
											<Button size="sm" onclick={() => (selectedLocationId = loc.id)}>Select</Button>
											<Button size="sm" variant="danger" onclick={() => (removePlacement(loc.id), void saveConfig(mapConfig))}>
												Remove
											</Button>
										{:else}
											<Button size="sm" variant="primary" onclick={() => addToMap(loc.id)}>Add</Button>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>

				{#if selectedLocationId && mapConfig.placements?.[selectedLocationId]}
					{@const placement = mapConfig.placements[selectedLocationId]!}
					{@const selectedLoc = locationById.get(selectedLocationId)}
					<div class="panel">
						<div class="panel__header">
							<h2>Selected</h2>
							<span class="pill">{selectedLoc?.name ?? 'Unknown'}</span>
						</div>
						<div class="field">
							<div class="field__label">Scale</div>
							<input
								type="range"
								min="0.05"
								max="2"
								step="0.01"
								value={placement.scale}
								oninput={(e) => updateSelectedScale(parseFloat((e.currentTarget as HTMLInputElement).value))}
								onchange={() => void saveConfig(mapConfig)}
							/>
							<div class="field__hint">{placement.scale.toFixed(2)}x</div>
						</div>
						<div class="field">
							<div class="field__label">Rotation</div>
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
						<span class="pill">PNG</span>
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
						<div>Upload a Spirit World background to start placing locations.</div>
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
							{#each placedLocations as { loc, placement, imageUrl } (loc.id)}
								<div
									class="placed"
									class:is-selected={selectedLocationId === loc.id}
									style={`left:${placement.x * mapScale}px;top:${placement.y * mapScale}px;transform:rotate(${placement.rotation ?? 0}deg) scale(${placement.scale * mapScale});transform-origin:top left;`}
									role="button"
									tabindex="0"
									onclick={() => (selectedLocationId = loc.id)}
									onkeydown={(e) => e.key === 'Enter' && (selectedLocationId = loc.id)}
									onpointerdown={(e) => onPlacedPointerDown(e, loc.id)}
								>
									{#if imageUrl}
										<img src={imageUrl} alt={loc.name} draggable="false" />
									{:else}
										<div class="placed__fallback">{loc.name}</div>
									{/if}
									<div class="placed__label">{loc.name}</div>
								</div>
							{/each}
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
		grid-template-columns: 64px minmax(0, 1fr);
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
		width: 64px;
		height: 48px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.45);
		display: grid;
		place-items: center;
	}

	.location-item__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.thumb-placeholder {
		font-size: 0.7rem;
		color: #94a3b8;
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

	.placed {
		position: absolute;
		cursor: grab;
	}

	.placed.is-selected img,
	.placed.is-selected .placed__fallback {
		outline: 2px solid rgba(168, 85, 247, 0.8);
		outline-offset: 2px;
	}

	.placed img {
		display: block;
		pointer-events: auto;
		max-width: none;
		max-height: none;
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
		top: 10px;
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
