<script lang="ts">
	import { onMount } from 'svelte';
	import {
		type BackIconPlacementConfig,
		type IconSlot,
		type TextBoxConfig,
		loadBackIconPlacementConfig,
		saveBackIconPlacementConfig,
		loadBackIconPlacementConfigFromDatabase,
		saveBackIconPlacementConfigToDatabase,
		createDefaultBackConfig
	} from '$lib/generators/spirits/spiritBackIconPlacer';
	import { loadImage } from '$lib/generators/shared/canvas';

	interface Props {
		isOpen: boolean;
		sampleImageUrl: string | null;
		sampleImageUrls?: string[];
		onClose: () => void;
		onSave: (config: BackIconPlacementConfig) => void;
		onGenerateAll?: () => void;
		showGenerateActions?: boolean;
	}

	let {
		isOpen,
		sampleImageUrl,
		sampleImageUrls = [],
		onClose,
		onSave,
		onGenerateAll,
		showGenerateActions = true
	}: Props = $props();

	let config: BackIconPlacementConfig = $state(createDefaultBackConfig());
	// Selection: 'none', 'rune:N', or 'textbox'
	let selectedKey: string = $state('none');
	let selectedSlotIndex = $derived(selectedKey.startsWith('rune:') ? Number(selectedKey.slice(5)) : null);
	let textBoxSelected = $derived(selectedKey === 'textbox');

	let jsonEditorOpen = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let sampleImage: HTMLImageElement | null = $state(null);
	let selectedSampleUrl: string | null = $state(null);
	let loadedSampleUrl: string | null = $state(null);
	let displayScale = $state(1);
	let draggingKey: string = $state('none');
	let dragOffset = $state({ x: 0, y: 0 });

	let runeSlots = $derived(config.rune_slots ?? []);
	let textBoxEnabled = $derived(!!config.text_box);
	let specialClassSlotEnabled = $derived(!!config.special_class_icon_slot);
	let specialClassIconSize = $derived(config._special_class_icon_size || 80);

	onMount(() => {
		config = loadBackIconPlacementConfig();
		loadBackIconPlacementConfigFromDatabase().then((storedConfig) => {
			config = storedConfig;
		});
	});

	$effect(() => {
		if (isOpen) {
			const url = getCurrentSampleUrl();
			if (url !== loadedSampleUrl) {
				loadSampleImg(url);
			}
		}
	});

	$effect(() => {
		if (sampleImage && canvasEl) {
			drawCanvas();
		}
	});

	function getSampleOptions(): string[] {
		return Array.from(new Set(sampleImageUrl ? [sampleImageUrl, ...sampleImageUrls] : sampleImageUrls));
	}

	function getCurrentSampleUrl(): string | null {
		const options = getSampleOptions();
		if (selectedSampleUrl && options.includes(selectedSampleUrl)) {
			return selectedSampleUrl;
		}
		return options[0] ?? null;
	}

	function randomizeSampleImage() {
		const options = getSampleOptions();
		if (options.length === 0) return;
		if (options.length === 1) {
			selectedSampleUrl = options[0];
			return;
		}

		let next = options[Math.floor(Math.random() * options.length)];
		if (next === getCurrentSampleUrl()) {
			const currentIndex = options.indexOf(next);
			next = options[(currentIndex + 1 + Math.floor(Math.random() * (options.length - 1))) % options.length];
		}
		selectedSampleUrl = next;
	}

	async function loadSampleImg(url: string | null) {
		if (!url) {
			sampleImage = null;
			loadedSampleUrl = null;
			return;
		}
		try {
			sampleImage = await loadImage(url);
			loadedSampleUrl = url;
			calculateDisplayScale();
			drawCanvas();
		} catch (err) {
			console.warn('Failed to load sample image:', err);
			sampleImage = null;
			loadedSampleUrl = null;
		}
	}

	function calculateDisplayScale() {
		if (!sampleImage) return;
		const maxWidth = 600;
		displayScale = Math.min(1, maxWidth / sampleImage.width);
	}

	function drawCanvas() {
		if (!canvasEl || !sampleImage) return;

		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const scaledWidth = Math.floor(sampleImage.width * displayScale);
		const scaledHeight = Math.floor(sampleImage.height * displayScale);

		canvasEl.width = scaledWidth;
		canvasEl.height = scaledHeight;

		ctx.drawImage(sampleImage, 0, 0, scaledWidth, scaledHeight);

		const runeSize = (config._rune_size || 120) * displayScale;
		const runeColors = ['#DDA0DD', '#C084FC', '#A78BFA', '#818CF8', '#6366F1'];

		runeSlots.forEach((slot, i) => {
			const color = runeColors[i % runeColors.length];
			const x = slot.x * displayScale;
			const y = slot.y * displayScale;
			const isSelected = selectedSlotIndex === i;

			ctx.strokeStyle = color;
			ctx.lineWidth = isSelected ? 4 : 2;
			ctx.strokeRect(x, y, runeSize, runeSize);

			ctx.fillStyle = color;
			ctx.font = `bold ${14 * displayScale}px Arial`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(`R${i + 1}`, x + runeSize / 2, y + runeSize / 2);
		});

		// Draw text box preview
		if (config.text_box) {
			const tb = config.text_box;
			const tx = tb.x * displayScale;
			const ty = tb.y * displayScale;
			const tw = tb.width * displayScale;
			const th = tb.height * displayScale;
			const isTbSelected = textBoxSelected;

			ctx.strokeStyle = '#22d3ee';
			ctx.lineWidth = isTbSelected ? 4 : 2;
			ctx.setLineDash([6, 4]);
			ctx.strokeRect(tx, ty, tw, th);
			ctx.setLineDash([]);

			ctx.fillStyle = isTbSelected ? 'rgba(34, 211, 238, 0.2)' : 'rgba(34, 211, 238, 0.1)';
			ctx.fillRect(tx, ty, tw, th);

			// Render sample text at actual configured font size
			const sampleText = 'Collect 3 Unique Runes';
			const fontSize = tb.font_size * displayScale;
			const fontFamily = tb.font_family || 'Opsilon';
			ctx.fillStyle = tb.color || '#FFFFFF';
			ctx.font = `bold ${fontSize}px ${fontFamily}`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'top';

			// Simple word wrap
			const words = sampleText.split(' ');
			const lines: string[] = [];
			let currentLine = '';
			for (const word of words) {
				const testLine = currentLine ? `${currentLine} ${word}` : word;
				if (ctx.measureText(testLine).width > tw && currentLine) {
					lines.push(currentLine);
					currentLine = word;
				} else {
					currentLine = testLine;
				}
			}
			if (currentLine) lines.push(currentLine);

			const lineHeight = fontSize * 1.2;
			const totalTextHeight = lines.length * lineHeight;
			const startY = ty + (th - totalTextHeight) / 2;
			const centerX = tx + tw / 2;
			for (let li = 0; li < lines.length; li++) {
				ctx.fillText(lines[li], centerX, startY + li * lineHeight);
			}
		}

		// Draw special class icon slot
		if (config.special_class_icon_slot) {
			const sc = config.special_class_icon_slot;
			const scSize = specialClassIconSize * displayScale;
			const scx = sc.x * displayScale;
			const scy = sc.y * displayScale;
			const isScSelected = selectedKey === 'special_class';

			ctx.strokeStyle = '#f59e0b';
			ctx.lineWidth = isScSelected ? 4 : 2;
			ctx.strokeRect(scx, scy, scSize, scSize);

			ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
			ctx.fillRect(scx, scy, scSize, scSize);

			ctx.fillStyle = '#f59e0b';
			ctx.font = `bold ${14 * displayScale}px Arial`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('SC', scx + scSize / 2, scy + scSize / 2);
		}
	}

	function handleCanvasClick(event: MouseEvent) {
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;
		const rSize = config._rune_size || 120;

		// Check rune slots first
		for (let i = 0; i < runeSlots.length; i++) {
			const slot = runeSlots[i];
			if (realX >= slot.x && realX <= slot.x + rSize && realY >= slot.y && realY <= slot.y + rSize) {
				selectedKey = `rune:${i}`;
				draggingKey = `rune:${i}`;
				dragOffset = { x: realX - slot.x, y: realY - slot.y };
				drawCanvas();
				return;
			}
		}

		// Check special class icon slot
		if (config.special_class_icon_slot) {
			const sc = config.special_class_icon_slot;
			const scSize = specialClassIconSize;
			if (realX >= sc.x && realX <= sc.x + scSize && realY >= sc.y && realY <= sc.y + scSize) {
				selectedKey = 'special_class';
				draggingKey = 'special_class';
				dragOffset = { x: realX - sc.x, y: realY - sc.y };
				drawCanvas();
				return;
			}
		}

		// Check text box
		if (config.text_box) {
			const tb = config.text_box;
			if (realX >= tb.x && realX <= tb.x + tb.width && realY >= tb.y && realY <= tb.y + tb.height) {
				selectedKey = 'textbox';
				draggingKey = 'textbox';
				dragOffset = { x: realX - tb.x, y: realY - tb.y };
				drawCanvas();
				return;
			}
		}

		selectedKey = 'none';
		draggingKey = 'none';
		drawCanvas();
	}

	function handleCanvasDrag(event: MouseEvent) {
		if (draggingKey === 'none' || !sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;

		if (draggingKey.startsWith('rune:')) {
			const index = Number(draggingKey.slice(5));
			updateSlotPosition(index, {
				x: Math.max(0, Math.round(realX - dragOffset.x)),
				y: Math.max(0, Math.round(realY - dragOffset.y))
			});
		} else if (draggingKey === 'special_class') {
			updateSpecialClassSlot({
				x: Math.max(0, Math.round(realX - dragOffset.x)),
				y: Math.max(0, Math.round(realY - dragOffset.y))
			});
		} else if (draggingKey === 'textbox') {
			updateTextBox({
				x: Math.max(0, Math.round(realX - dragOffset.x)),
				y: Math.max(0, Math.round(realY - dragOffset.y))
			});
		}
	}

	function handleCanvasRelease() {
		draggingKey = 'none';
	}

	function handleCanvasRightClick(event: MouseEvent) {
		event.preventDefault();
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = Math.round((event.clientX - rect.left) / displayScale);
		const realY = Math.round((event.clientY - rect.top) / displayScale);

		addSlot({ x: realX, y: realY });
	}

	function addSlot(position?: { x: number; y: number }) {
		const offset = runeSlots.length * 30;
		const newSlot: IconSlot = position ?? { x: 50 + offset, y: 50 + offset };

		config = {
			...config,
			rune_slots: [...runeSlots, newSlot]
		};

		selectedKey = `rune:${runeSlots.length - 1}`;
		drawCanvas();
	}

	function removeSelectedSlot() {
		if (selectedSlotIndex === null) return;

		const newSlots = [...runeSlots];
		newSlots.splice(selectedSlotIndex, 1);

		config = {
			...config,
			rune_slots: newSlots
		};

		selectedKey = 'none';
		drawCanvas();
	}

	function updateSlotPosition(index: number, pos: { x: number; y: number }) {
		const newSlots = [...runeSlots];
		newSlots[index] = { ...newSlots[index], ...pos };

		config = {
			...config,
			rune_slots: newSlots
		};

		drawCanvas();
	}

	function selectSlot(index: number) {
		selectedKey = `rune:${index}`;
		drawCanvas();
	}

	async function persistConfig() {
		saveBackIconPlacementConfig(config);
		await saveBackIconPlacementConfigToDatabase(config);
	}

	async function handleSave() {
		await persistConfig();
		onSave(config);
	}

	async function handleGenerate() {
		await persistConfig();
		onGenerateAll?.();
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

	function applyJsonConfig() {
		try {
			const parsed = JSON.parse(jsonText) as BackIconPlacementConfig;
			if (typeof parsed._rune_size !== 'number') {
				throw new Error('Missing _rune_size');
			}
			config = parsed;
			jsonError = '';
			jsonEditorOpen = false;
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

	function toggleSpecialClassSlot() {
		if (config.special_class_icon_slot) {
			config = { ...config, special_class_icon_slot: null };
		} else {
			config = {
				...config,
				special_class_icon_slot: { x: 200, y: 200 },
				_special_class_icon_size: config._special_class_icon_size || 80
			};
		}
		drawCanvas();
	}

	function updateSpecialClassSlot(updates: Partial<IconSlot>) {
		if (!config.special_class_icon_slot) return;
		config = {
			...config,
			special_class_icon_slot: { ...config.special_class_icon_slot, ...updates }
		};
		drawCanvas();
	}

	function toggleTextBox() {
		if (config.text_box) {
			const { text_box: _, ...rest } = config;
			config = rest as BackIconPlacementConfig;
		} else {
			config = {
				...config,
				text_box: { x: 100, y: 100, width: 400, height: 150, font_size: 36, color: '#FFFFFF', font_family: 'Opsilon' }
			};
		}
		drawCanvas();
	}

	function updateTextBox(updates: Partial<TextBoxConfig>) {
		if (!config.text_box) return;
		config = {
			...config,
			text_box: { ...config.text_box, ...updates }
		};
		drawCanvas();
	}

	function resetToDefaults() {
		config = createDefaultBackConfig();
		jsonText = JSON.stringify(config, null, 2);
		jsonError = '';
		drawCanvas();
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" role="button" tabindex="0" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<header class="modal__header">
				<h2>Back Icon Placement Configuration</h2>
				<p class="modal__subtitle">Origin/class icons use front config positions. Configure rune icon placement below.</p>
				<button type="button" class="modal__close" onclick={onClose}>&#x2715;</button>
			</header>

			<div class="modal__body">
				<div class="config-layout">
					<!-- Left Panel: Controls -->
					<div class="controls-panel">
						<!-- Rune Slots -->
						<div class="control-group slot-section slot-section--rune">
							<label class="control-label control-label--rune">Rune Slots ({runeSlots.length})</label>
							<div class="slot-buttons">
								<button type="button" class="btn btn--sm" onclick={() => addSlot()}>
									Add
								</button>
								<button
									type="button"
									class="btn btn--sm btn--danger"
									onclick={removeSelectedSlot}
									disabled={selectedSlotIndex === null}
								>
									Remove
								</button>
							</div>
							<div class="slot-list">
								{#each runeSlots as slot, i}
									<button
										type="button"
										class={`slot-item slot-item--rune ${selectedSlotIndex === i ? 'selected' : ''}`}
										onclick={() => selectSlot(i)}
									>
										R{i + 1}: ({slot.x}, {slot.y})
									</button>
								{/each}
							</div>
						</div>

						<!-- Size Control -->
						<div class="control-group">
							<label class="control-label">Rune Size</label>
							<div class="size-inputs">
								<input
									type="number"
									value={config._rune_size}
									onchange={(e) => { config = { ...config, _rune_size: Number(e.currentTarget.value) }; drawCanvas(); }}
								/>
							</div>
						</div>

						<!-- Text Box Config -->
						<div class="control-group slot-section slot-section--text">
							<div class="text-box-header">
								<label class="control-label control-label--text">Text Box</label>
								<button type="button" class="btn btn--sm" onclick={toggleTextBox}>
									{textBoxEnabled ? 'Remove' : 'Add'}
								</button>
							</div>
							{#if config.text_box}
								<div class="text-box-fields">
									<div class="position-inputs">
										<label class="position-input">
											<span>X:</span>
											<input
												type="number"
												value={config.text_box.x}
												onchange={(e) => updateTextBox({ x: Number(e.currentTarget.value) })}
											/>
										</label>
										<label class="position-input">
											<span>Y:</span>
											<input
												type="number"
												value={config.text_box.y}
												onchange={(e) => updateTextBox({ y: Number(e.currentTarget.value) })}
											/>
										</label>
									</div>
									<div class="position-inputs">
										<label class="position-input">
											<span>W:</span>
											<input
												type="number"
												value={config.text_box.width}
												onchange={(e) => updateTextBox({ width: Number(e.currentTarget.value) })}
											/>
										</label>
										<label class="position-input">
											<span>H:</span>
											<input
												type="number"
												value={config.text_box.height}
												onchange={(e) => updateTextBox({ height: Number(e.currentTarget.value) })}
											/>
										</label>
									</div>
									<div class="position-inputs">
										<label class="position-input">
											<span>Size:</span>
											<input
												type="number"
												value={config.text_box.font_size}
												onchange={(e) => updateTextBox({ font_size: Number(e.currentTarget.value) })}
											/>
										</label>
										<label class="position-input">
											<span>Color:</span>
											<input
												type="color"
												value={config.text_box.color}
												onchange={(e) => updateTextBox({ color: e.currentTarget.value })}
											/>
										</label>
									</div>
									<div class="position-inputs">
										<label class="position-input">
											<span>Font:</span>
											<select
												value={config.text_box.font_family ?? 'Opsilon'}
												onchange={(e) => updateTextBox({ font_family: e.currentTarget.value as 'Opsilon' | 'Vincendo' })}
											>
												<option value="Opsilon">Opsilon</option>
												<option value="Vincendo">Vincendo</option>
											</select>
										</label>
									</div>
								</div>
							{/if}
						</div>

						<!-- Special Class Icon Slot -->
						<div class="control-group slot-section slot-section--special">
							<div class="text-box-header">
								<label class="control-label control-label--special">Special Class Icon</label>
								<button type="button" class="btn btn--sm" onclick={toggleSpecialClassSlot}>
									{specialClassSlotEnabled ? 'Remove' : 'Add'}
								</button>
							</div>
							{#if config.special_class_icon_slot}
								<div class="text-box-fields">
									<div class="position-inputs">
										<label class="position-input">
											<span>X:</span>
											<input
												type="number"
												value={config.special_class_icon_slot.x}
												onchange={(e) => updateSpecialClassSlot({ x: Number(e.currentTarget.value) })}
											/>
										</label>
										<label class="position-input">
											<span>Y:</span>
											<input
												type="number"
												value={config.special_class_icon_slot.y}
												onchange={(e) => updateSpecialClassSlot({ y: Number(e.currentTarget.value) })}
											/>
										</label>
									</div>
									<div class="position-inputs">
										<label class="position-input">
											<span>Size:</span>
											<input
												type="number"
												value={specialClassIconSize}
												onchange={(e) => { config = { ...config, _special_class_icon_size: Number(e.currentTarget.value) }; drawCanvas(); }}
											/>
										</label>
									</div>
								</div>
							{/if}
						</div>

						<!-- Selected Slot Position -->
						{#if selectedSlotIndex !== null && runeSlots[selectedSlotIndex]}
							<div class="control-group">
								<label class="control-label">Selected: R{selectedSlotIndex + 1}</label>
								<div class="position-inputs">
									<label class="position-input">
										<span>X:</span>
										<input
											type="number"
											value={runeSlots[selectedSlotIndex].x}
											onchange={(e) => updateSlotPosition(selectedSlotIndex!, { x: Number(e.currentTarget.value), y: runeSlots[selectedSlotIndex!].y })}
										/>
									</label>
									<label class="position-input">
										<span>Y:</span>
										<input
											type="number"
											value={runeSlots[selectedSlotIndex].y}
											onchange={(e) => updateSlotPosition(selectedSlotIndex!, { x: runeSlots[selectedSlotIndex!].x, y: Number(e.currentTarget.value) })}
										/>
									</label>
								</div>
							</div>
						{/if}

						<!-- JSON Editor -->
						<div class="control-group">
							<button
								type="button"
								class="json-toggle-btn"
								onclick={() => jsonEditorOpen ? closeJsonEditor() : openJsonEditor()}
							>
								<span class="json-toggle-icon">{jsonEditorOpen ? '▼' : '▶'}</span>
								JSON Config Editor
							</button>

							{#if jsonEditorOpen}
								<div class="json-editor">
									<div class="json-actions">
										<button type="button" class="btn btn--sm" onclick={copyJsonToClipboard}>
											Copy JSON
										</button>
										<button type="button" class="btn btn--sm btn--danger" onclick={resetToDefaults}>
											Reset to Defaults
										</button>
									</div>
									<textarea
										class="json-textarea"
										bind:value={jsonText}
										spellcheck="false"
										placeholder="Paste JSON config here..."
									></textarea>
									{#if jsonError}
										<p class="json-error">{jsonError}</p>
									{/if}
									<button type="button" class="btn btn--sm btn--primary" onclick={applyJsonConfig}>
										Apply JSON Config
									</button>
								</div>
							{/if}
						</div>
					</div>

					<!-- Right Panel: Canvas Preview -->
					<div class="preview-panel">
						<div class="preview-toolbar">
							<span class="preview-count">{getSampleOptions().length} reference image{getSampleOptions().length === 1 ? '' : 's'}</span>
							<button
								type="button"
								class="btn btn--sm btn--secondary"
								onclick={randomizeSampleImage}
								disabled={getSampleOptions().length <= 1}
							>
								Random Image
							</button>
						</div>
						{#if sampleImage}
							<canvas
								bind:this={canvasEl}
								class="preview-canvas"
								onmousedown={handleCanvasClick}
								onmousemove={handleCanvasDrag}
								onmouseup={handleCanvasRelease}
								onmouseleave={handleCanvasRelease}
								oncontextmenu={handleCanvasRightClick}
							></canvas>
							<p class="preview-hint">
								Left-click to select/drag rune slots. Right-click to add a new rune slot.
							</p>
						{:else}
							<div class="preview-placeholder">
								<p>No sample back side image available</p>
								<p class="preview-hint">Upload a back side base image to a spirit to see a preview.</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<footer class="modal__footer">
				<button type="button" class="btn btn--secondary" onclick={handleSave}>
					Save Configuration
				</button>
				{#if showGenerateActions}
					<button type="button" class="btn btn--primary" onclick={handleGenerate}>
						Generate All Back Prints with Icons
					</button>
				{/if}
			</footer>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.85);
		z-index: 1300;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.modal {
		background: rgba(15, 23, 42, 0.98);
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		width: 100%;
		max-width: 1100px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
	}

	.modal__header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.modal__header h2 {
		margin: 0;
		font-size: 1.25rem;
		color: #f8fafc;
	}

	.modal__subtitle {
		width: 100%;
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.modal__close {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		transition: all 0.15s ease;
	}

	.modal__close:hover {
		background: rgba(248, 113, 113, 0.2);
		color: #f87171;
	}

	.modal__body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.config-layout {
		display: grid;
		grid-template-columns: 300px 1fr;
		gap: 1.5rem;
	}

	.controls-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(148, 163, 184, 0.8);
	}

	.control-label--rune {
		color: #DDA0DD;
	}

	.slot-section {
		padding: 0.5rem;
		border-radius: 6px;
	}

	.slot-section--rune {
		background: rgba(221, 160, 221, 0.06);
		border: 1px solid rgba(221, 160, 221, 0.15);
	}

	.slot-section--text {
		background: rgba(34, 211, 238, 0.06);
		border: 1px solid rgba(34, 211, 238, 0.15);
	}

	.control-label--text {
		color: #22d3ee;
	}

	.slot-section--special {
		background: rgba(245, 158, 11, 0.06);
		border: 1px solid rgba(245, 158, 11, 0.15);
	}

	.control-label--special {
		color: #f59e0b;
	}

	.text-box-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.text-box-fields {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.25rem;
	}

	.text-box-fields select {
		padding: 0.4rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.text-box-fields input[type='color'] {
		width: 36px;
		height: 28px;
		padding: 0;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.slot-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 200px;
		overflow-y: auto;
	}

	.slot-item {
		padding: 0.4rem 0.6rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		color: #e2e8f0;
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.slot-item:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.slot-item.selected {
		background: rgba(99, 102, 241, 0.25);
		border-color: rgba(99, 102, 241, 0.5);
	}

	.slot-item--rune.selected {
		background: rgba(221, 160, 221, 0.2);
		border-color: rgba(221, 160, 221, 0.5);
	}

	.size-inputs,
	.position-inputs {
		display: flex;
		gap: 0.75rem;
	}

	.size-inputs input,
	.position-input input {
		width: 70px;
		padding: 0.4rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.position-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.position-input span {
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.preview-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.preview-toolbar {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.preview-count {
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.preview-canvas {
		background: #333;
		border-radius: 8px;
		cursor: crosshair;
		max-width: 100%;
	}

	.preview-hint {
		color: #94a3b8;
		font-size: 0.8rem;
		margin: 0;
	}

	.preview-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.2);
		color: #94a3b8;
		text-align: center;
		padding: 2rem;
	}

	.modal__footer {
		display: flex;
		justify-content: flex-end;
		gap: 1rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}

	.btn {
		padding: 0.6rem 1.25rem;
		border-radius: 8px;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.15s ease;
		border: none;
	}

	.btn--sm {
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
	}

	.btn--primary {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(139, 92, 246, 0.8));
		color: white;
	}

	.btn--primary:hover {
		background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(139, 92, 246, 0.9));
	}

	.btn--secondary {
		background: rgba(30, 41, 59, 0.8);
		color: #e2e8f0;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.btn--secondary:hover {
		background: rgba(30, 41, 59, 1);
	}

	.btn--danger {
		background: rgba(239, 68, 68, 0.2);
		color: #f87171;
		border: 1px solid rgba(239, 68, 68, 0.3);
	}

	.btn--danger:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.3);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* JSON Editor Styles */
	.json-toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.6rem 0.75rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #e2e8f0;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.json-toggle-btn:hover {
		background: rgba(30, 41, 59, 0.8);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.json-toggle-icon {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.json-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.json-actions {
		display: flex;
		gap: 0.5rem;
	}

	.json-textarea {
		width: 100%;
		min-height: 200px;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #a5f3fc;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.75rem;
		line-height: 1.5;
		resize: vertical;
	}

	.json-textarea:focus {
		outline: none;
		border-color: rgba(99, 102, 241, 0.5);
	}

	.json-error {
		margin: 0;
		padding: 0.5rem;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 4px;
		color: #f87171;
		font-size: 0.8rem;
	}

	@media (max-width: 768px) {
		.config-layout {
			grid-template-columns: 1fr;
		}
	}
</style>
