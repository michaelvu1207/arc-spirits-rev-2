<!--
@component
CallingOrbTemplate - Template editor for generating calling orb images

**Usage:**
```svelte
<script>
import { CallingOrbTemplate } from '$lib/components/origins';
import { uploadToSupabase } from '$lib/api/storage';

async function handleGenerate(originId: string, imageBlob: Blob) {
  const path = `calling-orbs/${originId}.png`;
  await uploadToSupabase(path, imageBlob);
  console.log(`Saved orb for origin ${originId}`);
}
</script>

<CallingOrbTemplate
  origins={originsData}
  onGenerate={handleGenerate}
/>
```

**Features:**
- Background image upload (shared across all orbs)
- Canvas preview with 800x800px dimensions
- Per-origin text positioning (x/y %, font size, color, weight)
- Batch generation for all origins with calling cards
- Template persistence via localStorage
- Progress tracking and error handling
-->
<script lang="ts">
	import type { OriginRow, CallingCard, CallingOrbTemplateData, IconPoolRow } from '$lib/types/gameData';
	import { Button, Input } from '$lib/components/ui';
	import {
		createCanvas,
		getContext,
		canvasToBlob,
		loadImageFromBlob
	} from '$lib/generators/shared/canvas';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { SvelteMap } from 'svelte/reactivity';

	function drawImageContain(
		ctx: CanvasRenderingContext2D,
		img: HTMLImageElement,
		x: number,
		y: number,
		w: number,
		h: number
	) {
		const naturalW = img.naturalWidth || img.width || w;
		const naturalH = img.naturalHeight || img.height || h;
		const safeW = naturalW > 0 ? naturalW : w;
		const safeH = naturalH > 0 ? naturalH : h;
		const scale = Math.min(w / safeW, h / safeH);
		const drawW = safeW * scale;
		const drawH = safeH * scale;
		const drawX = x + (w - drawW) / 2;
		const drawY = y + (h - drawH) / 2;
		ctx.drawImage(img, drawX, drawY, drawW, drawH);
	}

	interface Props {
		origins: OriginRow[];
		iconPool: IconPoolRow[];
		onGenerate: (originId: string, imageBlob: Blob) => Promise<void>;
	}

	let { origins, iconPool, onGenerate }: Props = $props();

	// Canvas configuration
	const CANVAS_WIDTH = 800;
	const CANVAS_HEIGHT = 800;

	// Template state
	let backgroundImage = $state<string | null>(null);
	let backgroundBlob = $state<Blob | null>(null);
	let textPositions = new SvelteMap<
		string,
		{
			x: number;
			y: number;
			fontSize: number;
			color: string;
			fontWeight: string;
			gap: number;
		}[]
	>();

	// UI state
	let isGenerating = $state(false);
	let generationProgress = $state(0);
	let generationTotal = $state(0);
	let errorMessage = $state<string | null>(null);
	let successMessage = $state<string | null>(null);
	let canvasPreviewUrl = $state<string | null>(null);
	let selectedOriginId = $state<string | null>(null);

	// Dragging state
	let isDragging = $state(false);
	let dragBreakpointIndex = $state<number | null>(null);

	// Get origins with calling cards enabled
	const originsWithCallingCards = $derived(
		origins.filter((origin) => {
			const card = origin.calling_card as CallingCard | null;
			return card?.enabled === true && card.breakpoints && card.breakpoints.length > 0;
		})
	);

	// Load template from localStorage on mount
	let hasLoadedTemplate = $state(false);

	$effect(() => {
		if (hasLoadedTemplate) return;

		const saved = localStorage.getItem('calling-orb-template');
		if (saved) {
			try {
				const data: CallingOrbTemplateData & { backgroundDataUrl?: string } = JSON.parse(saved);

				// Restore background image from data URL
				if (data.backgroundDataUrl) {
					fetch(data.backgroundDataUrl)
						.then(res => res.blob())
						.then(blob => {
							backgroundBlob = blob;
							backgroundImage = URL.createObjectURL(blob);
							updateCanvasPreview();
						})
						.catch(err => console.error('Failed to restore background:', err));
				}

				// Restore icon positions for each origin
				textPositions.clear();
				if (data.textPositions && Array.isArray(data.textPositions)) {
					// Group positions by origin (using breakpointIndex as a simple approach)
					// Since we don't have origin ID in the saved data, we'll restore to all origins
					originsWithCallingCards.forEach(origin => {
						const card = origin.calling_card as CallingCard;
						if (!card) return;

						const positions = card.breakpoints.map((_, index) => {
							const saved = data.textPositions.find(p => p.breakpointIndex === index);
							return saved ? {
								x: saved.x,
								y: saved.y,
								fontSize: saved.fontSize,
								color: saved.color,
								fontWeight: saved.fontWeight,
								gap: saved.gap ?? 10
							} : {
								x: 50,
								y: 30 + index * 20,
								fontSize: 32,
								color: '#ffffff',
								fontWeight: 'bold',
								gap: 10
							};
						});

						textPositions.set(origin.id, positions);
					});
				}
			} catch (e) {
				console.error('Failed to load template:', e);
			}
		}

		// Select first origin by default
		if (originsWithCallingCards.length > 0 && !selectedOriginId) {
			selectedOriginId = originsWithCallingCards[0].id;
			if (!textPositions.has(originsWithCallingCards[0].id)) {
				initializeTextPositions(originsWithCallingCards[0].id);
			}
			updateCanvasPreview();
		}

		hasLoadedTemplate = true;
	});

	// Save template to localStorage
	async function saveTemplate() {
		const allPositions: CallingOrbTemplateData['textPositions'] = [];

		textPositions.forEach((positions, originId) => {
			positions.forEach((pos, index) => {
				allPositions.push({
					breakpointIndex: index,
					x: pos.x,
					y: pos.y,
					fontSize: pos.fontSize,
					color: pos.color,
					fontWeight: pos.fontWeight,
					gap: pos.gap ?? 10
				});
			});
		});

		// Convert background blob to data URL for persistence
		let backgroundDataUrl: string | undefined;
		const blob = backgroundBlob;
		if (blob) {
			backgroundDataUrl = await new Promise<string>((resolve) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve(reader.result as string);
				reader.readAsDataURL(blob);
			});
		}

		const data = {
			backgroundImage,
			backgroundDataUrl,
			textPositions: allPositions
		};

		localStorage.setItem('calling-orb-template', JSON.stringify(data));
	}

	// Initialize text positions for an origin
	function initializeTextPositions(originId: string) {
		if (textPositions.has(originId)) return;

		const origin = origins.find((o) => o.id === originId);
		if (!origin) return;

		const card = origin.calling_card as CallingCard | null;
		if (!card || !card.breakpoints) return;

		const positions = card.breakpoints.map((_, index) => ({
			x: 50,
			y: 30 + index * 20,
			fontSize: 32,
			color: '#ffffff',
			fontWeight: 'bold',
			gap: 10
		}));

		textPositions.set(originId, positions);
	}

	// Scale image to fit canvas dimensions (no cropping, maintains aspect ratio)
	async function scaleToFitCanvas(file: File | Blob): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(file);

			img.onload = () => {
				URL.revokeObjectURL(url);

				try {
					// Create canvas at target dimensions
					const canvas = document.createElement('canvas');
					canvas.width = CANVAS_WIDTH;
					canvas.height = CANVAS_HEIGHT;
					const ctx = canvas.getContext('2d');

					if (!ctx) {
						reject(new Error('Could not get canvas context'));
						return;
					}

					// Calculate scale to fit while maintaining aspect ratio
					const scale = Math.min(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height);
					const scaledWidth = img.width * scale;
					const scaledHeight = img.height * scale;

					// Center the image on canvas
					const offsetX = (CANVAS_WIDTH - scaledWidth) / 2;
					const offsetY = (CANVAS_HEIGHT - scaledHeight) / 2;

					// Fill with transparent background
					ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

					// Draw scaled image centered
					ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);

					canvas.toBlob(
						(blob) => {
							if (blob) {
								resolve(blob);
							} else {
								reject(new Error('Failed to create blob from canvas'));
							}
						},
						'image/png',
						0.95
					);
				} catch (err) {
					reject(err);
				}
			};

			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load image'));
			};

			img.src = url;
		});
	}

	// Handle background image upload
	async function handleBackgroundUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			// Scale to fit canvas dimensions (no cropping)
			const scaledBlob = await scaleToFitCanvas(file);
			backgroundBlob = scaledBlob;
			const url = URL.createObjectURL(scaledBlob);
			backgroundImage = url;
			saveTemplate();
			await updateCanvasPreview();
		} catch (err) {
			errorMessage = 'Failed to load background image';
			console.error(err);
		}
	}

	// Update text position
	function updateTextPosition(
		originId: string,
		breakpointIndex: number,
		field: 'x' | 'y' | 'fontSize' | 'color' | 'fontWeight' | 'gap',
		value: string | number
	) {
		const positions = textPositions.get(originId);
		if (!positions || !positions[breakpointIndex]) return;

		if (field === 'fontSize' || field === 'gap') {
			positions[breakpointIndex][field] = Number(value);
		} else if (field === 'x' || field === 'y') {
			positions[breakpointIndex][field] = Number(value);
		} else {
			positions[breakpointIndex][field] = String(value);
		}

		// Update the map to trigger reactivity
		textPositions.set(originId, [...positions]);
		saveTemplate();
		updateCanvasPreview();
	}

	// Handle canvas mouse down for dragging
	function handleCanvasMouseDown(e: MouseEvent, breakpointIndex: number) {
		const canvas = e.currentTarget as HTMLCanvasElement;
		const rect = canvas.getBoundingClientRect();

		isDragging = true;
		dragBreakpointIndex = breakpointIndex;

		handleCanvasMouseMove(e);
	}

	// Handle canvas mouse move for dragging
	function handleCanvasMouseMove(e: MouseEvent) {
		if (!isDragging || dragBreakpointIndex === null || !selectedOriginId) return;

		const canvas = e.currentTarget as HTMLCanvasElement;
		const rect = canvas.getBoundingClientRect();

		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;

		updateTextPosition(selectedOriginId, dragBreakpointIndex, 'x', Math.max(0, Math.min(100, x)));
		updateTextPosition(selectedOriginId, dragBreakpointIndex, 'y', Math.max(0, Math.min(100, y)));
	}

	// Handle canvas mouse up for dragging
	function handleCanvasMouseUp() {
		isDragging = false;
		dragBreakpointIndex = null;
	}

	// Format breakpoint text
	function formatBreakpointText(origin: OriginRow, breakpointIndex: number): string {
		const card = origin.calling_card as CallingCard;
		const breakpoint = card.breakpoints[breakpointIndex];
		if (!breakpoint) return '';

		const countLabel = breakpoint.label ? `${breakpoint.count} ${breakpoint.label}` : `${breakpoint.count}`;
		const iconCount = breakpoint.icon_ids?.length || 0;

		return `(${countLabel}) ${iconCount} icon${iconCount !== 1 ? 's' : ''}`;
	}

	// Update canvas preview
	async function updateCanvasPreview() {
		if (!selectedOriginId) return;

		try {
			const blob = await renderOriginOrb(selectedOriginId);
			if (canvasPreviewUrl) {
				URL.revokeObjectURL(canvasPreviewUrl);
			}
			canvasPreviewUrl = URL.createObjectURL(blob);
		} catch (err) {
			console.error('Failed to update preview:', err);
		}
	}

	// Render a single origin orb
	async function renderOriginOrb(originId: string): Promise<Blob> {
		const origin = origins.find((o) => o.id === originId);
		if (!origin) throw new Error('Origin not found');

		const card = origin.calling_card as CallingCard;
		if (!card) throw new Error('No calling card');

		const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
		const ctx = getContext(canvas);

		// Draw background
		if (backgroundBlob) {
			const img = await loadImageFromBlob(backgroundBlob);
			ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		} else {
			// Default background
			ctx.fillStyle = '#1e293b';
			ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		}

		// Draw icons for each breakpoint
		const positions = textPositions.get(originId) || [];
		for (let bpIndex = 0; bpIndex < card.breakpoints.length; bpIndex++) {
			const breakpoint = card.breakpoints[bpIndex];
			const pos = positions[bpIndex];
			if (!pos) continue;

			// Load and draw each icon for this breakpoint
			for (let iconIdx = 0; iconIdx < breakpoint.icon_ids.length; iconIdx++) {
				const iconId = breakpoint.icon_ids[iconIdx];
				const icon = iconPool.find((i) => i.id === iconId);
				if (!icon) continue;

				// Load icon image
				const iconUrl = publicAssetUrl(icon.file_path, { bucket: 'game_assets' });
				if (!iconUrl) continue;

				const iconImg = new Image();
				iconImg.crossOrigin = 'anonymous';

				await new Promise((resolve, reject) => {
					iconImg.onload = resolve;
					iconImg.onerror = reject;
					iconImg.src = iconUrl;
				});

				// Calculate position (icons arranged horizontally)
				const iconSize = pos.fontSize; // Use fontSize as icon size
				const spacing = pos.gap ?? 10; // Use configurable gap (default 10px)
				const totalWidth = (iconSize * breakpoint.icon_ids.length) + (spacing * (breakpoint.icon_ids.length - 1));
				const startX = ((pos.x / 100) * CANVAS_WIDTH) - (totalWidth / 2);
				const iconX = startX + (iconIdx * (iconSize + spacing));
				const iconY = (pos.y / 100) * CANVAS_HEIGHT - (iconSize / 2);

				// Draw icon
				drawImageContain(ctx, iconImg, iconX, iconY, iconSize, iconSize);
			}
		}

		return canvasToBlob(canvas);
	}

	// Generate all orbs
	async function generateAllOrbs() {
		isGenerating = true;
		errorMessage = null;
		successMessage = null;
		generationProgress = 0;
		generationTotal = originsWithCallingCards.length;

		try {
			for (let i = 0; i < originsWithCallingCards.length; i++) {
				const origin = originsWithCallingCards[i];

				// Initialize positions if needed
				if (!textPositions.has(origin.id)) {
					initializeTextPositions(origin.id);
				}

				// Render and save
				const blob = await renderOriginOrb(origin.id);
				await onGenerate(origin.id, blob);

				generationProgress = i + 1;
			}

			successMessage = `Successfully generated ${generationTotal} calling orb images!`;
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to generate orbs';
			console.error(err);
		} finally {
			isGenerating = false;
		}
	}

	// Select origin for preview
	function selectOrigin(originId: string) {
		selectedOriginId = originId;
		if (!textPositions.has(originId)) {
			initializeTextPositions(originId);
		}
		updateCanvasPreview();
	}
</script>

<div class="calling-orb-template">
	<div class="calling-orb-template__header">
		<h2>Calling Orb Template Editor</h2>
		<p>
			Configure the template for generating calling orb images. Upload a background, position text,
			and generate images for all origins.
		</p>
	</div>

	{#if originsWithCallingCards.length === 0}
		<div class="calling-orb-template__empty">
			<p>No origins with calling cards enabled. Enable calling cards on origins first.</p>
		</div>
	{:else}
		<div class="calling-orb-template__content">
			<!-- Background Upload -->
			<div class="calling-orb-template__section">
				<h3>Background Image</h3>
				<div class="calling-orb-template__upload">
					<input
						type="file"
						accept="image/*"
						onchange={handleBackgroundUpload}
						id="background-upload"
					/>
					<label for="background-upload" class="upload-label">
						{backgroundImage ? 'Change Background' : 'Upload Background'}
					</label>
					{#if backgroundImage}
						<span class="upload-status">✓ Background uploaded</span>
					{/if}
				</div>
			</div>

			<!-- Origin Selector -->
			<div class="calling-orb-template__section">
				<h3>Select Origin to Configure</h3>
				<div class="calling-orb-template__origins">
					{#each originsWithCallingCards as origin (origin.id)}
						<button
							class="origin-card"
							class:active={selectedOriginId === origin.id}
							onclick={() => selectOrigin(origin.id)}
						>
							{#if origin.icon_emoji}
								<span class="origin-card__icon">{origin.icon_emoji}</span>
							{/if}
							<span class="origin-card__name">{origin.name}</span>
						</button>
					{/each}
				</div>
			</div>

			{#if selectedOriginId}
				{@const selectedOrigin = origins.find((o) => o.id === selectedOriginId)}
				{@const card = selectedOrigin?.calling_card as CallingCard}
				{@const positions = textPositions.get(selectedOriginId) || []}

				<div class="calling-orb-template__editor">
					<!-- Canvas Preview -->
					<div class="calling-orb-template__preview">
						<h3>Preview</h3>
						<div class="canvas-container">
							{#if canvasPreviewUrl}
								<img src={canvasPreviewUrl} alt="Canvas preview" class="canvas-preview" />
							{:else}
								<div class="canvas-placeholder">
									<p>Preview will appear here</p>
								</div>
							{/if}
						</div>
					</div>

					<!-- Icon Configuration -->
					<div class="calling-orb-template__controls">
						<h3>Icon Configuration</h3>
						<div class="breakpoint-list">
							{#each card.breakpoints as breakpoint, index (index)}
								{@const pos = positions[index]}
								{#if pos}
									<div class="breakpoint-config">
										<div class="breakpoint-config__header">
											<h4>
												Breakpoint {index + 1}: {breakpoint.count}
												{breakpoint.label || ''}
											</h4>
											<span class="breakpoint-config__preview">
												{formatBreakpointText(selectedOrigin!, index)}
											</span>
										</div>

										<div class="breakpoint-config__fields">
											<div class="field-row">
												<div class="field">
													<label>X Position (%)</label>
													<input
														type="number"
														min={0}
														max={100}
														step={1}
														value={pos.x}
														oninput={(e) =>
															updateTextPosition(
																selectedOriginId!,
																index,
																'x',
																(e.target as HTMLInputElement).value
															)}
													/>
												</div>

												<div class="field">
													<label>Y Position (%)</label>
													<input
														type="number"
														min={0}
														max={100}
														step={1}
														value={pos.y}
														oninput={(e) =>
															updateTextPosition(
																selectedOriginId!,
																index,
																'y',
																(e.target as HTMLInputElement).value
															)}
													/>
												</div>
											</div>

											<div class="field-row">
												<div class="field">
													<label>Icon Size</label>
													<select
														value={pos.fontSize}
														onchange={(e) =>
															updateTextPosition(
																selectedOriginId!,
																index,
																'fontSize',
																(e.target as HTMLSelectElement).value
															)}
													>
														<option value={16}>16px</option>
														<option value={24}>24px</option>
														<option value={32}>32px</option>
														<option value={48}>48px</option>
														<option value={64}>64px</option>
														<option value={80}>80px</option>
														<option value={96}>96px</option>
														<option value={128}>128px</option>
														<option value={160}>160px</option>
														<option value={200}>200px</option>
													</select>
												</div>

												<div class="field">
													<label>Icon Gap</label>
													<select
														value={pos.gap ?? 10}
														onchange={(e) =>
															updateTextPosition(
																selectedOriginId!,
																index,
																'gap',
																(e.target as HTMLSelectElement).value
															)}
													>
														<option value={-50}>-50px</option>
														<option value={-40}>-40px</option>
														<option value={-30}>-30px</option>
														<option value={-20}>-20px</option>
														<option value={-10}>-10px</option>
														<option value={-5}>-5px</option>
														<option value={0}>0px</option>
														<option value={5}>5px</option>
														<option value={10}>10px</option>
														<option value={15}>15px</option>
														<option value={20}>20px</option>
														<option value={30}>30px</option>
														<option value={40}>40px</option>
														<option value={50}>50px</option>
														<option value={75}>75px</option>
														<option value={100}>100px</option>
													</select>
												</div>

												<div class="field" style="display: none;">
													<label>Font Weight</label>
													<select
														value={pos.fontWeight}
														onchange={(e) =>
															updateTextPosition(
																selectedOriginId!,
																index,
																'fontWeight',
																(e.target as HTMLSelectElement).value
															)}
													>
														<option value="normal">Normal</option>
														<option value="bold">Bold</option>
													</select>
												</div>

												<div class="field" style="display: none;">
													<label>Color</label>
													<input
														type="color"
														value={pos.color}
														oninput={(e) =>
															updateTextPosition(
																selectedOriginId!,
																index,
																'color',
																(e.target as HTMLInputElement).value
															)}
													/>
												</div>
											</div>
										</div>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Generate Button -->
			<div class="calling-orb-template__actions">
				<Button onclick={generateAllOrbs} disabled={isGenerating || !backgroundImage}>
					{#if isGenerating}
						Generating... ({generationProgress}/{generationTotal})
					{:else}
						Generate All Orbs ({originsWithCallingCards.length})
					{/if}
				</Button>

				{#if errorMessage}
					<div class="message message--error">
						<span>✕</span>
						<span>{errorMessage}</span>
					</div>
				{/if}

				{#if successMessage}
					<div class="message message--success">
						<span>✓</span>
						<span>{successMessage}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.calling-orb-template {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
	}

	.calling-orb-template__header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.calling-orb-template__header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #f8fafc;
	}

	.calling-orb-template__header p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.95rem;
	}

	.calling-orb-template__empty {
		padding: 3rem;
		text-align: center;
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.3);
	}

	.calling-orb-template__empty p {
		margin: 0;
		color: #94a3b8;
		font-size: 1rem;
	}

	.calling-orb-template__content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.calling-orb-template__section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.calling-orb-template__section h3 {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.calling-orb-template__upload {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.calling-orb-template__upload input[type='file'] {
		display: none;
	}

	.upload-label {
		padding: 0.6rem 1.2rem;
		border-radius: 8px;
		background: rgba(79, 70, 229, 0.15);
		border: 1px solid rgba(79, 70, 229, 0.3);
		color: #a5b4fc;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.15s ease;
	}

	.upload-label:hover {
		background: rgba(79, 70, 229, 0.25);
		border-color: rgba(79, 70, 229, 0.5);
	}

	.upload-status {
		color: #4ade80;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.calling-orb-template__origins {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
	}

	.origin-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.4);
		border: 2px solid rgba(148, 163, 184, 0.15);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.origin-card:hover {
		background: rgba(30, 41, 59, 0.6);
		border-color: rgba(148, 163, 184, 0.3);
		transform: translateY(-2px);
	}

	.origin-card.active {
		background: rgba(79, 70, 229, 0.2);
		border-color: rgba(79, 70, 229, 0.6);
	}

	.origin-card__icon {
		font-size: 2rem;
	}

	.origin-card__name {
		font-size: 0.9rem;
		font-weight: 500;
		color: #e2e8f0;
		text-align: center;
	}

	.calling-orb-template__editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	@media (max-width: 1024px) {
		.calling-orb-template__editor {
			grid-template-columns: 1fr;
		}
	}

	.calling-orb-template__preview {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.canvas-container {
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.5);
	}

	.canvas-preview {
		width: 100%;
		height: auto;
		display: block;
	}

	.canvas-placeholder {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #64748b;
		font-size: 0.95rem;
	}

	.calling-orb-template__controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.breakpoint-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.breakpoint-config {
		padding: 1rem;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.2);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.breakpoint-config__header {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.breakpoint-config__header h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.breakpoint-config__preview {
		font-size: 0.85rem;
		color: #94a3b8;
		font-style: italic;
	}

	.breakpoint-config__fields {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.field-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.75rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field label {
		font-size: 0.85rem;
		font-weight: 500;
		color: #94a3b8;
	}

	.field select,
	.field input[type='color'] {
		width: 100%;
	}

	.field input[type='color'] {
		height: 2.5rem;
		cursor: pointer;
		padding: 0.25rem;
	}

	.calling-orb-template__actions {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: flex-start;
	}

	.message {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.message--error {
		background: rgba(248, 113, 113, 0.15);
		border: 1px solid rgba(248, 113, 113, 0.3);
		color: #fca5a5;
	}

	.message--success {
		background: rgba(74, 222, 128, 0.15);
		border: 1px solid rgba(74, 222, 128, 0.3);
		color: #86efac;
	}
</style>
