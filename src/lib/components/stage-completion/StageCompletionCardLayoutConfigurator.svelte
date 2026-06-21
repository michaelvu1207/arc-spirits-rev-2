<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import { loadOpsilonFont, loadImage } from '$lib/generators/shared/canvas';
	import { loadLayoutConfig, saveLayoutConfig } from '$lib/services/layoutConfigService';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { getErrorMessage } from '$lib/utils';
	import { eventTypeLabel, type EventType } from '$lib/types/eventTypes';
	import {
		createDefaultConfig,
		coerceConfig,
		PLACEMENT_KEYS,
		type Align,
		type TextStyle,
		type Transform,
		type Box,
		type StageCompletionPlacementKey,
		type StageCompletionCardLayoutConfig
	} from '$lib/generators/shared/stageCompletionCardLayoutConfig';

	type CardItem = {
		id: string;
		title: string;
		complete_condition: string;
		stage: EventType;
		scenario_id: string | null;
		image_path: string | null;
		card_image_path: string | null;
		updated_at: string | null;
	};

	interface Props {
		isOpen: boolean;
		cards: CardItem[];
		scenarios: { id: string; name: string }[];
		onClose: () => void;
		onUpdated?: () => void;
	}

	let { isOpen, cards, scenarios, onClose, onUpdated }: Props = $props();

	// State – config is null until a default base image provides dimensions
	let config = $state<StageCompletionCardLayoutConfig | null>(null);
	let loadedFromDb = $state(false);
	let hasSavedRow = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let sampleCardId = $state<string>('');
	let sampleBackgroundUrl = $state<string | null>(null);
	let defaultBaseImageUrl = $state<string | null>(null);
	let sampleBgSize = $state<{ w: number; h: number } | null>(null);
	let displayScale = $state(1);
	let uploading = $state(false);
	let uploadingDefault = $state(false);

	let selectedElement = $state<StageCompletionPlacementKey>('title');
	let stageEl = $state<HTMLDivElement | null>(null);
	let hoveredElement = $state<StageCompletionPlacementKey | null>(null);

	// Interaction state (drag / rotate / resize)
	type Interaction =
		| { type: 'drag'; key: StageCompletionPlacementKey; offsetX: number; offsetY: number }
		| { type: 'rotate'; key: StageCompletionPlacementKey; startAngle: number; startRotation: number }
		| { type: 'resize'; key: StageCompletionPlacementKey; startX: number; startY: number; startW: number; startH: number; rotation: number };

	let interaction = $state<Interaction | null>(null);

	const placementKeys = PLACEMENT_KEYS;

	const sampleCard = $derived.by(() => cards.find((c) => c.id === sampleCardId) ?? null);
	const scenarioMap = $derived(new Map(scenarios.map((s) => [s.id, s.name])));
	const selectedPlacement = $derived.by(() => config ? config.placements[selectedElement] : null);
	const selectedTextBox = $derived.by(() => config ? config.text_boxes[selectedElement] : null);
	const selectedTextStyle = $derived.by(() => config ? config.text_styles[selectedElement] : null);

	const activeBackgroundUrl = $derived(sampleBackgroundUrl ?? defaultBaseImageUrl);
	const editorDisabled = $derived(!config);

	// Compute handle positions for any element
	function computeHandles(key: StageCompletionPlacementKey) {
		if (!config) return null;
		const p = config.placements[key];
		const box = config.text_boxes[key];
		const s = Math.max(0.05, p.scale);
		const rad = p.rotation * Math.PI / 180;
		const cosR = Math.cos(rad);
		const sinR = Math.sin(rad);
		const cx = p.x * displayScale;
		const cy = p.y * displayScale;
		const hw = box.w / 2 * s * displayScale;
		const hh = box.h / 2 * s * displayScale;

		const toScreen = (lx: number, ly: number) => ({
			x: cx + lx * cosR - ly * sinR,
			y: cy + lx * sinR + ly * cosR
		});

		const stemStart = toScreen(0, -hh);
		const rotHandle = toScreen(0, -hh - 28);
		const resizeHandle = toScreen(hw, hh);

		return { cx, cy, stemStart, rotHandle, resizeHandle };
	}

	const selectedHandles = $derived.by(() => computeHandles(selectedElement));

	onMount(async () => {
		await loadOpsilonFont();
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
			const result = await loadLayoutConfig('stage_completion', 'base');
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
			const result = await saveLayoutConfig('stage_completion', 'base', config);
			if (result.error) throw result.error;
			hasSavedRow = true;
		} catch (e) {
			error = getErrorMessage(e);
		} finally {
			saving = false;
		}
	}

	async function loadSampleImage() {
		const card = cards.find((c) => c.id === sampleCardId) ?? null;
		if (!card?.image_path) {
			sampleBackgroundUrl = null;
			sampleBgSize = null;
			updateDisplayScale();
			return;
		}

		try {
			const url = publicAssetUrl(card.image_path, { updatedAt: card.updated_at ?? 0 });
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
				folder: 'card_images/stage_completion/default_base',
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
		if (!file || !sampleCard) return;

		uploading = true;
		error = null;
		try {
			const result = await processAndUploadImage(file, {
				folder: 'card_images/stage_completion/base',
				filename: sampleCard.id,
				cropTransparent: false
			});
			if (result.error) throw result.error;
			if (!result.data) throw new Error('Upload returned no path.');

			const { error: updateErr } = await supabase
				.from('stage_completion_cards')
				.update({ image_path: result.data.path, updated_at: new Date().toISOString() })
				.eq('id', sampleCard.id);
			if (updateErr) throw updateErr;

			const card = cards.find((c) => c.id === sampleCard.id);
			if (card) {
				card.image_path = result.data.path;
				card.updated_at = new Date().toISOString();
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

	const cardsWithBaseImage = $derived(
		cards.filter((c) => c.image_path && c.id !== sampleCardId)
	);

	async function copyBaseImageFrom(sourceId: string) {
		const source = cards.find((c) => c.id === sourceId);
		if (!source?.image_path || !sampleCard) return;

		uploading = true;
		error = null;
		try {
			const { error: updateErr } = await supabase
				.from('stage_completion_cards')
				.update({ image_path: source.image_path, updated_at: new Date().toISOString() })
				.eq('id', sampleCard.id);
			if (updateErr) throw updateErr;

			const card = cards.find((c) => c.id === sampleCard.id);
			if (card) {
				card.image_path = source.image_path;
				card.updated_at = new Date().toISOString();
			}

			await loadSampleImage();
			onUpdated?.();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			uploading = false;
		}
	}

	// Placement updates
	function updatePlacement(key: StageCompletionPlacementKey, partial: Partial<Transform>) {
		if (!config) return;
		config = {
			...config,
			placements: {
				...config.placements,
				[key]: { ...config.placements[key], ...partial }
			}
		};
	}

	function updateTextBox(key: StageCompletionPlacementKey, partial: Partial<Box>) {
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

	function updateTextStyle(key: StageCompletionPlacementKey, partial: Partial<TextStyle>) {
		if (!config) return;
		config = {
			...config,
			text_styles: {
				...config.text_styles,
				[key]: { ...config.text_styles[key], ...partial }
			}
		};
	}

	// --- Interaction handlers ---

	function onPlacedPointerDown(e: PointerEvent, key: StageCompletionPlacementKey) {
		if (!stageEl || !config) return;
		selectedElement = key;

		const rect = stageEl.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;

		const placement = config.placements[key];
		const left = placement.x * displayScale;
		const top = placement.y * displayScale;

		interaction = { type: 'drag', key, offsetX: pointerX - left, offsetY: pointerY - top };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onRotateHandleDown(e: PointerEvent, key: StageCompletionPlacementKey) {
		e.stopPropagation();
		if (!stageEl || !config) return;
		selectedElement = key;

		const rect = stageEl.getBoundingClientRect();
		const placement = config.placements[key];
		const centerX = placement.x * displayScale + rect.left;
		const centerY = placement.y * displayScale + rect.top;

		const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

		interaction = { type: 'rotate', key, startAngle, startRotation: placement.rotation };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onResizeHandleDown(e: PointerEvent, key: StageCompletionPlacementKey) {
		e.stopPropagation();
		if (!stageEl || !config) return;
		selectedElement = key;

		const placement = config.placements[key];
		const textBox = config.text_boxes[key];

		interaction = {
			type: 'resize',
			key,
			startX: e.clientX,
			startY: e.clientY,
			startW: textBox.w,
			startH: textBox.h,
			rotation: placement.rotation
		};
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onStagePointerMove(e: PointerEvent) {
		if (!stageEl || !interaction || !config) return;

		if (interaction.type === 'drag') {
			const rect = stageEl.getBoundingClientRect();
			const pointerX = e.clientX - rect.left;
			const pointerY = e.clientY - rect.top;

			const x = (pointerX - interaction.offsetX) / displayScale;
			const y = (pointerY - interaction.offsetY) / displayScale;
			updatePlacement(interaction.key, {
				x: Math.max(-config._ref_w, Math.min(config._ref_w * 2, x)),
				y: Math.max(-config._ref_h, Math.min(config._ref_h * 2, y))
			});
		} else if (interaction.type === 'rotate') {
			const rect = stageEl.getBoundingClientRect();
			const placement = config.placements[interaction.key];
			const centerX = placement.x * displayScale + rect.left;
			const centerY = placement.y * displayScale + rect.top;

			const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
			const deltaAngle = currentAngle - interaction.startAngle;
			updatePlacement(interaction.key, { rotation: interaction.startRotation + deltaAngle });
		} else if (interaction.type === 'resize') {
			const rawDx = (e.clientX - interaction.startX) / displayScale;
			const rawDy = (e.clientY - interaction.startY) / displayScale;

			// Project screen delta onto the element's local axes
			const rad = interaction.rotation * Math.PI / 180;
			const cosR = Math.cos(rad);
			const sinR = Math.sin(rad);
			const localDx = rawDx * cosR + rawDy * sinR;
			const localDy = -rawDx * sinR + rawDy * cosR;

			const scale = Math.max(0.05, config.placements[interaction.key].scale);
			updateTextBox(interaction.key, {
				w: Math.max(20, Math.round(interaction.startW + localDx / scale)),
				h: Math.max(20, Math.round(interaction.startH + localDy / scale))
			});
		}
	}

	function onStagePointerUp() {
		interaction = null;
		hoveredElement = null;
	}

	function getPreviewText(key: StageCompletionPlacementKey): string {
		if (!sampleCard) {
			const fallbacks: Record<StageCompletionPlacementKey, string> = {
				title: 'Card Title',
				complete_condition: 'Stage completion condition text...',
				stage_text: 'Stage 1 - Scenario',
				advance_to_next_stage_label: 'To advance to the next stage: '
			};
			return fallbacks[key];
		}
		switch (key) {
			case 'title': return sampleCard.title || 'Untitled';
			case 'complete_condition': return sampleCard.complete_condition || '';
			case 'stage_text':
				return `${eventTypeLabel(sampleCard.stage)} - ${sampleCard.scenario_id ? scenarioMap.get(sampleCard.scenario_id) ?? 'Unassigned' : 'Unassigned'}`;
			case 'advance_to_next_stage_label': return 'To advance to the next stage: ';
		}
	}

	function resetConfig() {
		if (!config) return;
		config = createDefaultConfig(config._ref_w, config._ref_h);
		selectedElement = 'title';
	}

	// Stage cursor based on current interaction
	const stageCursor = $derived.by(() => {
		if (!interaction) return 'default';
		if (interaction.type === 'drag') return 'grabbing';
		if (interaction.type === 'rotate') return 'crosshair';
		if (interaction.type === 'resize') return 'nwse-resize';
		return 'default';
	});
</script>

{#if isOpen}
	<div class="overlay" role="dialog" aria-modal="true" onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="modal">
			<header class="modal__header">
				<div>
					<h2>Stage Completion Card Layout Editor</h2>
					<p class="modal__subtitle">Click elements to select. Drag to reposition. Use handles to rotate and resize.</p>
				</div>
				<button class="icon-btn" type="button" onclick={onClose} aria-label="Close">&#x2715;</button>
			</header>

			{#if error}
				<div class="banner banner--error">{error}</div>
			{/if}

			<div class="content">
				<section class="stage-pane">
					<div class="stage-toolbar">
						<label class="field">
							<span>Sample Card</span>
							<select bind:value={sampleCardId} disabled={editorDisabled}>
								<option value="">(choose)</option>
								{#each cards as card (card.id)}
									<option value={card.id}>{card.title}</option>
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
							{#if sampleCard && config}
								<label class="upload-btn" class:is-uploading={uploading}>
									{uploading ? 'Uploading...' : sampleCard.image_path ? 'Replace Card Image' : 'Upload Card Image'}
									<input
										type="file"
										accept="image/*"
										class="sr-only"
										onchange={handleBaseImageUpload}
										disabled={uploading}
									/>
								</label>
								{#if cardsWithBaseImage.length > 0}
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
										{#each cardsWithBaseImage as card (card.id)}
											<option value={card.id}>{card.title}</option>
										{/each}
									</select>
								{/if}
							{/if}
							{#if config}
								<div class="hint">
									{config._ref_w}x{config._ref_h}
									{#if sampleBgSize}
										&middot; Img: {sampleBgSize.w}x{sampleBgSize.h}
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
							class:is-interacting={interaction !== null}
							bind:this={stageEl}
							style="cursor:{stageCursor};"
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
									style={`width:${config._ref_w * displayScale}px;height:auto;`}
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
								{@const isSelected = selectedElement === item.key}
								{@const isHovered = hoveredElement === item.key && !isSelected}
								<div
									class="placed"
									class:is-selected={isSelected}
									class:is-hovered={isHovered}
									class:is-dragging={interaction?.type === 'drag' && interaction.key === item.key}
									style={`left:${placement.x * displayScale}px;top:${placement.y * displayScale}px;transform:translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${scale * displayScale});`}
									role="button"
									tabindex="0"
									onclick={() => (selectedElement = item.key)}
									onpointerdown={(e) => onPlacedPointerDown(e, item.key)}
									onpointerenter={() => { if (!interaction) hoveredElement = item.key; }}
									onpointerleave={() => { if (hoveredElement === item.key) hoveredElement = null; }}
								>
									<span class="placed-label" class:is-selected={isSelected}>{item.label}</span>
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

							<!-- Handles for the selected element -->
							{#if selectedHandles}
							<svg class="handle-lines">
								<line
									x1={selectedHandles.stemStart.x} y1={selectedHandles.stemStart.y}
									x2={selectedHandles.rotHandle.x} y2={selectedHandles.rotHandle.y}
									stroke="rgba(168,85,247,0.5)" stroke-width="1.5"
								/>
							</svg>
							<div
								class="handle handle--rotate"
								class:is-active={interaction?.type === 'rotate'}
								style="left:{selectedHandles.rotHandle.x}px;top:{selectedHandles.rotHandle.y}px;"
								role="button"
								tabindex="-1"
								onpointerdown={(e) => onRotateHandleDown(e, selectedElement)}
							></div>
							<div
								class="handle handle--resize"
								class:is-active={interaction?.type === 'resize'}
								style="left:{selectedHandles.resizeHandle.x}px;top:{selectedHandles.resizeHandle.y}px;"
								role="button"
								tabindex="-1"
								onpointerdown={(e) => onResizeHandleDown(e, selectedElement)}
							></div>
							{/if}
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
									value={Math.round(selectedPlacement.rotation * 10) / 10}
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
		padding: 2.5rem 0.75rem 0.75rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
		min-height: 0;
		flex: 1;
		overflow: visible;
		overscroll-behavior: contain;
	}

	.stage {
		position: relative;
		display: inline-block;
		user-select: none;
		touch-action: none;
	}

	.stage__base-img {
		display: block;
		pointer-events: none;
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

	/* Placed elements */

	.placed {
		position: absolute;
		cursor: grab;
		transform-origin: center;
		border-radius: 4px;
		outline: 2px solid transparent;
		outline-offset: 2px;
		transition: outline-color 0.12s ease;
	}

	.placed:hover:not(.is-selected):not(.is-dragging) {
		outline-color: rgba(148, 163, 184, 0.45);
	}

	.placed.is-hovered {
		outline-color: rgba(148, 163, 184, 0.45);
	}

	.placed.is-selected {
		outline-color: rgba(168, 85, 247, 0.8);
	}

	.placed.is-dragging {
		cursor: grabbing;
	}

	.placed.is-selected .text-bounds {
		opacity: 1;
		border-color: rgba(168, 85, 247, 0.8);
	}

	.placed.is-hovered .text-bounds {
		opacity: 0.5;
		border-color: rgba(148, 163, 184, 0.5);
	}

	/* Element label badge */
	.placed-label {
		position: absolute;
		top: -20px;
		left: 50%;
		transform: translateX(-50%);
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		white-space: nowrap;
		pointer-events: none;
		background: rgba(30, 41, 59, 0.88);
		border: 1px solid rgba(148, 163, 184, 0.3);
		color: rgba(203, 213, 225, 0.9);
		opacity: 0.7;
		transition: opacity 0.12s ease, background 0.12s ease, border-color 0.12s ease;
	}

	.placed:hover .placed-label,
	.placed.is-hovered .placed-label {
		opacity: 1;
		background: rgba(30, 41, 59, 0.95);
	}

	.placed-label.is-selected {
		opacity: 1;
		background: rgba(88, 28, 135, 0.85);
		border-color: rgba(168, 85, 247, 0.6);
		color: rgba(243, 232, 255, 0.95);
	}

	.text-overlay {
		box-sizing: border-box;
		overflow: hidden;
		white-space: normal;
		overflow-wrap: anywhere;
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
		transition: opacity 0.12s ease;
	}

	/* Handles */

	.handle-lines {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: visible;
	}

	.handle {
		position: absolute;
		transform: translate(-50%, -50%);
		z-index: 10;
		pointer-events: auto;
		transition: transform 0.1s ease, box-shadow 0.1s ease;
	}

	.handle--rotate {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: rgba(168, 85, 247, 0.85);
		border: 2px solid rgba(168, 85, 247, 1);
		cursor: grab;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.handle--rotate:hover,
	.handle--rotate.is-active {
		background: rgba(168, 85, 247, 1);
		transform: translate(-50%, -50%) scale(1.25);
		box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.3), 0 2px 8px rgba(0, 0, 0, 0.4);
		cursor: crosshair;
	}

	.handle--resize {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		background: rgba(56, 189, 248, 0.85);
		border: 2px solid rgba(56, 189, 248, 1);
		cursor: nwse-resize;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.handle--resize:hover,
	.handle--resize.is-active {
		background: rgba(56, 189, 248, 1);
		transform: translate(-50%, -50%) scale(1.25);
		box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.3), 0 2px 8px rgba(0, 0, 0, 0.4);
	}

	/* Sidebar */

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
