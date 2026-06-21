<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import { loadOpsilonFont, loadImage } from '$lib/generators/shared/canvas';
	import { loadVincendoFont } from '$lib/generators/shared/canvas';
	import { loadLayoutConfig, saveLayoutConfig } from '$lib/services/layoutConfigService';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { getErrorMessage } from '$lib/utils';
	import {
		createDefaultConfig,
		coerceConfig,
		PLACEMENT_KEYS,
		type Align,
		type Box,
		type TextStyle,
		type Transform,
		type EventCardPlacementKey,
		type EventCardLayoutConfig
	} from '$lib/generators/shared/eventCardLayoutConfig';

	type EventCard = {
		id: string;
		internal_name: string;
		title: string;
		description: string | null;
		reward_rows: any[];
		image_path: string | null;
		card_image_path: string | null;
		updated_at: string | null;
	};

	interface Props {
		isOpen: boolean;
		events: EventCard[];
		onClose: () => void;
		onUpdated?: () => void;
	}

	let { isOpen, events, onClose, onUpdated }: Props = $props();

	// State – config is null until a default base image provides dimensions
	let config = $state<EventCardLayoutConfig | null>(null);
	let loadedFromDb = $state(false);
	let hasSavedRow = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let sampleEventId = $state<string>('');
	let sampleBackgroundUrl = $state<string | null>(null);
	let defaultBaseImageUrl = $state<string | null>(null);
	let sampleBgSize = $state<{ w: number; h: number } | null>(null);
	let displayScale = $state(1);
	let uploading = $state(false);
	let uploadingDefault = $state(false);

	let selectedElement = $state<EventCardPlacementKey>('title');
	let stageEl = $state<HTMLDivElement | null>(null);
	let dragging = $state<{ key: EventCardPlacementKey; offsetX: number; offsetY: number } | null>(null);

	const placementKeys = PLACEMENT_KEYS;

	const sampleEvent = $derived.by(() => events.find((e) => e.id === sampleEventId) ?? null);
	const selectedPlacement = $derived.by(() => config ? config.placements[selectedElement] : null);
	const selectedTextBox = $derived.by(() => config ? config.text_boxes[selectedElement] : null);
	const selectedTextStyle = $derived.by(() => config ? config.text_styles[selectedElement] : null);

	// The active background: per-card image if available, otherwise default base image
	const activeBackgroundUrl = $derived(sampleBackgroundUrl ?? defaultBaseImageUrl);
	const editorDisabled = $derived(!config);

	onMount(async () => {
		await Promise.all([loadOpsilonFont(), loadVincendoFont()]);
	});

	$effect(() => {
		if (!isOpen) return;
		void ensureLoaded();
	});

	$effect(() => {
		if (!isOpen) return;
		void loadSampleImage();
	});

	async function ensureLoaded() {
		if (loadedFromDb) return;
		error = null;
		try {
			const result = await loadLayoutConfig('event', 'base');
			if (result.error) throw result.error;
			hasSavedRow = result.config !== null;

			// Load default base image first to get dimensions
			const rawConfig = result.config as Record<string, unknown> | null;
			const basePath = rawConfig && typeof rawConfig === 'object' && typeof rawConfig.defaultBaseImagePath === 'string'
				? rawConfig.defaultBaseImagePath
				: null;

			if (basePath) {
				const url = publicAssetUrl(basePath);
				defaultBaseImageUrl = url ?? null;
				if (url) {
					try {
						const img = await loadImage(url);
						const iw = img.naturalWidth || img.width;
						const ih = img.naturalHeight || img.height;
						if (iw && ih) {
							config = coerceConfig(result.config, iw, ih) ?? createDefaultConfig(iw, ih);
						} else {
							config = coerceConfig(result.config) ?? null;
						}
					} catch {
						config = coerceConfig(result.config) ?? null;
					}
				} else {
					config = coerceConfig(result.config) ?? null;
				}
			} else {
				defaultBaseImageUrl = null;
				config = null;
			}

			updateDisplayScale();
			loadedFromDb = true;
		} catch (e) {
			error = getErrorMessage(e);
			config = null;
			loadedFromDb = true;
			hasSavedRow = false;
		}
	}

	async function saveConfig() {
		if (!config) return;
		saving = true;
		error = null;
		try {
			const result = await saveLayoutConfig('event', 'base', config);
			if (result.error) throw result.error;
			hasSavedRow = true;
		} catch (e) {
			error = getErrorMessage(e);
		} finally {
			saving = false;
		}
	}

	async function loadSampleImage() {
		const ev = events.find((e) => e.id === sampleEventId) ?? null;
		if (!ev?.image_path) {
			sampleBackgroundUrl = null;
			sampleBgSize = null;
			updateDisplayScale();
			return;
		}

		try {
			const url = publicAssetUrl(ev.image_path, { updatedAt: ev.updated_at ?? 0 });
			if (!url) throw new Error('Missing public URL.');
			const img = await loadImage(url);

			const iw = img.naturalWidth || img.width;
			const ih = img.naturalHeight || img.height;
			sampleBgSize = iw && ih ? { w: iw, h: ih } : null;
			sampleBackgroundUrl = url;
			updateDisplayScale();
		} catch {
			sampleBackgroundUrl = null;
			sampleBgSize = null;
		}
	}

	function updateDisplayScale() {
		if (!config) return;
		const maxW = 1050;
		const maxH = 740;
		displayScale = Math.min(1, maxW / Math.max(1, config._ref_w), maxH / Math.max(1, config._ref_h));
	}

	async function handleDefaultBaseImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		uploadingDefault = true;
		error = null;
		try {
			const result = await processAndUploadImage(file, {
				folder: 'card_images/events/default_base',
				filename: 'default',
				cropTransparent: false
			});
			if (result.error) throw result.error;
			if (!result.data) throw new Error('Upload returned no path.');

			const url = publicAssetUrl(result.data.path);
			if (!url) throw new Error('Could not resolve public URL.');

			defaultBaseImageUrl = url;
			const img = await loadImage(url);
			const iw = img.naturalWidth || img.width;
			const ih = img.naturalHeight || img.height;
			if (!iw || !ih) throw new Error('Could not determine image dimensions.');

			config = { ...createDefaultConfig(iw, ih), defaultBaseImagePath: result.data.path };
			updateDisplayScale();
			await saveConfig();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			uploadingDefault = false;
			input.value = '';
		}
	}

	async function handleBaseImageUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !sampleEvent) return;

		uploading = true;
		error = null;
		try {
			const result = await processAndUploadImage(file, {
				folder: 'card_images/events/base',
				filename: sampleEvent.id,
				cropTransparent: false
			});
			if (result.error) throw result.error;
			if (!result.data) throw new Error('Upload returned no path.');

			const { error: updateErr } = await supabase
				.from('event_cards')
				.update({ image_path: result.data.path, updated_at: new Date().toISOString() })
				.eq('id', sampleEvent.id);
			if (updateErr) throw updateErr;

			// Refresh local data
			const ev = events.find((e2) => e2.id === sampleEvent.id);
			if (ev) {
				ev.image_path = result.data.path;
				ev.updated_at = new Date().toISOString();
			}

			await loadSampleImage();
			onUpdated?.();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	const eventsWithBaseImage = $derived(
		events.filter((ev) => ev.image_path && ev.id !== sampleEventId)
	);

	async function copyBaseImageFrom(sourceId: string) {
		const source = events.find((e) => e.id === sourceId);
		if (!source?.image_path || !sampleEvent) return;

		uploading = true;
		error = null;
		try {
			const { error: updateErr } = await supabase
				.from('event_cards')
				.update({ image_path: source.image_path, updated_at: new Date().toISOString() })
				.eq('id', sampleEvent.id);
			if (updateErr) throw updateErr;

			const ev = events.find((e) => e.id === sampleEvent.id);
			if (ev) {
				ev.image_path = source.image_path;
				ev.updated_at = new Date().toISOString();
			}

			await loadSampleImage();
			onUpdated?.();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			uploading = false;
		}
	}

	// Placement & drag
	function updatePlacement(key: EventCardPlacementKey, partial: Partial<Transform>) {
		if (!config) return;
		config = {
			...config,
			placements: {
				...config.placements,
				[key]: { ...config.placements[key], ...partial }
			}
		};
	}

	function updateTextBox(key: EventCardPlacementKey, partial: Partial<Box>) {
		if (!config) return;
		const current = config.text_boxes[key];
		const safeNum = (v: unknown, fb: number) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };
		config = {
			...config,
			text_boxes: {
				...config.text_boxes,
				[key]: {
					w: Math.max(1, Math.round(safeNum(partial.w, current.w))),
					h: Math.max(1, Math.round(safeNum(partial.h, current.h)))
				}
			}
		};
	}

	function updateTextStyle(key: EventCardPlacementKey, partial: Partial<TextStyle>) {
		if (!config) return;
		config = {
			...config,
			text_styles: {
				...config.text_styles,
				[key]: { ...config.text_styles[key], ...partial }
			}
		};
	}

	function onPlacedPointerDown(e: PointerEvent, key: EventCardPlacementKey) {
		if (!stageEl || !config) return;
		selectedElement = key;

		const rect = stageEl.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;

		const placement = config.placements[key];
		const left = placement.x * displayScale;
		const top = placement.y * displayScale;

		dragging = { key, offsetX: pointerX - left, offsetY: pointerY - top };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onStagePointerMove(e: PointerEvent) {
		if (!stageEl || !dragging || !config) return;
		const rect = stageEl.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;

		const x = (pointerX - dragging.offsetX) / displayScale;
		const y = (pointerY - dragging.offsetY) / displayScale;
		updatePlacement(dragging.key, {
			x: Math.max(-config._ref_w, Math.min(config._ref_w * 2, x)),
			y: Math.max(-config._ref_h, Math.min(config._ref_h * 2, y))
		});
	}

	function onStagePointerUp() {
		dragging = null;
	}

	function getPreviewText(key: EventCardPlacementKey): string {
		if (!sampleEvent) {
			const fallbacks: Record<EventCardPlacementKey, string> = {
				title: 'Event Title',
				description: 'Event description text goes here...',
				reward_row: 'Reward icons'
			};
			return fallbacks[key];
		}
		switch (key) {
			case 'title': return sampleEvent.title || 'Untitled';
			case 'description': return sampleEvent.description || '';
			case 'reward_row': {
				if (!sampleEvent.reward_rows?.length) return 'No rewards';
				return sampleEvent.reward_rows.map((r: any) => {
					if (r.type === 'text') return r.text || '(text)';
					const icons = r.gain_icon_ids || r.icon_ids || [];
					return `[${icons.length} icons]`;
				}).join(' | ');
			}
		}
	}

	function resetConfig() {
		if (!config) return;
		config = createDefaultConfig(config._ref_w, config._ref_h);
		selectedElement = 'title';
	}
</script>

{#if isOpen}
	<div class="overlay" role="dialog" aria-modal="true" onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="modal">
			<header class="modal__header">
				<div>
					<h2>Event Card Layout Editor</h2>
					<p class="modal__subtitle">Upload a base image, then drag text fields into position. Save as a global template.</p>
				</div>
				<button class="icon-btn" type="button" onclick={onClose} aria-label="Close">✕</button>
			</header>

			{#if error}
				<div class="banner banner--error">{error}</div>
			{/if}

			<div class="content">
				<section class="stage-pane">
					<div class="stage-toolbar">
						<label class="field">
							<span>Sample Event</span>
							<select bind:value={sampleEventId}>
								<option value="">(choose)</option>
								{#each events as ev (ev.id)}
									<option value={ev.id}>{ev.title || ev.internal_name}</option>
								{/each}
							</select>
						</label>

						<div class="toolbar-right">
							<label class="upload-btn" class:is-uploading={uploadingDefault}>
								{uploadingDefault ? 'Uploading...' : defaultBaseImageUrl ? 'Replace Default Base' : 'Upload Default Base'}
								<input
									type="file"
									accept="image/*"
									class="sr-only"
									onchange={handleDefaultBaseImageUpload}
									disabled={uploadingDefault}
								/>
							</label>
							{#if sampleEvent && !editorDisabled}
								<label class="upload-btn" class:is-uploading={uploading}>
									{uploading ? 'Uploading...' : sampleEvent.image_path ? 'Replace Card Image' : 'Upload Card Image'}
									<input
										type="file"
										accept="image/*"
										class="sr-only"
										onchange={handleBaseImageUpload}
										disabled={uploading}
									/>
								</label>
								{#if eventsWithBaseImage.length > 0}
									<select
										class="copy-from-select"
										disabled={uploading}
										onchange={(e) => {
											const val = (e.target as HTMLSelectElement).value;
											if (val) {
												void copyBaseImageFrom(val);
												(e.target as HTMLSelectElement).value = '';
											}
										}}
									>
										<option value="">Copy base from...</option>
										{#each eventsWithBaseImage as ev (ev.id)}
											<option value={ev.id}>{ev.title || ev.internal_name}</option>
										{/each}
									</select>
								{/if}
							{/if}
							{#if config}
								<div class="hint">
									{config._ref_w}x{config._ref_h}
									{#if sampleBgSize}
										· Img: {sampleBgSize.w}x{sampleBgSize.h}
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<div class="stage-wrap">
						{#if !config}
							<div class="stage-disabled">
								<p>Upload a default base image to start editing.</p>
							</div>
						{:else}
						<div
							class="stage"
							bind:this={stageEl}
							style={`width:${config._ref_w * displayScale}px;height:${config._ref_h * displayScale}px;`}
							onpointermove={onStagePointerMove}
							onpointerup={onStagePointerUp}
							onpointerleave={onStagePointerUp}
						>
							{#if activeBackgroundUrl}
								<img
									class="stage__base-img"
									src={activeBackgroundUrl}
									alt="Base card image"
									draggable="false"
									style={`width:100%;height:100%;`}
								/>
							{:else}
								<div class="stage__placeholder" style={`width:${config._ref_w * displayScale}px;height:${config._ref_h * displayScale}px;`}></div>
							{/if}
							{#each placementKeys as item (item.key)}
								{@const placement = config.placements[item.key]}
								{@const textBox = config.text_boxes[item.key]}
								{@const style = config.text_styles[item.key]}
								{@const scale = Math.max(0.05, placement.scale)}
								{@const text = getPreviewText(item.key)}
								<div
									class="placed"
									class:is-selected={selectedElement === item.key}
									style={`left:${placement.x * displayScale}px;top:${placement.y * displayScale}px;transform:translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${scale * displayScale});`}
									role="button"
									tabindex="0"
									onclick={() => (selectedElement = item.key)}
									onpointerdown={(e) => onPlacedPointerDown(e, item.key)}
								>
									<div
										class="text-overlay"
										class:is-empty={!text}
										style={`width:${textBox.w / scale}px;height:${textBox.h / scale}px;font-size:${style.fontSize / scale}px;line-height:${style.lineHeight ? `${style.lineHeight / scale}px` : '1.2'};text-align:${style.align};color:${style.color};${style.fontFamily ? `font-family:${style.fontFamily}, ui-serif, system-ui, sans-serif;` : ''}`}
									>
										{text || item.label}
									</div>
									<div
										class="text-bounds"
										style={`width:${textBox.w / scale}px;height:${textBox.h / scale}px;`}
									></div>
								</div>
							{/each}
						</div>
						{/if}
					</div>
				</section>

				<aside class="sidebar">
				{#if config && selectedPlacement && selectedTextBox && selectedTextStyle}
					<div class="section">
						<label class="field">
							<span>Element</span>
							<select bind:value={selectedElement}>
								{#each placementKeys as item (item.key)}
									<option value={item.key}>{item.label}</option>
								{/each}
							</select>
						</label>
					</div>

					<div class="section">
						<h3>Transform</h3>
						<div class="grid">
							<label class="field">
								<span>X</span>
								<input
									type="number"
									value={selectedPlacement.x}
									oninput={(e) => updatePlacement(selectedElement, { x: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Y</span>
								<input
									type="number"
									value={selectedPlacement.y}
									oninput={(e) => updatePlacement(selectedElement, { y: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Rotation</span>
								<input
									type="number"
									value={selectedPlacement.rotation}
									oninput={(e) => updatePlacement(selectedElement, { rotation: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Scale</span>
								<input
									type="number"
									step="0.01"
									min="0.05"
									value={selectedPlacement.scale}
									oninput={(e) => updatePlacement(selectedElement, { scale: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
						</div>
					</div>

					<div class="section">
						<h3>Text Box</h3>
						<div class="grid">
							<label class="field">
								<span>Width</span>
								<input
									type="number"
									min="1"
									value={selectedTextBox.w}
									oninput={(e) => updateTextBox(selectedElement, { w: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Height</span>
								<input
									type="number"
									min="1"
									value={selectedTextBox.h}
									oninput={(e) => updateTextBox(selectedElement, { h: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
						</div>
					</div>

					<div class="section">
						<h3>Text Style</h3>
						<div class="grid">
							<label class="field">
								<span>Font Size</span>
								<input
									type="number"
									min="1"
									value={selectedTextStyle.fontSize}
									oninput={(e) => updateTextStyle(selectedElement, { fontSize: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Line H</span>
								<input
									type="number"
									placeholder="auto"
									value={selectedTextStyle.lineHeight ?? ''}
									oninput={(e) => {
										const v = (e.target as HTMLInputElement).value;
										updateTextStyle(selectedElement, { lineHeight: v.trim() ? Number(v) : undefined });
									}}
								/>
							</label>
							<label class="field">
								<span>Align</span>
								<select
									value={selectedTextStyle.align}
									onchange={(e) => updateTextStyle(selectedElement, { align: (e.target as HTMLSelectElement).value as Align })}
								>
									<option value="left">Left</option>
									<option value="center">Center</option>
									<option value="right">Right</option>
								</select>
							</label>
							<label class="field">
								<span>Color</span>
								<input
									type="text"
									value={selectedTextStyle.color}
									oninput={(e) => updateTextStyle(selectedElement, { color: (e.target as HTMLInputElement).value })}
								/>
							</label>
							<label class="field">
								<span>Font</span>
								<select
									value={selectedTextStyle.fontFamily ?? ''}
									onchange={(e) => updateTextStyle(selectedElement, { fontFamily: (e.target as HTMLSelectElement).value || undefined })}
								>
									<option value="">Default</option>
									<option value="Opsilon">Opsilon</option>
									<option value="Vincendo">Vincendo</option>
								</select>
							</label>
						</div>
					</div>

					<div class="section actions">
						<button class="btn btn--ghost" type="button" onclick={resetConfig} disabled={saving}>
							Reset
						</button>
						<button class="btn" type="button" onclick={saveConfig} disabled={saving}>
							{saving ? 'Saving...' : hasSavedRow ? 'Save Template' : 'Create Template'}
						</button>
					</div>
				{:else}
					<div class="stage-disabled">
						<p>Upload a default base image to configure layout.</p>
					</div>
				{/if}
				</aside>
			</div>
		</div>
	</div>
{/if}

<style>
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.78);
		display: grid;
		place-items: center;
		z-index: 60;
		padding: 1.25rem;
	}

	.modal {
		width: min(1200px, 96vw);
		max-height: min(860px, 92vh);
		display: flex;
		flex-direction: column;
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.98);
		box-shadow: 0 24px 60px rgba(2, 6, 23, 0.6);
		overflow: hidden;
	}

	.modal__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.modal__header h2 {
		margin: 0;
		font-size: 1.05rem;
		color: #f8fafc;
	}

	.modal__subtitle {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: rgba(148, 163, 184, 0.9);
	}

	.icon-btn {
		background: transparent;
		border: none;
		color: rgba(226, 232, 240, 0.9);
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0.25rem 0.35rem;
		line-height: 1;
	}

	.banner {
		padding: 0.75rem 1rem;
		margin: 0.75rem 1rem 0;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.4);
		color: #cbd5f5;
	}

	.banner--error {
		border-color: rgba(248, 113, 113, 0.35);
		background: rgba(248, 113, 113, 0.12);
		color: #fecaca;
	}

	.content {
		display: grid;
		grid-template-columns: 1fr 340px;
		gap: 0;
		min-height: 0;
		flex: 1;
	}

	.stage-pane {
		padding: 0.9rem;
		min-height: 0;
		border-right: 1px solid rgba(148, 163, 184, 0.12);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.stage-toolbar {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.toolbar-right {
		display: flex;
		gap: 0.6rem;
		align-items: flex-end;
	}

	.upload-btn {
		display: inline-flex;
		align-items: center;
		padding: 0.4rem 0.65rem;
		border-radius: 10px;
		border: 1px solid rgba(56, 189, 248, 0.35);
		background: rgba(56, 189, 248, 0.15);
		color: rgba(240, 249, 255, 0.95);
		font-size: 0.8rem;
		cursor: pointer;
		transition: background 0.15s;
	}

	.upload-btn:hover {
		background: rgba(56, 189, 248, 0.25);
	}

	.upload-btn.is-uploading {
		opacity: 0.6;
		pointer-events: none;
	}

	.copy-from-select {
		padding: 0.4rem 0.55rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.75);
		color: rgba(226, 232, 240, 0.95);
		font-size: 0.8rem;
		cursor: pointer;
	}

	.stage-wrap {
		display: grid;
		place-items: center;
		padding: 0.75rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
		min-height: 0;
		flex: 1;
		overflow: auto;
		overscroll-behavior: contain;
	}

	.stage {
		position: relative;
		display: inline-block;
		user-select: none;
		touch-action: none;
		overflow: hidden;
	}

	.stage__base-img {
		display: block;
		pointer-events: none;
		object-fit: cover;
		object-position: center;
	}

	.stage__placeholder {
		background: rgba(2, 6, 23, 0.3);
		border-radius: 10px;
		border: 1px dashed rgba(148, 163, 184, 0.25);
	}

	.stage-disabled {
		display: grid;
		place-items: center;
		min-height: 200px;
		color: rgba(148, 163, 184, 0.85);
		font-size: 0.9rem;
		text-align: center;
		padding: 2rem;
	}

	.hint {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.placed {
		position: absolute;
		cursor: grab;
		transform-origin: center;
	}

	.placed.is-selected .text-overlay {
		outline: 2px solid rgba(168, 85, 247, 0.8);
		outline-offset: 2px;
	}

	.placed.is-selected .text-bounds {
		opacity: 1;
		border-color: rgba(168, 85, 247, 0.8);
	}

	.text-overlay {
		box-sizing: border-box;
		overflow: hidden;
		white-space: normal;
		overflow-wrap: anywhere;
		display: block;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
		font-weight: 700;
		pointer-events: none;
		border-radius: 4px;
	}

	.text-overlay.is-empty {
		background: rgba(148, 163, 184, 0.15);
		border: 1px dashed rgba(148, 163, 184, 0.3);
	}

	.text-bounds {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		border-radius: 4px;
		border: 2px dashed rgba(148, 163, 184, 0.4);
		opacity: 0;
		pointer-events: none;
	}

	.sidebar {
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow: auto;
	}

	.section {
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		padding: 0.75rem;
		background: rgba(2, 6, 23, 0.22);
	}

	.section h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		color: rgba(226, 232, 240, 0.95);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.9);
	}

	input,
	select {
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 10px;
		padding: 0.45rem 0.55rem;
		color: rgba(226, 232, 240, 0.95);
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.btn {
		background: rgba(56, 189, 248, 0.22);
		border: 1px solid rgba(56, 189, 248, 0.35);
		color: rgba(240, 249, 255, 0.95);
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.btn--ghost {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.18);
		color: rgba(226, 232, 240, 0.9);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
