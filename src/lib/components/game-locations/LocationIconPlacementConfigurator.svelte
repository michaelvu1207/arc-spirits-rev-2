<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createDefaultLocationIconConfig,
		loadLocationIconPlacementConfig,
		saveLocationIconPlacementConfig,
		type IconSlot,
		type LocationIconPlacementConfig,
		type LocationRowPlacement
	} from '$lib/generators/locations/locationIconPlacer';
	import { loadImage } from '$lib/generators/shared/canvas';

	interface SampleLocation {
		id: string;
		name: string;
		backgroundUrl: string | null;
	}

	interface Props {
		isOpen: boolean;
		sampleLocations: SampleLocation[];
		onClose: () => void;
		onSave: (config: LocationIconPlacementConfig) => void;
		onGenerateAll: () => void;
	}

	let { isOpen, sampleLocations, onClose, onSave, onGenerateAll }: Props = $props();

	let config: LocationIconPlacementConfig = $state(createDefaultLocationIconConfig());

	let selectedSampleId = $state<string>('');
	let currentRowIndex = $state(0);
	let currentSlotType = $state<'gain_slots' | 'trade_cost_slots' | 'trade_gain_slots'>('gain_slots');
	let selectedSlotIndex: number | null = $state(null);

	let jsonEditorOpen = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let sampleImage: HTMLImageElement | null = $state(null);
	let displayScale = $state(1);
	let draggingSlot: number | null = $state(null);
	let dragOffset = $state({ x: 0, y: 0 });

	const sampleUrl = $derived.by(() => {
		const explicit = sampleLocations.find((l) => l.id === selectedSampleId);
		if (explicit?.backgroundUrl) return explicit.backgroundUrl;
		return sampleLocations.find((l) => l.backgroundUrl)?.backgroundUrl ?? null;
	});

	let currentSlots = $derived.by(() => {
		const row = config.rows[currentRowIndex];
		return row ? (row[currentSlotType] ?? []) : [];
	});

	onMount(() => {
		config = loadLocationIconPlacementConfig();
		selectedSampleId = sampleLocations[0]?.id ?? '';
	});

	$effect(() => {
		if (isOpen) {
			loadSampleImage();
		}
	});

	$effect(() => {
		if (sampleImage && canvasEl) {
			drawCanvas();
		}
	});

	async function loadSampleImage() {
		if (!sampleUrl) {
			sampleImage = null;
			return;
		}

		try {
			sampleImage = await loadImage(sampleUrl);
			calculateDisplayScale();
			drawCanvas();
		} catch (err) {
			console.warn('Failed to load sample location image:', err);
			sampleImage = null;
		}
	}

	function calculateDisplayScale() {
		if (!sampleImage) return;
		const maxWidth = 700;
		displayScale = Math.min(1, maxWidth / sampleImage.width);
	}

	function slotColors() {
		switch (currentSlotType) {
			case 'trade_cost_slots':
				return ['#f97316', '#fb7185', '#f59e0b', '#fca5a5', '#fdba74'];
			case 'trade_gain_slots':
				return ['#22c55e', '#10b981', '#34d399', '#86efac', '#4ade80'];
			case 'gain_slots':
			default:
				return ['#60a5fa', '#a78bfa', '#38bdf8', '#93c5fd', '#818cf8'];
		}
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

		const size = (config._icon_size || 80) * displayScale;
		const colors = slotColors();

		currentSlots.forEach((slot, i) => {
			const color = colors[i % colors.length];
			const x = slot.x * displayScale;
			const y = slot.y * displayScale;

			ctx.strokeStyle = color;
			ctx.lineWidth = selectedSlotIndex === i ? 4 : 2;
			ctx.strokeRect(x, y, size, size);

			ctx.fillStyle = color;
			ctx.font = `bold ${14 * displayScale}px Arial`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(String(i + 1), x + size / 2, y + size / 2);
		});
	}

	function handleCanvasClick(event: MouseEvent) {
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;
		const size = config._icon_size || 80;

		for (let i = 0; i < currentSlots.length; i++) {
			const slot = currentSlots[i];
			if (realX >= slot.x && realX <= slot.x + size && realY >= slot.y && realY <= slot.y + size) {
				selectedSlotIndex = i;
				draggingSlot = i;
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
		if (draggingSlot === null || !sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;

		updateSlotPosition(draggingSlot, {
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

		addSlot({ x: realX, y: realY });
	}

	function ensureRow(index: number): LocationRowPlacement {
		const existing = config.rows[index];
		if (existing) return existing;
		const y = 40 + index * 140;
		const gain_slots = Array.from({ length: 5 }, (_, i) => ({ x: 40 + i * 90, y }));
		const trade_cost_slots = Array.from({ length: 5 }, (_, i) => ({ x: 40 + i * 90, y }));
		const trade_gain_slots = Array.from({ length: 5 }, (_, i) => ({ x: 520 + i * 90, y }));
		return { gain_slots, trade_cost_slots, trade_gain_slots };
	}

	function addRow() {
		const nextIndex = config.rows.length;
		config = { ...config, rows: [...config.rows, ensureRow(nextIndex)] };
		currentRowIndex = nextIndex;
		selectedSlotIndex = null;
		drawCanvas();
	}

	function removeRow(index: number) {
		if (config.rows.length <= 1) return;
		const nextRows = [...config.rows];
		nextRows.splice(index, 1);
		config = { ...config, rows: nextRows };
		currentRowIndex = Math.max(0, Math.min(currentRowIndex, config.rows.length - 1));
		selectedSlotIndex = null;
		drawCanvas();
	}

	function copyFromRow(sourceIndex: number) {
		const source = config.rows[sourceIndex];
		if (!source) return;
		const nextRows = [...config.rows];
		nextRows[currentRowIndex] = JSON.parse(JSON.stringify(source)) as LocationRowPlacement;
		config = { ...config, rows: nextRows };
		selectedSlotIndex = null;
		drawCanvas();
	}

	function addSlot(position?: { x: number; y: number }) {
		const row = ensureRow(currentRowIndex);
		const slots = row[currentSlotType] ?? [];
		const offset = slots.length * 30;
		const newSlot: IconSlot = position ?? { x: 40 + offset, y: 40 + offset };

		const nextRow: LocationRowPlacement = { ...row, [currentSlotType]: [...slots, newSlot] } as any;
		const nextRows = [...config.rows];
		nextRows[currentRowIndex] = nextRow;
		config = { ...config, rows: nextRows };

		selectedSlotIndex = slots.length;
		drawCanvas();
	}

	function removeSelectedSlot() {
		if (selectedSlotIndex === null) return;
		const row = ensureRow(currentRowIndex);
		const slots = [...(row[currentSlotType] ?? [])];
		slots.splice(selectedSlotIndex, 1);

		const nextRow: LocationRowPlacement = { ...row, [currentSlotType]: slots } as any;
		const nextRows = [...config.rows];
		nextRows[currentRowIndex] = nextRow;
		config = { ...config, rows: nextRows };

		selectedSlotIndex = null;
		drawCanvas();
	}

	function updateSlotPosition(index: number, pos: { x: number; y: number }) {
		const row = ensureRow(currentRowIndex);
		const slots = [...(row[currentSlotType] ?? [])];
		slots[index] = { ...slots[index], ...pos };

		const nextRow: LocationRowPlacement = { ...row, [currentSlotType]: slots } as any;
		const nextRows = [...config.rows];
		nextRows[currentRowIndex] = nextRow;
		config = { ...config, rows: nextRows };
		drawCanvas();
	}

	function handleSizeChange(value: number) {
		config = { ...config, _icon_size: value };
		drawCanvas();
	}

	function handleSave() {
		saveLocationIconPlacementConfig(config);
		onSave(config);
	}

	function handleGenerate() {
		saveLocationIconPlacementConfig(config);
		onGenerateAll();
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
			const parsed = JSON.parse(jsonText) as LocationIconPlacementConfig;
			if (!parsed || typeof parsed._icon_size !== 'number' || !Array.isArray(parsed.rows)) {
				throw new Error('Invalid config shape');
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
</script>

{#if isOpen}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
	>
		<div
			class="modal"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<header class="modal__header">
				<h2>Location Icon Placement</h2>
				<button type="button" class="modal__close" onclick={onClose}>✕</button>
			</header>

			<div class="modal__body">
				<div class="config-layout">
					<div class="controls-panel">
						<div class="control-group">
							<label class="control-label">Sample Location</label>
							<select class="control-select" bind:value={selectedSampleId} onchange={loadSampleImage}>
								{#each sampleLocations as loc (loc.id)}
									<option value={loc.id}>{loc.name}</option>
								{/each}
							</select>
						</div>

						<div class="control-group">
							<label class="control-label">Row</label>
							<div class="row-controls">
								<select
									class="control-select"
									value={String(currentRowIndex)}
									onchange={(e) => {
										currentRowIndex = Number((e.currentTarget as HTMLSelectElement).value);
										selectedSlotIndex = null;
										drawCanvas();
									}}
								>
									{#each config.rows as _, idx (idx)}
										<option value={String(idx)}>Reward row {idx + 1}</option>
									{/each}
								</select>
								<button type="button" class="btn btn--sm" onclick={addRow}>+ Row</button>
								<button
									type="button"
									class="btn btn--sm btn--danger"
									onclick={() => removeRow(currentRowIndex)}
									disabled={config.rows.length <= 1}
								>
									− Row
								</button>
							</div>
						</div>

						<div class="control-group">
							<label class="control-label">Slot Type</label>
							<div class="slot-type-buttons">
								<button
									type="button"
									class={`slot-type-btn ${currentSlotType === 'gain_slots' ? 'active' : ''}`}
									onclick={() => {
										currentSlotType = 'gain_slots';
										selectedSlotIndex = null;
										drawCanvas();
									}}
								>
									Gain
								</button>
								<button
									type="button"
									class={`slot-type-btn ${currentSlotType === 'trade_cost_slots' ? 'active' : ''}`}
									onclick={() => {
										currentSlotType = 'trade_cost_slots';
										selectedSlotIndex = null;
										drawCanvas();
									}}
								>
									Trade: Spend
								</button>
								<button
									type="button"
									class={`slot-type-btn ${currentSlotType === 'trade_gain_slots' ? 'active' : ''}`}
									onclick={() => {
										currentSlotType = 'trade_gain_slots';
										selectedSlotIndex = null;
										drawCanvas();
									}}
								>
									Trade: Gain
								</button>
							</div>
						</div>

						<div class="control-group">
							<label class="control-label">Slots ({currentSlots.length})</label>
							<div class="slot-buttons">
								<button type="button" class="btn btn--sm" onclick={() => addSlot()}>
									Add Slot
								</button>
								<button
									type="button"
									class="btn btn--sm btn--danger"
									onclick={removeSelectedSlot}
									disabled={selectedSlotIndex === null}
								>
									Remove Selected
								</button>
							</div>
						</div>

						<div class="slot-list">
							{#each currentSlots as slot, i (i)}
								<button
									type="button"
									class={`slot-item ${selectedSlotIndex === i ? 'selected' : ''}`}
									onclick={() => {
										selectedSlotIndex = i;
										drawCanvas();
									}}
								>
									Slot {i + 1}: ({slot.x}, {slot.y})
								</button>
							{/each}
						</div>

						<div class="control-group">
							<label class="control-label">Icon Size</label>
							<input
								class="control-input"
								type="number"
								value={config._icon_size}
								onchange={(e) => handleSizeChange(Number((e.currentTarget as HTMLInputElement).value))}
							/>
						</div>

						{#if selectedSlotIndex !== null && currentSlots[selectedSlotIndex]}
							<div class="control-group">
								<label class="control-label">Selected Position</label>
								<div class="position-inputs">
									<label class="position-input">
										<span>X:</span>
										<input
											type="number"
											value={currentSlots[selectedSlotIndex].x}
											onchange={(e) =>
												updateSlotPosition(selectedSlotIndex!, {
													x: Number((e.currentTarget as HTMLInputElement).value),
													y: currentSlots[selectedSlotIndex!].y
												})}
										/>
									</label>
									<label class="position-input">
										<span>Y:</span>
										<input
											type="number"
											value={currentSlots[selectedSlotIndex].y}
											onchange={(e) =>
												updateSlotPosition(selectedSlotIndex!, {
													x: currentSlots[selectedSlotIndex!].x,
													y: Number((e.currentTarget as HTMLInputElement).value)
												})}
										/>
									</label>
								</div>
							</div>
						{/if}

						<div class="control-group">
							<label class="control-label">Copy From Row</label>
							<div class="copy-controls">
								<select class="control-select" id="copy-row-source">
									{#each config.rows as _, idx (idx)}
										<option value={String(idx)}>Reward row {idx + 1}</option>
									{/each}
								</select>
								<button
									type="button"
									class="btn btn--sm"
									onclick={() => {
										const select = document.getElementById('copy-row-source') as HTMLSelectElement | null;
										if (!select) return;
										copyFromRow(Number(select.value));
									}}
								>
									Copy Here
								</button>
							</div>
						</div>

						<div class="control-group">
							<button
								type="button"
								class="json-toggle-btn"
								onclick={() => (jsonEditorOpen ? closeJsonEditor() : openJsonEditor())}
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
										<button
											type="button"
											class="btn btn--sm btn--danger"
											onclick={() => {
												config = createDefaultLocationIconConfig();
												drawCanvas();
											}}
										>
											Reset
										</button>
									</div>
									<textarea class="json-textarea" bind:value={jsonText} spellcheck="false"></textarea>
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

					<div class="preview-panel">
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
							<p class="preview-hint">Left-click to select/drag slots. Right-click to add.</p>
						{:else}
							<div class="preview-placeholder">
								<p>No sample location background available.</p>
								<p class="preview-hint">Upload a background image to at least one location to configure placement.</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<footer class="modal__footer">
				<button type="button" class="btn btn--secondary" onclick={handleSave}>
					Save Configuration
				</button>
				<button type="button" class="btn btn--primary" onclick={handleGenerate}>
					Generate All Location Images with Icons
				</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.85);
		z-index: 1400;
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
		max-width: 1200px;
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
		font-size: 1.1rem;
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
		padding: 1.25rem;
	}

	.modal__footer {
		padding: 1rem 1.5rem;
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}

	.config-layout {
		display: grid;
		grid-template-columns: 320px 1fr;
		gap: 1.25rem;
	}

	.controls-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
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

	.control-select,
	.control-input {
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.row-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.slot-type-buttons {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.5rem;
	}

	.slot-type-btn {
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #94a3b8;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.15s ease;
		text-align: left;
	}

	.slot-type-btn:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.slot-type-btn.active {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.5);
		color: #f8fafc;
	}

	.slot-buttons {
		display: flex;
		gap: 0.5rem;
	}

	.slot-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 180px;
		overflow-y: auto;
	}

	.slot-item {
		padding: 0.5rem 0.75rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		color: #e2e8f0;
		font-size: 0.85rem;
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

	.position-inputs {
		display: flex;
		gap: 0.5rem;
	}

	.position-input {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
	}

	.position-input span {
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.position-input input {
		flex: 1;
		padding: 0.4rem 0.5rem;
		background: rgba(30, 41, 59, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #f8fafc;
	}

	.copy-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.preview-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		align-items: center;
		justify-content: center;
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		padding: 1rem;
		min-height: 520px;
	}

	.preview-canvas {
		max-width: 100%;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
	}

	.preview-placeholder {
		text-align: center;
		color: #94a3b8;
	}

	.preview-hint {
		margin: 0;
		font-size: 0.85rem;
		color: rgba(148, 163, 184, 0.75);
	}

	.btn {
		padding: 0.45rem 0.75rem;
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		color: #e2e8f0;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.btn:hover:not(:disabled) {
		background: rgba(51, 65, 85, 0.8);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn--primary {
		background: rgba(59, 130, 246, 0.35);
		border-color: rgba(96, 165, 250, 0.45);
		color: #93c5fd;
	}

	.btn--primary:hover:not(:disabled) {
		background: rgba(59, 130, 246, 0.5);
	}

	.btn--secondary {
		background: rgba(30, 41, 59, 0.7);
	}

	.btn--danger {
		background: rgba(248, 113, 113, 0.14);
		border-color: rgba(248, 113, 113, 0.35);
		color: #fecaca;
	}

	.btn--danger:hover:not(:disabled) {
		background: rgba(248, 113, 113, 0.22);
	}

	.btn--sm {
		padding: 0.35rem 0.55rem;
		font-size: 0.85rem;
		border-radius: 6px;
	}

	.json-toggle-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 0.65rem;
		background: rgba(30, 41, 59, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 8px;
		color: #cbd5f5;
		cursor: pointer;
	}

	.json-toggle-icon {
		color: rgba(148, 163, 184, 0.85);
	}

	.json-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.3);
	}

	.json-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.json-textarea {
		width: 100%;
		min-height: 180px;
		resize: vertical;
		background: rgba(2, 6, 23, 0.45);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		padding: 0.5rem;
		color: #e2e8f0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
			monospace;
		font-size: 0.8rem;
	}

	.json-error {
		margin: 0;
		color: #fca5a5;
		font-size: 0.85rem;
	}

	@media (max-width: 960px) {
		.config-layout {
			grid-template-columns: 1fr;
		}

		.preview-panel {
			min-height: 420px;
		}
	}
</style>
