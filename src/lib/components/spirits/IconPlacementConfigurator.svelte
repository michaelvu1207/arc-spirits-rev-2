<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FRAME_TIERS,
		type FrameTier,
		type FrontIconPlacementConfig,
		type FrontIconTierConfig,
		type IconSlot,
		type IconColor,
		loadFrontIconPlacementConfig,
		saveFrontIconPlacementConfig,
		loadFrontIconPlacementConfigFromDatabase,
		saveFrontIconPlacementConfigToDatabase,
		createDefaultConfig
	} from '$lib/generators/spirits/spiritIconPlacer';
	import { loadImage } from '$lib/generators/shared/canvas';

	const TIER_DISPLAY_NAMES: Record<FrameTier, string> = {
		spirit_world: 'Spirit World',
		abyss: 'Abyss',
		abyss_void_astral: 'Abyss (Void/Astral)',
		arcane: 'Arcane',
		fairy: 'Fairy',
		human_enclave: 'Human Enclave',
		royal_family: 'Royal Family'
	};

	type SlotGroup = 'origin' | 'class';

	interface Props {
		isOpen: boolean;
		sampleImageUrls: Record<FrameTier, string | null>;
		sampleImageUrlOptions?: Record<FrameTier, string[]>;
		onClose: () => void;
		onSave: (config: FrontIconPlacementConfig) => void;
		onGenerateAll?: () => void;
		onGenerateTier?: (tier: FrameTier) => void;
		showGenerateActions?: boolean;
	}

	let {
		isOpen,
		sampleImageUrls,
		sampleImageUrlOptions,
		onClose,
		onSave,
		onGenerateAll,
		onGenerateTier,
		showGenerateActions = true
	}: Props = $props();

	let config: FrontIconPlacementConfig = $state(createDefaultConfig());
	let currentTier: FrameTier = $state('spirit_world');
	let selectedGroup: SlotGroup = $state('origin');
	let selectedSlotIndex: number | null = $state(null);

	let jsonEditorOpen = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let sampleImage: HTMLImageElement | null = $state(null);
	let selectedSampleUrl: string | null = $state(null);
	let loadedSampleUrl: string | null = $state(null);
	let displayScale = $state(1);
	let draggingSlot: { group: SlotGroup; index: number } | null = $state(null);
	let dragOffset = $state({ x: 0, y: 0 });

	function getTierConfig(): FrontIconTierConfig | null {
		const tc = config[currentTier];
		if (!tc || typeof tc === 'number') return null;
		return tc;
	}

	let originSlots = $derived.by(() => {
		const tc = getTierConfig();
		return tc?.origin_slots ?? [];
	});

	let classSlots = $derived.by(() => {
		const tc = getTierConfig();
		return tc?.class_slots ?? [];
	});

	let activeSlots = $derived(selectedGroup === 'origin' ? originSlots : classSlots);

	let currentSize = $derived(config._icon_size);
	let classIconColor = $derived.by(() => {
		const tc = getTierConfig();
		return tc?.class_icon_color ?? 'dark';
	});

	onMount(() => {
		config = loadFrontIconPlacementConfig();
		loadFrontIconPlacementConfigFromDatabase().then((storedConfig) => {
			config = storedConfig;
		});
	});

	$effect(() => {
		if (isOpen && currentTier) {
			const url = getCurrentSampleUrl();
			if (url !== loadedSampleUrl) {
				loadSampleImageUrl(url);
			}
		}
	});

	$effect(() => {
		if (sampleImage && canvasEl) {
			drawCanvas();
		}
	});

	function getSampleOptions(tier: FrameTier): string[] {
		const options = sampleImageUrlOptions?.[tier] ?? [];
		const fallback = sampleImageUrls[tier];
		return Array.from(new Set(fallback ? [fallback, ...options] : options));
	}

	function getCurrentSampleUrl(): string | null {
		const options = getSampleOptions(currentTier);
		if (selectedSampleUrl && options.includes(selectedSampleUrl)) {
			return selectedSampleUrl;
		}
		return options[0] ?? null;
	}

	function randomizeSampleImage() {
		const options = getSampleOptions(currentTier);
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

	async function loadSampleImageUrl(url: string | null) {
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

		const size = currentSize * displayScale;
		const originColors = ['#FF6B6B', '#FF9F43'];
		const classColors = ['#4ECDC4', '#45B7D1', '#96CEB4'];

		originSlots.forEach((slot, i) => {
			const color = originColors[i % originColors.length];
			const x = slot.x * displayScale;
			const y = slot.y * displayScale;
			const isSelected = selectedGroup === 'origin' && selectedSlotIndex === i;

			ctx.strokeStyle = color;
			ctx.lineWidth = isSelected ? 4 : 2;
			ctx.strokeRect(x, y, size, size);

			ctx.fillStyle = color;
			ctx.font = `bold ${14 * displayScale}px Arial`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(`O${i + 1}`, x + size / 2, y + size / 2);
		});

		classSlots.forEach((slot, i) => {
			const color = classColors[i % classColors.length];
			const x = slot.x * displayScale;
			const y = slot.y * displayScale;
			const isSelected = selectedGroup === 'class' && selectedSlotIndex === i;

			ctx.strokeStyle = color;
			ctx.lineWidth = isSelected ? 4 : 2;
			ctx.strokeRect(x, y, size, size);

			ctx.fillStyle = color;
			ctx.font = `bold ${14 * displayScale}px Arial`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(`C${i + 1}`, x + size / 2, y + size / 2);
		});
	}

	function handleCanvasClick(event: MouseEvent) {
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;
		const size = currentSize;

		// Check origin slots first
		for (let i = 0; i < originSlots.length; i++) {
			const slot = originSlots[i];
			if (realX >= slot.x && realX <= slot.x + size && realY >= slot.y && realY <= slot.y + size) {
				selectedGroup = 'origin';
				selectedSlotIndex = i;
				draggingSlot = { group: 'origin', index: i };
				dragOffset = { x: realX - slot.x, y: realY - slot.y };
				drawCanvas();
				return;
			}
		}

		// Check class slots
		for (let i = 0; i < classSlots.length; i++) {
			const slot = classSlots[i];
			if (realX >= slot.x && realX <= slot.x + size && realY >= slot.y && realY <= slot.y + size) {
				selectedGroup = 'class';
				selectedSlotIndex = i;
				draggingSlot = { group: 'class', index: i };
				dragOffset = { x: realX - slot.x, y: realY - slot.y };
				drawCanvas();
				return;
			}
		}

		selectedSlotIndex = null;
		draggingSlot = null;
		drawCanvas();
	}

	function handleCanvasDrag(event: MouseEvent) {
		if (!draggingSlot || !sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;

		updateSlotPosition(draggingSlot.group, draggingSlot.index, {
			x: Math.max(0, Math.round(realX - dragOffset.x)),
			y: Math.max(0, Math.round(realY - dragOffset.y))
		});
	}

	function handleCanvasRelease() {
		draggingSlot = null;
	}

	function handleCanvasRightClick(event: MouseEvent) {
		event.preventDefault();
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = Math.round((event.clientX - rect.left) / displayScale);
		const realY = Math.round((event.clientY - rect.top) / displayScale);

		addSlot(selectedGroup, { x: realX, y: realY });
	}

	function addSlot(group: SlotGroup, position?: { x: number; y: number }) {
		const tc = getTierConfig();
		if (!tc) return;

		const slots = group === 'origin' ? tc.origin_slots : tc.class_slots;
		const offset = slots.length * 30;
		const newSlot: IconSlot = position ?? { x: 50 + offset, y: 50 + offset };
		const key = group === 'origin' ? 'origin_slots' : 'class_slots';

		config = {
			...config,
			[currentTier]: {
				...tc,
				[key]: [...slots, newSlot]
			}
		};

		selectedGroup = group;
		selectedSlotIndex = slots.length;
		drawCanvas();
	}

	function removeSelectedSlot() {
		if (selectedSlotIndex === null) return;

		const tc = getTierConfig();
		if (!tc) return;

		const key = selectedGroup === 'origin' ? 'origin_slots' : 'class_slots';
		const slots = selectedGroup === 'origin' ? tc.origin_slots : tc.class_slots;
		const newSlots = [...slots];
		newSlots.splice(selectedSlotIndex, 1);

		config = {
			...config,
			[currentTier]: {
				...tc,
				[key]: newSlots
			}
		};

		selectedSlotIndex = null;
		drawCanvas();
	}

	function updateSlotPosition(group: SlotGroup, index: number, pos: { x: number; y: number }) {
		const tc = getTierConfig();
		if (!tc) return;

		const key = group === 'origin' ? 'origin_slots' : 'class_slots';
		const slots = group === 'origin' ? tc.origin_slots : tc.class_slots;
		const newSlots = [...slots];
		newSlots[index] = { ...newSlots[index], ...pos };

		config = {
			...config,
			[currentTier]: {
				...tc,
				[key]: newSlots
			}
		};

		drawCanvas();
	}

	function handleSizeChange(value: number) {
		config = { ...config, _icon_size: value };
		drawCanvas();
	}

	function handleClassIconColorChange(color: IconColor) {
		const tc = getTierConfig();
		if (!tc) return;
		config = {
			...config,
			[currentTier]: { ...tc, class_icon_color: color }
		};
	}

	function selectSlot(group: SlotGroup, index: number) {
		selectedGroup = group;
		selectedSlotIndex = index;
		drawCanvas();
	}

	function copyFromTier(sourceTier: FrameTier) {
		const sourceConfig = config[sourceTier];
		if (typeof sourceConfig === 'number' || !sourceConfig) return;

		config = {
			...config,
			[currentTier]: { ...sourceConfig }
		};
		drawCanvas();
	}

	async function persistConfig() {
		saveFrontIconPlacementConfig(config);
		await saveFrontIconPlacementConfigToDatabase(config);
	}

	async function handleSave() {
		await persistConfig();
		onSave(config);
	}

	async function handleGenerate() {
		await persistConfig();
		onGenerateAll?.();
	}

	async function handleGenerateTier() {
		await persistConfig();
		onGenerateTier?.(currentTier);
	}

	function handleTierChange(tier: FrameTier) {
		currentTier = tier;
		selectedSampleUrl = null;
		selectedSlotIndex = null;
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
			const parsed = JSON.parse(jsonText) as FrontIconPlacementConfig;
			if (typeof parsed._icon_size !== 'number') {
				throw new Error('Missing _icon_size');
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

	function resetToDefaults() {
		config = createDefaultConfig();
		jsonText = JSON.stringify(config, null, 2);
		jsonError = '';
		drawCanvas();
	}
</script>

{#if isOpen}
	<div class="modal-backdrop" role="button" tabindex="0" onclick={onClose} onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="modal" role="dialog" aria-modal="true" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<header class="modal__header">
				<h2>Front Icon Placement Configuration</h2>
				<button type="button" class="modal__close" onclick={onClose}>&#x2715;</button>
			</header>

			<div class="modal__body">
				<div class="config-layout">
					<!-- Left Panel: Controls -->
					<div class="controls-panel">
						<!-- Tier Selector -->
						<div class="control-group">
							<label class="control-label">Frame Tier</label>
							<select
								class="control-select"
								value={currentTier}
								onchange={(e) => handleTierChange(e.currentTarget.value as FrameTier)}
							>
								{#each FRAME_TIERS as tier}
									<option value={tier}>{TIER_DISPLAY_NAMES[tier]}</option>
								{/each}
							</select>
						</div>

						<!-- Origin Slots -->
						<div class="control-group slot-section slot-section--origin">
							<label class="control-label control-label--origin">Origin Slots ({originSlots.length})</label>
							<div class="slot-buttons">
								<button type="button" class="btn btn--sm" onclick={() => addSlot('origin')}>
									Add
								</button>
								<button
									type="button"
									class="btn btn--sm btn--danger"
									onclick={removeSelectedSlot}
									disabled={selectedGroup !== 'origin' || selectedSlotIndex === null}
								>
									Remove
								</button>
							</div>
							<div class="slot-list">
								{#each originSlots as slot, i}
									<button
										type="button"
										class={`slot-item slot-item--origin ${selectedGroup === 'origin' && selectedSlotIndex === i ? 'selected' : ''}`}
										onclick={() => selectSlot('origin', i)}
									>
										O{i + 1}: ({slot.x}, {slot.y})
									</button>
								{/each}
							</div>
						</div>

						<!-- Class Slots -->
						<div class="control-group slot-section slot-section--class">
							<label class="control-label control-label--class">Class Slots ({classSlots.length})</label>
							<div class="slot-buttons">
								<button type="button" class="btn btn--sm" onclick={() => addSlot('class')}>
									Add
								</button>
								<button
									type="button"
									class="btn btn--sm btn--danger"
									onclick={removeSelectedSlot}
									disabled={selectedGroup !== 'class' || selectedSlotIndex === null}
								>
									Remove
								</button>
							</div>
							<div class="color-toggle">
								<span class="color-toggle-label">Color:</span>
								<button
									type="button"
									class={`color-btn ${classIconColor === 'dark' ? 'color-btn--active' : ''}`}
									onclick={() => handleClassIconColorChange('dark')}
								>
									<span class="color-swatch color-swatch--dark"></span>
									Dark
								</button>
								<button
									type="button"
									class={`color-btn ${classIconColor === 'white' ? 'color-btn--active' : ''}`}
									onclick={() => handleClassIconColorChange('white')}
								>
									<span class="color-swatch color-swatch--white"></span>
									White
								</button>
							</div>
							<div class="slot-list">
								{#each classSlots as slot, i}
									<button
										type="button"
										class={`slot-item slot-item--class ${selectedGroup === 'class' && selectedSlotIndex === i ? 'selected' : ''}`}
										onclick={() => selectSlot('class', i)}
									>
										C{i + 1}: ({slot.x}, {slot.y})
									</button>
								{/each}
							</div>
						</div>

						<!-- Size Controls -->
						<div class="control-group">
							<label class="control-label">Icon Size</label>
							<div class="size-inputs">
								<label class="size-input">
									<span>Size:</span>
									<input
										type="number"
										value={config._icon_size}
										onchange={(e) => handleSizeChange(Number(e.currentTarget.value))}
									/>
								</label>
							</div>
						</div>

						<!-- Selected Slot Position -->
						{#if selectedSlotIndex !== null && activeSlots[selectedSlotIndex]}
							<div class="control-group">
								<label class="control-label">Selected: {selectedGroup === 'origin' ? 'O' : 'C'}{selectedSlotIndex + 1}</label>
								<div class="position-inputs">
									<label class="position-input">
										<span>X:</span>
										<input
											type="number"
											value={activeSlots[selectedSlotIndex].x}
											onchange={(e) => updateSlotPosition(selectedGroup, selectedSlotIndex!, { x: Number(e.currentTarget.value), y: activeSlots[selectedSlotIndex!].y })}
										/>
									</label>
									<label class="position-input">
										<span>Y:</span>
										<input
											type="number"
											value={activeSlots[selectedSlotIndex].y}
											onchange={(e) => updateSlotPosition(selectedGroup, selectedSlotIndex!, { x: activeSlots[selectedSlotIndex!].x, y: Number(e.currentTarget.value) })}
										/>
									</label>
								</div>
							</div>
						{/if}

						<!-- Copy From Tier -->
						<div class="control-group">
							<label class="control-label">Copy From</label>
							<div class="copy-controls">
								<select class="control-select" id="copy-source">
									{#each FRAME_TIERS as tier}
										<option value={tier}>{TIER_DISPLAY_NAMES[tier]}</option>
									{/each}
								</select>
								<button
									type="button"
									class="btn btn--sm"
									onclick={() => {
										const select = document.getElementById('copy-source') as HTMLSelectElement;
										copyFromTier(select.value as FrameTier);
									}}
								>
									Copy Here
								</button>
							</div>
						</div>

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
							<span class="preview-count">{getSampleOptions(currentTier).length} reference image{getSampleOptions(currentTier).length === 1 ? '' : 's'}</span>
							<button
								type="button"
								class="btn btn--sm btn--secondary"
								onclick={randomizeSampleImage}
								disabled={getSampleOptions(currentTier).length <= 1}
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
								Left-click to select/drag slots. Right-click to add slot to active group ({selectedGroup}).
							</p>
						{:else}
							<div class="preview-placeholder">
								<p>No sample image available for "{TIER_DISPLAY_NAMES[currentTier]}"</p>
								<p class="preview-hint">Upload a game print image to a spirit in this tier to see a preview.</p>
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
					<button type="button" class="btn btn--secondary" onclick={handleGenerateTier}>
						Generate {TIER_DISPLAY_NAMES[currentTier]} Only
					</button>
					<button type="button" class="btn btn--primary" onclick={handleGenerate}>
						Generate All Game Prints with Icons
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

	.control-label--origin {
		color: #FF6B6B;
	}

	.control-label--class {
		color: #4ECDC4;
	}

	.control-select {
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.slot-section {
		padding: 0.5rem;
		border-radius: 6px;
	}

	.slot-section--origin {
		background: rgba(255, 107, 107, 0.06);
		border: 1px solid rgba(255, 107, 107, 0.15);
	}

	.slot-section--class {
		background: rgba(78, 205, 196, 0.06);
		border: 1px solid rgba(78, 205, 196, 0.15);
	}

	.slot-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 120px;
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

	.slot-item--origin.selected {
		background: rgba(255, 107, 107, 0.2);
		border-color: rgba(255, 107, 107, 0.5);
	}

	.slot-item--class.selected {
		background: rgba(78, 205, 196, 0.2);
		border-color: rgba(78, 205, 196, 0.5);
	}

	.size-inputs,
	.position-inputs {
		display: flex;
		gap: 0.75rem;
	}

	.size-input,
	.position-input {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.size-input span,
	.position-input span {
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.size-input input,
	.position-input input {
		width: 70px;
		padding: 0.4rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.85rem;
	}

	.color-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.color-toggle-label {
		font-size: 0.75rem;
		color: #94a3b8;
		margin-right: 0.25rem;
	}

	.color-btn {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.5rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		color: #94a3b8;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.color-btn:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.color-btn--active {
		background: rgba(78, 205, 196, 0.15);
		border-color: rgba(78, 205, 196, 0.4);
		color: #e2e8f0;
	}

	.color-swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 2px;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.color-swatch--dark {
		background: #333;
	}

	.color-swatch--white {
		background: #fff;
	}

	.copy-controls {
		display: flex;
		gap: 0.5rem;
	}

	.copy-controls select {
		flex: 1;
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
