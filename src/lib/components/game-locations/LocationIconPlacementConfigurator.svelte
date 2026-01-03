<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createDefaultLocationIconConfig,
		type IconSlot,
		type LocationIconPlacementConfig,
		type LocationRowBackgroundConfig,
		type LocationRowPlacement
	} from '$lib/generators/locations/locationIconPlacer';
	import {
		fetchLocationIconPlacementConfig,
		upsertLocationIconPlacementConfig
	} from '$lib/api/locationIconPlacementConfig';
	import { loadImage } from '$lib/generators/shared/canvas';
	import { ImageUploader } from '$lib/components/shared';
	import { getPublicUrl } from '$lib/utils/storage';

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
	type IconSlotType = 'gain_slots' | 'trade_cost_slots' | 'trade_gain_slots';
	type EditorTarget = IconSlotType | 'gain_row_background' | 'trade_row_background';
	let currentSlotType = $state<EditorTarget>('gain_slots');
	let selectedSlotIndex: number | null = $state(null);

	let jsonEditorOpen = $state(false);
	let jsonText = $state('');
	let jsonError = $state('');

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let sampleImage: HTMLImageElement | null = $state(null);
	let displayScale = $state(1);
	let draggingSlot: number | null = $state(null);
	let dragOffset = $state({ x: 0, y: 0 });
	let draggingRowBackground = $state<'gain' | 'trade' | null>(null);
	let draggingRowBackgroundIndex = $state<number | null>(null);
	let rowBackgroundDragOffset = $state({ x: 0, y: 0 });

	let gainRowBackgroundImage: HTMLImageElement | null = $state(null);
	let tradeRowBackgroundImage: HTMLImageElement | null = $state(null);

	let lastGainRowBackgroundPath: string | null = null;
	let lastTradeRowBackgroundPath: string | null = null;

	const sampleUrl = $derived.by(() => {
		const explicit = sampleLocations.find((l) => l.id === selectedSampleId);
		if (explicit?.backgroundUrl) return explicit.backgroundUrl;
		return sampleLocations.find((l) => l.backgroundUrl)?.backgroundUrl ?? null;
	});

	function isIconSlotType(value: EditorTarget): value is IconSlotType {
		return value === 'gain_slots' || value === 'trade_cost_slots' || value === 'trade_gain_slots';
	}

	let currentSlots = $derived.by(() => {
		if (!isIconSlotType(currentSlotType)) return [];
		const row = config.rows[currentRowIndex];
		return row ? (row[currentSlotType] ?? []) : [];
	});

	onMount(() => {
		void (async () => {
			config = await fetchLocationIconPlacementConfig();
		})();
		selectedSampleId = sampleLocations[0]?.id ?? '';
	});

	$effect(() => {
		if (isOpen) {
			loadSampleImage();
		}
	});

	$effect(() => {
		if (!isOpen) return;

		const gainPath = config.gain_row_background?.path ?? null;
		if (gainPath !== lastGainRowBackgroundPath) {
			lastGainRowBackgroundPath = gainPath;
			const url = getPublicUrl('game_assets', gainPath, false);
			if (!url) {
				gainRowBackgroundImage = null;
				drawCanvas();
			} else {
				gainRowBackgroundImage = null;
				drawCanvas();
				loadImage(url)
					.then((img) => {
						gainRowBackgroundImage = img;
						drawCanvas();
					})
					.catch((err) => {
						console.warn('Failed to load gain row background image:', err);
						gainRowBackgroundImage = null;
						drawCanvas();
					});
			}
		}

		const tradePath = config.trade_row_background?.path ?? null;
		if (tradePath !== lastTradeRowBackgroundPath) {
			lastTradeRowBackgroundPath = tradePath;
			const url = getPublicUrl('game_assets', tradePath, false);
			if (!url) {
				tradeRowBackgroundImage = null;
				drawCanvas();
			} else {
				tradeRowBackgroundImage = null;
				drawCanvas();
				loadImage(url)
					.then((img) => {
						tradeRowBackgroundImage = img;
						drawCanvas();
					})
					.catch((err) => {
						console.warn('Failed to load trade row background image:', err);
						tradeRowBackgroundImage = null;
						drawCanvas();
					});
			}
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

	function slotColors(slotType: IconSlotType) {
		switch (slotType) {
			case 'trade_cost_slots':
				return ['#f97316', '#fb7185', '#f59e0b', '#fca5a5', '#fdba74'];
			case 'trade_gain_slots':
				return ['#22c55e', '#10b981', '#34d399', '#86efac', '#4ade80'];
			case 'gain_slots':
			default:
				return ['#60a5fa', '#a78bfa', '#38bdf8', '#93c5fd', '#818cf8'];
		}
	}

	function drawIconSlots(slots: IconSlot[], colors: string[], selectedIndex: number | null) {
		if (!canvasEl || !sampleImage) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const size = (config._icon_size || 80) * displayScale;

		slots.forEach((slot, i) => {
			const color = colors[i % colors.length];
			const x = slot.x * displayScale;
			const y = slot.y * displayScale;

			ctx.strokeStyle = color;
			ctx.lineWidth = selectedIndex === i ? 4 : 2;
			ctx.strokeRect(x, y, size, size);

			ctx.fillStyle = color;
			ctx.font = `bold ${14 * displayScale}px Arial`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(String(i + 1), x + size / 2, y + size / 2);
		});
	}

	function defaultRowAnchor(kind: 'gain' | 'trade', rowIndex: number): IconSlot {
		const y = 40 + rowIndex * 140;
		return { x: 40, y };
	}

	function anchorFor(kind: 'gain' | 'trade', rowIndex: number): IconSlot {
		const row = ensureRow(rowIndex);
		const slots = kind === 'gain' ? row.gain_slots : row.trade_cost_slots;
		return slots?.[0] ?? defaultRowAnchor(kind, rowIndex);
	}

	function rowAnchorDelta(kind: 'gain' | 'trade', rowIndex: number) {
		const ref = anchorFor(kind, 0);
		const current = anchorFor(kind, rowIndex);
		return { dx: current.x - ref.x, dy: current.y - ref.y };
	}

	function getRowBackgroundDisplayPosition(kind: 'gain' | 'trade', rowIndex: number): { x: number; y: number } {
		const cfg = kind === 'gain' ? config.gain_row_background : config.trade_row_background;
		const { dx, dy } = rowAnchorDelta(kind, rowIndex);
		return { x: (cfg.x ?? 0) + dx, y: (cfg.y ?? 0) + dy };
	}

	function setRowBackgroundDisplayPosition(kind: 'gain' | 'trade', rowIndex: number, patch: Partial<{ x: number; y: number }>) {
		const cfg = kind === 'gain' ? config.gain_row_background : config.trade_row_background;
		const { dx, dy } = rowAnchorDelta(kind, rowIndex);
		const next: Partial<LocationRowBackgroundConfig> = {};

		if (typeof patch.x === 'number' && Number.isFinite(patch.x)) next.x = Math.max(0, Math.round(patch.x - dx));
		if (typeof patch.y === 'number' && Number.isFinite(patch.y)) next.y = Math.max(0, Math.round(patch.y - dy));

		updateRowBackground(kind, { ...cfg, ...next });
	}

	function drawRowBackgrounds(kind: 'gain' | 'trade', img: HTMLImageElement | null, cfg: LocationRowBackgroundConfig) {
		if (!canvasEl || !sampleImage || !img) return;
		const ctx = canvasEl.getContext('2d');
		if (!ctx) return;

		const scale = cfg.scale ?? 1;
		const w = img.width * scale;
		const h = img.height * scale;

		for (let rowIndex = 0; rowIndex < config.rows.length; rowIndex++) {
			const { x, y } = getRowBackgroundDisplayPosition(kind, rowIndex);
			ctx.drawImage(img, x * displayScale, y * displayScale, w * displayScale, h * displayScale);

			if (
				(currentSlotType === 'gain_row_background' && kind === 'gain' && rowIndex === currentRowIndex) ||
				(currentSlotType === 'trade_row_background' && kind === 'trade' && rowIndex === currentRowIndex)
			) {
				ctx.strokeStyle = '#eab308';
				ctx.lineWidth = 3;
				ctx.strokeRect(x * displayScale, y * displayScale, w * displayScale, h * displayScale);
			}
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

		if (currentSlotType === 'gain_slots' || currentSlotType === 'gain_row_background') {
			drawRowBackgrounds('gain', gainRowBackgroundImage, config.gain_row_background);
		} else if (
			currentSlotType === 'trade_cost_slots' ||
			currentSlotType === 'trade_gain_slots' ||
			currentSlotType === 'trade_row_background'
		) {
			drawRowBackgrounds('trade', tradeRowBackgroundImage, config.trade_row_background);
		}

		if (currentSlotType === 'gain_row_background') {
			drawIconSlots(ensureRow(currentRowIndex).gain_slots ?? [], slotColors('gain_slots'), null);
			return;
		}

		if (currentSlotType === 'trade_row_background') {
			const row = ensureRow(currentRowIndex);
			drawIconSlots(row.trade_cost_slots ?? [], slotColors('trade_cost_slots'), null);
			drawIconSlots(row.trade_gain_slots ?? [], slotColors('trade_gain_slots'), null);
			return;
		}

		drawIconSlots(currentSlots, slotColors(currentSlotType), selectedSlotIndex);
	}

	function handleCanvasClick(event: MouseEvent) {
		if (!sampleImage || !canvasEl) return;

		const rect = canvasEl.getBoundingClientRect();
		const realX = (event.clientX - rect.left) / displayScale;
		const realY = (event.clientY - rect.top) / displayScale;

		if (currentSlotType === 'gain_row_background') {
			selectedSlotIndex = null;
			draggingSlot = null;

			const img = gainRowBackgroundImage;
			if (!img) return;
			const bg = config.gain_row_background;
			const w = img.width * (bg.scale ?? 1);
			const h = img.height * (bg.scale ?? 1);
			const pos = getRowBackgroundDisplayPosition('gain', currentRowIndex);
			if (realX >= pos.x && realX <= pos.x + w && realY >= pos.y && realY <= pos.y + h) {
				draggingRowBackground = 'gain';
				draggingRowBackgroundIndex = currentRowIndex;
				rowBackgroundDragOffset = { x: realX - pos.x, y: realY - pos.y };
				drawCanvas();
				return;
			}

			draggingRowBackground = null;
			draggingRowBackgroundIndex = null;
			drawCanvas();
			return;
		}

		if (currentSlotType === 'trade_row_background') {
			selectedSlotIndex = null;
			draggingSlot = null;

			const img = tradeRowBackgroundImage;
			if (!img) return;
			const bg = config.trade_row_background;
			const w = img.width * (bg.scale ?? 1);
			const h = img.height * (bg.scale ?? 1);
			const pos = getRowBackgroundDisplayPosition('trade', currentRowIndex);
			if (realX >= pos.x && realX <= pos.x + w && realY >= pos.y && realY <= pos.y + h) {
				draggingRowBackground = 'trade';
				draggingRowBackgroundIndex = currentRowIndex;
				rowBackgroundDragOffset = { x: realX - pos.x, y: realY - pos.y };
				drawCanvas();
				return;
			}

			draggingRowBackground = null;
			draggingRowBackgroundIndex = null;
			drawCanvas();
			return;
		}

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
		draggingRowBackground = null;
		draggingRowBackgroundIndex = null;
		drawCanvas();
	}

	function handleCanvasDrag(event: MouseEvent) {
		if (draggingRowBackground !== null && sampleImage && canvasEl) {
			const rect = canvasEl.getBoundingClientRect();
			const realX = (event.clientX - rect.left) / displayScale;
			const realY = (event.clientY - rect.top) / displayScale;

			const displayPos = {
				x: Math.max(0, Math.round(realX - rowBackgroundDragOffset.x)),
				y: Math.max(0, Math.round(realY - rowBackgroundDragOffset.y))
			};

			const rowIndex = draggingRowBackgroundIndex ?? currentRowIndex;
			const { dx, dy } = rowAnchorDelta(draggingRowBackground, rowIndex);
			const nextPos = {
				x: Math.max(0, Math.round(displayPos.x - dx)),
				y: Math.max(0, Math.round(displayPos.y - dy))
			};

			if (draggingRowBackground === 'gain') {
				config = { ...config, gain_row_background: { ...config.gain_row_background, ...nextPos } };
			} else {
				config = { ...config, trade_row_background: { ...config.trade_row_background, ...nextPos } };
			}

			drawCanvas();
			return;
		}

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
		draggingRowBackground = null;
		draggingRowBackgroundIndex = null;
	}

	function handleCanvasRightClick(event: MouseEvent) {
		event.preventDefault();
		if (!sampleImage || !canvasEl) return;
		if (!isIconSlotType(currentSlotType)) return;

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
		draggingSlot = null;
		draggingRowBackground = null;
		draggingRowBackgroundIndex = null;
		drawCanvas();
	}

	function removeRow(index: number) {
		if (config.rows.length <= 1) return;
		const nextRows = [...config.rows];
		nextRows.splice(index, 1);
		config = { ...config, rows: nextRows };
		currentRowIndex = Math.max(0, Math.min(currentRowIndex, config.rows.length - 1));
		selectedSlotIndex = null;
		draggingSlot = null;
		draggingRowBackground = null;
		draggingRowBackgroundIndex = null;
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
		if (!isIconSlotType(currentSlotType)) return;
		const slotType = currentSlotType;
		const row = ensureRow(currentRowIndex);
		const slots = row[slotType] ?? [];
		const offset = slots.length * 30;
		const newSlot: IconSlot = position ?? { x: 40 + offset, y: 40 + offset };

		const nextRow: LocationRowPlacement = { ...row, [slotType]: [...slots, newSlot] };
		const nextRows = [...config.rows];
		nextRows[currentRowIndex] = nextRow;
		config = { ...config, rows: nextRows };

		selectedSlotIndex = slots.length;
		drawCanvas();
	}

	function removeSelectedSlot() {
		if (selectedSlotIndex === null) return;
		if (!isIconSlotType(currentSlotType)) return;
		const slotType = currentSlotType;
		const row = ensureRow(currentRowIndex);
		const slots = [...(row[slotType] ?? [])];
		slots.splice(selectedSlotIndex, 1);

		const nextRow: LocationRowPlacement = { ...row, [slotType]: slots };
		const nextRows = [...config.rows];
		nextRows[currentRowIndex] = nextRow;
		config = { ...config, rows: nextRows };

		selectedSlotIndex = null;
		drawCanvas();
	}

	function updateSlotPosition(index: number, pos: { x: number; y: number }) {
		if (!isIconSlotType(currentSlotType)) return;
		const slotType = currentSlotType;
		const row = ensureRow(currentRowIndex);
		const slots = [...(row[slotType] ?? [])];
		slots[index] = { ...slots[index], ...pos };

		const nextRow: LocationRowPlacement = { ...row, [slotType]: slots };
		const nextRows = [...config.rows];
		nextRows[currentRowIndex] = nextRow;
		config = { ...config, rows: nextRows };
		drawCanvas();
	}

	function handleSizeChange(value: number) {
		config = { ...config, _icon_size: value };
		drawCanvas();
	}

	function updateRowBackground(kind: 'gain' | 'trade', patch: Partial<LocationRowBackgroundConfig>) {
		if (kind === 'gain') {
			config = { ...config, gain_row_background: { ...config.gain_row_background, ...patch } };
		} else {
			config = { ...config, trade_row_background: { ...config.trade_row_background, ...patch } };
		}
		drawCanvas();
	}

	function handleSave() {
		void (async () => {
			const saved = await upsertLocationIconPlacementConfig(config);
			config = saved;
			onSave(saved);
		})();
	}

	function handleGenerate() {
		void (async () => {
			const saved = await upsertLocationIconPlacementConfig(config);
			config = saved;
			onGenerateAll();
		})();
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
			const defaults = createDefaultLocationIconConfig();
			const parsed = JSON.parse(jsonText) as Partial<LocationIconPlacementConfig>;
			if (!parsed || typeof parsed._icon_size !== 'number' || !Array.isArray(parsed.rows)) {
				throw new Error('Invalid config shape');
			}

			function sanitizeRowBackground(input: unknown, fallback: LocationRowBackgroundConfig): LocationRowBackgroundConfig {
				if (!input || typeof input !== 'object') return { ...fallback };
				const obj = input as Record<string, unknown>;

				const path = typeof obj.path === 'string' ? obj.path : null;
				const x = typeof obj.x === 'number' && Number.isFinite(obj.x) ? obj.x : fallback.x;
				const y = typeof obj.y === 'number' && Number.isFinite(obj.y) ? obj.y : fallback.y;
				const scaleRaw = typeof obj.scale === 'number' && Number.isFinite(obj.scale) ? obj.scale : fallback.scale;
				const scale = Math.max(0, scaleRaw);

				return { path, x, y, scale };
			}

			const rows = [...parsed.rows] as LocationRowPlacement[];
			if (rows.length === 0) {
				rows.push(defaults.rows[0]);
			}

			config = {
				_icon_size: parsed._icon_size,
				rows,
				gain_row_background: sanitizeRowBackground(parsed.gain_row_background, defaults.gain_row_background),
				trade_row_background: sanitizeRowBackground(parsed.trade_row_background, defaults.trade_row_background),
				text_row_background: sanitizeRowBackground(parsed.text_row_background, defaults.text_row_background)
			};
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
								<label class="control-label" for="sample-location-select">Sample Location</label>
								<select
									id="sample-location-select"
									class="control-select"
									bind:value={selectedSampleId}
									onchange={loadSampleImage}
								>
									{#each sampleLocations as loc (loc.id)}
										<option value={loc.id}>{loc.name}</option>
									{/each}
								</select>
							</div>

							<div class="control-group">
								<label class="control-label" for="location-placement-row">Row</label>
								<div class="row-controls">
									<select
										id="location-placement-row"
										class="control-select"
										value={String(currentRowIndex)}
										onchange={(e) => {
											currentRowIndex = Number((e.currentTarget as HTMLSelectElement).value);
											selectedSlotIndex = null;
											draggingSlot = null;
											draggingRowBackground = null;
											draggingRowBackgroundIndex = null;
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
								<div class="control-label">Row Backgrounds</div>
								<div class="row-backgrounds">
									<div class="row-backgrounds__item">
										<div class="row-backgrounds__title">Gain Reward</div>
										<ImageUploader
											bind:value={config.gain_row_background.path}
											folder="game_locations/reward_row_backgrounds/gain"
											maxSizeMB={25}
											cropTransparent={false}
											onerror={(err) => alert(`Upload failed: ${err}`)}
										/>
									</div>
									<div class="row-backgrounds__item">
										<div class="row-backgrounds__title">Trade</div>
										<ImageUploader
											bind:value={config.trade_row_background.path}
											folder="game_locations/reward_row_backgrounds/trade"
											maxSizeMB={25}
											cropTransparent={false}
											onerror={(err) => alert(`Upload failed: ${err}`)}
										/>
									</div>
									<div class="row-backgrounds__item">
										<div class="row-backgrounds__title">Text</div>
										<ImageUploader
											bind:value={config.text_row_background.path}
											folder="game_locations/reward_row_backgrounds/text"
											maxSizeMB={25}
											cropTransparent={false}
											onerror={(err) => alert(`Upload failed: ${err}`)}
										/>
									</div>
								</div>
							</div>

							<div class="control-group">
								<div class="control-label">Slot Type</div>
								<div class="slot-type-buttons">
									<button
										type="button"
										class={`slot-type-btn ${currentSlotType === 'gain_slots' ? 'active' : ''}`}
										onclick={() => {
											currentSlotType = 'gain_slots';
											selectedSlotIndex = null;
											draggingSlot = null;
											draggingRowBackground = null;
											draggingRowBackgroundIndex = null;
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
											draggingSlot = null;
											draggingRowBackground = null;
											draggingRowBackgroundIndex = null;
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
											draggingSlot = null;
											draggingRowBackground = null;
											draggingRowBackgroundIndex = null;
											drawCanvas();
										}}
									>
										Trade: Gain
									</button>
									<button
										type="button"
										class={`slot-type-btn ${currentSlotType === 'gain_row_background' ? 'active' : ''}`}
										onclick={() => {
											currentSlotType = 'gain_row_background';
											selectedSlotIndex = null;
											draggingSlot = null;
											draggingRowBackground = null;
											draggingRowBackgroundIndex = null;
											drawCanvas();
										}}
									>
										Row BG: Gain
									</button>
									<button
										type="button"
										class={`slot-type-btn ${currentSlotType === 'trade_row_background' ? 'active' : ''}`}
										onclick={() => {
											currentSlotType = 'trade_row_background';
											selectedSlotIndex = null;
											draggingSlot = null;
											draggingRowBackground = null;
											draggingRowBackgroundIndex = null;
											drawCanvas();
										}}
									>
										Row BG: Trade
									</button>
								</div>
							</div>

							{#if isIconSlotType(currentSlotType)}
								<div class="control-group">
									<div class="control-label">Slots ({currentSlots.length})</div>
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
							{/if}

							<div class="control-group">
								<label class="control-label" for="location-icon-size">Icon Size</label>
								<input
									id="location-icon-size"
									class="control-input"
									type="number"
									value={config._icon_size}
									onchange={(e) => handleSizeChange(Number((e.currentTarget as HTMLInputElement).value))}
								/>
							</div>

							{#if currentSlotType === 'gain_row_background'}
								{@const bg = config.gain_row_background}
								{@const pos = getRowBackgroundDisplayPosition('gain', currentRowIndex)}
								<div class="control-group">
									<div class="control-label">Gain Row Background Placement</div>
									<div class="position-inputs">
										<label class="position-input">
											<span>X:</span>
											<input
												type="number"
												value={pos.x}
												onchange={(e) =>
													setRowBackgroundDisplayPosition('gain', currentRowIndex, {
														x: Number((e.currentTarget as HTMLInputElement).value)
													})}
											/>
										</label>
										<label class="position-input">
											<span>Y:</span>
											<input
												type="number"
												value={pos.y}
												onchange={(e) =>
													setRowBackgroundDisplayPosition('gain', currentRowIndex, {
														y: Number((e.currentTarget as HTMLInputElement).value)
													})}
											/>
										</label>
										<label class="position-input">
											<span>Scale:</span>
											<input
												type="number"
												step="0.01"
												value={bg.scale}
												onchange={(e) =>
													updateRowBackground('gain', {
														scale: Math.max(0, Number((e.currentTarget as HTMLInputElement).value))
													})}
											/>
										</label>
									</div>
									<p class="control-hint">Drag the yellow outline on the canvas to move.</p>
								</div>
							{:else if currentSlotType === 'trade_row_background'}
								{@const bg = config.trade_row_background}
								{@const pos = getRowBackgroundDisplayPosition('trade', currentRowIndex)}
								<div class="control-group">
									<div class="control-label">Trade Row Background Placement</div>
									<div class="position-inputs">
										<label class="position-input">
											<span>X:</span>
											<input
												type="number"
												value={pos.x}
												onchange={(e) =>
													setRowBackgroundDisplayPosition('trade', currentRowIndex, {
														x: Number((e.currentTarget as HTMLInputElement).value)
													})}
											/>
										</label>
										<label class="position-input">
											<span>Y:</span>
											<input
												type="number"
												value={pos.y}
												onchange={(e) =>
													setRowBackgroundDisplayPosition('trade', currentRowIndex, {
														y: Number((e.currentTarget as HTMLInputElement).value)
													})}
											/>
										</label>
										<label class="position-input">
											<span>Scale:</span>
											<input
												type="number"
												step="0.01"
												value={bg.scale}
												onchange={(e) =>
													updateRowBackground('trade', {
														scale: Math.max(0, Number((e.currentTarget as HTMLInputElement).value))
													})}
											/>
										</label>
									</div>
									<p class="control-hint">Drag the yellow outline on the canvas to move.</p>
								</div>
							{/if}

							{#if isIconSlotType(currentSlotType) && selectedSlotIndex !== null && currentSlots[selectedSlotIndex]}
								<div class="control-group">
									<div class="control-label">Selected Position</div>
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
								<p class="preview-hint">
									Left-click to select/drag. Right-click to add icon slots (icon mode).
								</p>
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

	.row-controls .control-select {
		flex: 1;
	}

	.row-backgrounds {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
	}

	.row-backgrounds__item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.row-backgrounds__title {
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.row-backgrounds :global(.image-uploader__dropzone) {
		min-height: 140px;
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
		flex-wrap: wrap;
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

	.control-hint {
		margin: 0;
		font-size: 0.85rem;
		color: rgba(148, 163, 184, 0.85);
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
