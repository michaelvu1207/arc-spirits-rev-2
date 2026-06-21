<script lang="ts">
	import { onMount } from 'svelte';
	import { loadOpsilonFont, loadVincendoFont, loadImage } from '$lib/generators/shared/canvas';
	import { renderZones, type ZoneDataMap } from '$lib/generators/shared/layoutRenderer';
	import type { CardLayoutConfig, CardRenderer, CardType, Zone, PlacedBox } from '$lib/generators/shared/layoutTypes';
	import { loadLayoutConfig, saveLayoutConfig } from '$lib/services/layoutConfigService';
	import ZonePropertyEditor from './ZonePropertyEditor.svelte';

	interface Props {
		isOpen: boolean;
		cardType: CardType;
		configKey?: string;
		/** Entities to preview / batch generate. */
		sampleEntities: { id: string; name: string }[];
		/** The card renderer for this card type. */
		renderer: CardRenderer<any>;
		/** Build the base image URL for a given entity. Return null if not available. */
		getBaseImageUrl: (entity: any) => string | null;
		/** Build zone data for a given entity. */
		buildZoneData: (entity: any, config: CardLayoutConfig) => ZoneDataMap;
		/** Called when batch generate is triggered. */
		onBatchGenerate?: (config: CardLayoutConfig) => void | Promise<void>;
		onClose: () => void;
	}

	let {
		isOpen,
		cardType,
		configKey = 'base',
		sampleEntities,
		renderer,
		getBaseImageUrl,
		buildZoneData,
		onBatchGenerate,
		onClose
	}: Props = $props();

	let config = $state<CardLayoutConfig>(renderer.getDefaultConfig());
	let loadedFromDb = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let sampleEntityId = $state<string>('');
	let sampleImage: HTMLImageElement | null = $state(null);
	let displayScale = $state(0.25);

	let selectedZoneIndex = $state(0);
	let dragging = $state<number | null>(null);
	let dragOffset = $state({ x: 0, y: 0 });

	let jsonEditorOpen = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');

	const preloadedImages = new Map<string, HTMLImageElement>();

	const selectedEntity = $derived.by(() => sampleEntities.find((e) => e.id === sampleEntityId) ?? null);
	const selectedZone = $derived.by(() => config.zones[selectedZoneIndex] ?? null);

	function withRendererZoneLabels(nextConfig: CardLayoutConfig): CardLayoutConfig {
		const defaultZones = renderer.getDefaultConfig().zones;
		return {
			...nextConfig,
			zones: nextConfig.zones.map((zone) => {
				const defaultZone = defaultZones.find((candidate) => candidate.key === zone.key);
				return defaultZone ? { ...zone, label: defaultZone.label } : zone;
			})
		};
	}

	onMount(() => {
		void Promise.all([loadOpsilonFont(), loadVincendoFont()])
			.then(() => {
				if (isOpen) drawCanvas();
			})
			.catch(() => {});
	});

	$effect(() => {
		if (!isOpen) return;
		void ensureLoaded();
	});

	$effect(() => {
		if (!isOpen) return;
		if (!sampleEntityId && sampleEntities.length > 0) {
			const firstWithBase = sampleEntities.find((e) => getBaseImageUrl(e) !== null) ?? sampleEntities[0];
			sampleEntityId = firstWithBase?.id ?? '';
		}
	});

	$effect(() => {
		if (!isOpen) return;
		void loadSampleBaseImage();
	});

	$effect(() => {
		if (!isOpen) return;
		if (canvasEl) drawCanvas();
	});

	async function ensureLoaded() {
		if (loadedFromDb) return;
		error = null;
		try {
			const result = await loadLayoutConfig(cardType, configKey);
			if (result.error) throw result.error;
				if (result.config) {
					// Apply the saved config but ensure it has the right shape
					const saved = result.config as CardLayoutConfig;
					if (saved.zones && saved._ref_w && saved._ref_h) {
						config = withRendererZoneLabels(saved);
					}
				}
			loadedFromDb = true;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			loadedFromDb = true;
		}
	}

	async function loadSampleBaseImage() {
		const entity = selectedEntity;
		if (!entity) {
			sampleImage = null;
			drawCanvas();
			return;
		}
		const url = getBaseImageUrl(entity);
		if (!url) {
			sampleImage = null;
			drawCanvas();
			return;
		}
		try {
			sampleImage = await loadImage(url);
			calculateDisplayScale();
			// Preload images for rendering zones
			await preloadZoneImages(entity);
			drawCanvas();
		} catch {
			sampleImage = null;
			drawCanvas();
		}
	}

	async function preloadZoneImages(entity: any) {
		const urls = renderer.collectImageUrls(config, entity);
		const zoneData = buildZoneData(entity, config);
		for (const u of Object.values(zoneData.images)) {
			if (u) urls.push(u);
		}
		for (const arr of Object.values(zoneData.iconGrids)) {
			for (const u of arr) {
				if (u) urls.push(u);
			}
		}

		const toLoad = urls.filter((u) => !preloadedImages.has(u));
		if (toLoad.length === 0) return;

		const results = await Promise.all(
			toLoad.map(async (u) => {
				try {
					return [u, await loadImage(u)] as const;
				} catch {
					return null;
				}
			})
		);
		for (const pair of results) {
			if (pair) preloadedImages.set(pair[0], pair[1]);
		}
	}

	/** Full-size width of the current preview (image native width, or _ref_w fallback). */
	const canvasFullWidth = $derived.by(() => {
		const img = sampleImage;
		return img ? img.width : config._ref_w;
	});
	const canvasFullHeight = $derived.by(() => {
		const img = sampleImage;
		return img ? img.height : config._ref_h;
	});

	function calculateDisplayScale() {
		const maxWidth = 650;
		displayScale = Math.max(0.05, Math.min(1, maxWidth / canvasFullWidth));
	}

	function handleCanvasDown(event: MouseEvent) {
		if (!canvasEl) return;
		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;

		for (let i = config.zones.length - 1; i >= 0; i--) {
			const zone = config.zones[i];
			if (pointInBox(realX, realY, zone.box)) {
				selectedZoneIndex = i;
				dragging = i;
				dragOffset = { x: realX - zone.box.x, y: realY - zone.box.y };
				drawCanvas();
				return;
			}
		}
		dragging = null;
		drawCanvas();
	}

	function handleCanvasMove(event: MouseEvent) {
		if (!canvasEl || dragging === null) return;
		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;

		const zone = config.zones[dragging];
		if (!zone) return;
		const nextX = Math.max(0, Math.min(Math.round(realX - dragOffset.x), canvasFullWidth - zone.box.w));
		const nextY = Math.max(0, Math.min(Math.round(realY - dragOffset.y), canvasFullHeight - zone.box.h));

		const updatedZone = { ...zone, box: { ...zone.box, x: nextX, y: nextY } };
		const newZones = [...config.zones];
		newZones[dragging] = updatedZone;
		config = { ...config, zones: newZones };
		drawCanvas();
	}

	function handleCanvasUp() {
		dragging = null;
	}

	function pointInBox(x: number, y: number, box: PlacedBox): boolean {
		return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
	}

	function handleZoneChange(zone: Zone) {
		const newZones = [...config.zones];
		newZones[selectedZoneIndex] = zone;
		config = { ...config, zones: newZones };
		drawCanvas();
	}

	async function saveToDb() {
		if (saving) return;
		saving = true;
		error = null;
		try {
			const result = await saveLayoutConfig(cardType, configKey, config);
			if (result.error) throw result.error;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	function resetDefaults() {
		config = renderer.getDefaultConfig();
		calculateDisplayScale();
		drawCanvas();
	}

	function openJsonEditor() {
		jsonText = JSON.stringify(config, null, 2);
		jsonError = '';
		jsonEditorOpen = true;
	}

	function closeJsonEditor() {
		jsonEditorOpen = false;
		jsonError = '';
	}

	function applyJson() {
		try {
			const parsed = JSON.parse(jsonText) as CardLayoutConfig;
			if (!parsed.zones || !parsed._ref_w || !parsed._ref_h) {
				throw new Error('Invalid config shape: missing zones, _ref_w, or _ref_h');
			}
			config = parsed;
			jsonError = '';
			jsonEditorOpen = false;
			calculateDisplayScale();
			drawCanvas();
		} catch (err) {
			jsonError = err instanceof Error ? err.message : 'Invalid JSON';
		}
	}

	async function copyJsonToClipboard() {
		const text = JSON.stringify(config, null, 2);
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			document.body.appendChild(textarea);
			textarea.select();
			document.execCommand('copy');
			document.body.removeChild(textarea);
		}
	}

	function drawCanvas() {
		if (!canvasEl) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const scaledWidth = Math.floor(canvasFullWidth * displayScale);
		const scaledHeight = Math.floor(canvasFullHeight * displayScale);
		canvasEl.width = scaledWidth;
		canvasEl.height = scaledHeight;

		ctx.fillStyle = '#0b1220';
		ctx.fillRect(0, 0, scaledWidth, scaledHeight);

		if (sampleImage) {
			ctx.globalAlpha = 0.95;
			ctx.drawImage(sampleImage, 0, 0, scaledWidth, scaledHeight);
			ctx.globalAlpha = 1;
		}

		// Render zones
		const entity = selectedEntity;
		if (entity) {
			const zoneData = buildZoneData(entity, config);
			renderZones(ctx, config.zones, entity, renderer, preloadedImages, zoneData, displayScale);
		}

		// Selected zone highlight
		if (selectedZone) {
			ctx.save();
			ctx.strokeStyle = '#60a5fa';
			ctx.lineWidth = 4;
			ctx.strokeRect(
				selectedZone.box.x * displayScale,
				selectedZone.box.y * displayScale,
				selectedZone.box.w * displayScale,
				selectedZone.box.h * displayScale
			);
			ctx.restore();
		}
	}

	function handleBatchGenerate() {
		onBatchGenerate?.(config);
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" role="button" tabindex="0" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<header class="modal__header">
				<h2>{cardType.charAt(0).toUpperCase() + cardType.slice(1)} Card Layout</h2>
				<button type="button" class="modal__close" onclick={onClose}>✕</button>
			</header>

			<div class="modal__body">
				<div class="layout">
					<div class="controls">
						<div class="control-group">
							<label class="control-label">Sample Entity</label>
							<select class="control-select" bind:value={sampleEntityId}>
								{#each sampleEntities as e (e.id)}
									<option value={e.id}>{e.name}</option>
								{/each}
							</select>
						</div>

						<div class="control-group">
							<label class="control-label">Zone</label>
							<div class="element-buttons">
								{#each config.zones as zone, i (zone.key)}
									<button
										type="button"
										class={`element-btn ${selectedZoneIndex === i ? 'active' : ''}`}
										onclick={() => { selectedZoneIndex = i; drawCanvas(); }}
									>
										{zone.label}
									</button>
								{/each}
							</div>
						</div>

						{#if selectedZone}
							<ZonePropertyEditor zone={selectedZone} onChange={handleZoneChange} />
						{/if}

						<div class="control-group actions">
							<button type="button" class="btn" onclick={saveToDb} disabled={saving}>
								{saving ? 'Saving...' : 'Save to DB'}
							</button>
							{#if onBatchGenerate}
								<button type="button" class="btn" onclick={handleBatchGenerate} disabled={saving}>
									Generate All
								</button>
							{/if}
							<button type="button" class="btn btn--secondary" onclick={resetDefaults} disabled={saving}>
								Reset
							</button>
						</div>

						<div class="control-group">
							<button type="button" class="btn btn--secondary" onclick={() => (jsonEditorOpen ? closeJsonEditor() : openJsonEditor())}>
								{jsonEditorOpen ? 'Hide JSON' : 'Show JSON'}
							</button>
							{#if jsonEditorOpen}
								<div class="json">
									<div class="json-actions">
										<button type="button" class="btn btn--secondary" onclick={copyJsonToClipboard}>Copy</button>
										<button type="button" class="btn" onclick={applyJson}>Apply</button>
									</div>
									<textarea bind:value={jsonText} spellcheck="false" />
									{#if jsonError}
										<div class="err">{jsonError}</div>
									{/if}
								</div>
							{/if}
						</div>

						{#if error}
							<div class="err">Error: {error}</div>
						{/if}
					</div>

					<div class="preview">
						<canvas
							bind:this={canvasEl}
							onmousedown={handleCanvasDown}
							onmousemove={handleCanvasMove}
							onmouseup={handleCanvasUp}
							onmouseleave={handleCanvasUp}
						/>
						<p class="hint">Drag zones to reposition. Canvas: {canvasFullWidth}x{canvasFullHeight}.</p>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.7);
		display: grid;
		place-items: center;
		z-index: 60;
	}

	.modal {
		width: min(1200px, calc(100vw - 32px));
		height: min(760px, calc(100vh - 32px));
		background: rgba(15, 23, 42, 0.96);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 16px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: #e2e8f0;
	}

	.modal__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
	}

	.modal__header h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.modal__close {
		background: transparent;
		color: #e2e8f0;
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 10px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
	}

	.modal__body {
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.layout {
		display: grid;
		grid-template-columns: 360px 1fr;
		height: 100%;
	}

	.controls {
		padding: 0.75rem;
		border-right: 1px solid rgba(148, 163, 184, 0.12);
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.preview {
		padding: 0.75rem;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	canvas {
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(2, 6, 23, 0.25);
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.control-label {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.8);
	}

	.control-select,
	select {
		padding: 0.4rem 0.5rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
	}

	.element-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.element-btn {
		padding: 0.35rem 0.55rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(2, 6, 23, 0.25);
		color: #e2e8f0;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.element-btn.active {
		border-color: rgba(96, 165, 250, 0.7);
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
	}

	.actions {
		flex-direction: row;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.45rem 0.6rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: rgba(96, 165, 250, 0.18);
		color: #e2e8f0;
		font-weight: 800;
		cursor: pointer;
	}

	.btn--secondary {
		background: rgba(148, 163, 184, 0.12);
	}

	.hint {
		margin: 0;
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.9);
	}

	.err {
		color: #fecaca;
		font-size: 0.85rem;
		white-space: pre-wrap;
	}

	.json-actions {
		display: flex;
		gap: 0.5rem;
	}

	textarea {
		min-height: 160px;
		resize: vertical;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		padding: 0.35rem 0.45rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
		width: 100%;
		box-sizing: border-box;
	}
</style>
