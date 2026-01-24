<script lang="ts">
	import { Button } from '$lib/components/ui';
	import { createCanvas, getContext, loadImage, canvasToBlob } from '$lib/generators/shared/canvas';
	import type { IconPoolRow } from '$lib/types/gameData';
	import { downloadFile } from '$lib/utils/download';

	type Props = {
		icons: IconPoolRow[];
		publicUrl: (path: string) => string;
	};

	let { icons, publicUrl }: Props = $props();

	// Map icons to display format with URLs
	const allIcons = $derived(
		icons.map((i) => ({
			id: i.id,
			name: i.name,
			url: publicUrl(i.file_path),
			source: i.source_type
		}))
	);

	// State
	let selectedBackgroundFile: File | null = $state(null);
	let selectedBackgroundUrl: string | null = $state(null);
	let selectedIcons: Set<string> = $state(new Set());
	let dragActive = $state(false);
	let generating = $state(false);
	let progress = $state('');

	// Placement settings
	let iconSize = $state(200);
	let iconX = $state(50);
	let iconY = $state(50);
	let canvasWidth = $state(512);
	let canvasHeight = $state(512);

	// Title settings
	let showTitle = $state(false);
	let titleText = $state('');
	let titleX = $state(256);
	let titleY = $state(450);
	let titleFontSize = $state(32);
	let titleColor = $state('#ffffff');
	let titleFontWeight = $state('bold');
	let titleAlign = $state<'left' | 'center' | 'right'>('center');

	// Preview state
	let previewUrl: string | null = $state(null);

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

	// Handle background file selection
	function onBackgroundChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			selectedBackgroundFile = file;
			selectedBackgroundUrl = URL.createObjectURL(file);
			updatePreview();
		}
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragActive = false;
		const file = event.dataTransfer?.files?.[0];
		if (file && file.type.startsWith('image/')) {
			selectedBackgroundFile = file;
			selectedBackgroundUrl = URL.createObjectURL(file);
			updatePreview();
		}
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		dragActive = true;
	}

	function onDragLeave(event: DragEvent) {
		event.preventDefault();
		dragActive = false;
	}

	// Toggle icon selection
	function toggleIcon(iconId: string) {
		if (selectedIcons.has(iconId)) {
			selectedIcons.delete(iconId);
		} else {
			selectedIcons.add(iconId);
		}
		selectedIcons = new Set(selectedIcons); // Trigger reactivity
	}

	// Select all icons
	function selectAll() {
		selectedIcons = new Set(allIcons.map(i => i.id));
	}

	// Clear selection
	function clearSelection() {
		selectedIcons = new Set();
	}

	// Update preview when settings change
	async function updatePreview() {
		if (!selectedBackgroundUrl || selectedIcons.size === 0) {
			previewUrl = null;
			return;
		}

		try {
			// Use first selected icon for preview
			const firstIconId = Array.from(selectedIcons)[0];
			const firstIcon = allIcons.find(i => i.id === firstIconId);
			if (!firstIcon) return;

			const blob = await generateGraphic(selectedBackgroundUrl, firstIcon.url, firstIcon.name);
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = URL.createObjectURL(blob);
		} catch (error) {
			console.error('Preview generation failed:', error);
		}
	}

	// Generate single graphic
	async function generateGraphic(backgroundUrl: string, iconUrl: string, iconName?: string): Promise<Blob> {
		const canvas = createCanvas(canvasWidth, canvasHeight);
		const ctx = getContext(canvas);

		// Load images
		const bgImage = await loadImage(backgroundUrl);
		const iconImage = await loadImage(iconUrl);

		// Draw background (scaled to fit canvas)
		ctx.drawImage(bgImage, 0, 0, canvasWidth, canvasHeight);

		// Draw icon at specified position and size
		drawImageContain(ctx, iconImage, iconX, iconY, iconSize, iconSize);

		// Draw title if enabled
		if (showTitle && titleText) {
			const displayText = titleText.replace('{name}', iconName || '');

			ctx.font = `${titleFontWeight} ${titleFontSize}px sans-serif`;
			ctx.fillStyle = titleColor;
			ctx.textAlign = titleAlign;
			ctx.textBaseline = 'top';

			// Add text shadow for better readability
			ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
			ctx.shadowBlur = 4;
			ctx.shadowOffsetX = 2;
			ctx.shadowOffsetY = 2;

			ctx.fillText(displayText, titleX, titleY);

			// Reset shadow
			ctx.shadowColor = 'transparent';
			ctx.shadowBlur = 0;
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
		}

		return await canvasToBlob(canvas, 'image/png');
	}

	// Batch export all selected icons
	async function batchExport() {
		if (!selectedBackgroundUrl || selectedIcons.size === 0) {
			alert('Please select a background and at least one icon');
			return;
		}

		generating = true;
		progress = '';

		try {
			const selectedIconList = allIcons.filter(i => selectedIcons.has(i.id));

			for (let i = 0; i < selectedIconList.length; i++) {
				const icon = selectedIconList[i];
				progress = `Generating ${i + 1}/${selectedIconList.length}: ${icon.name}`;

				const blob = await generateGraphic(selectedBackgroundUrl, icon.url, icon.name);
				const filename = `tts_${icon.name}.png`;
				downloadFile(blob, filename);

				// Small delay to prevent browser blocking multiple downloads
				if (i < selectedIconList.length - 1) {
					await new Promise(resolve => setTimeout(resolve, 100));
				}
			}

			progress = `✅ Successfully exported ${selectedIconList.length} graphics`;
			setTimeout(() => {
				progress = '';
			}, 3000);
		} catch (error) {
			console.error('Batch export failed:', error);
			progress = `❌ Export failed: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			generating = false;
		}
	}

	// Update preview when settings change
	$effect(() => {
		if (selectedBackgroundUrl && selectedIcons.size > 0) {
			updatePreview();
		}
	});

	// Update preview when title settings change
	$effect(() => {
		// Track all title-related dependencies
		void showTitle;
		void titleText;
		void titleX;
		void titleY;
		void titleFontSize;
		void titleColor;
		void titleFontWeight;
		void titleAlign;

		if (selectedBackgroundUrl && selectedIcons.size > 0) {
			updatePreview();
		}
	});
</script>

<div class="tts-graphics-container">
	<!-- Background Selection -->
	<section class="config-section">
		<h3>Background Image</h3>
		<div
			class="dropzone"
			class:drag-active={dragActive}
			role="button"
			tabindex="0"
			ondrop={onDrop}
			ondragover={onDragOver}
			ondragleave={onDragLeave}
		>
			{#if selectedBackgroundUrl}
				<img src={selectedBackgroundUrl} alt="Background preview" class="background-preview" />
				<p class="upload-hint">Click to change background</p>
			{:else}
				<p>Drag & drop background image or click to select</p>
			{/if}
			<input type="file" accept="image/*" onchange={onBackgroundChange} />
		</div>
	</section>

	<!-- Placement Settings -->
	<section class="config-section">
		<h3>Icon Placement Settings</h3>
		<div class="settings-grid">
			<div class="setting-row">
				<label for="canvas-width">Canvas Width (px)</label>
				<input type="number" id="canvas-width" bind:value={canvasWidth} min="1" max="4096" />
			</div>
			<div class="setting-row">
				<label for="canvas-height">Canvas Height (px)</label>
				<input type="number" id="canvas-height" bind:value={canvasHeight} min="1" max="4096" />
			</div>
			<div class="setting-row">
				<label for="icon-size">Icon Size (px)</label>
				<input type="number" id="icon-size" bind:value={iconSize} min="1" max="2048" />
			</div>
			<div class="setting-row">
				<label for="icon-x">Icon X Position (px)</label>
				<input type="number" id="icon-x" bind:value={iconX} min="0" max={canvasWidth} />
			</div>
			<div class="setting-row">
				<label for="icon-y">Icon Y Position (px)</label>
				<input type="number" id="icon-y" bind:value={iconY} min="0" max={canvasHeight} />
			</div>
		</div>
	</section>

	<!-- Title Settings -->
	<section class="config-section">
		<div class="section-header">
			<h3>Title Settings</h3>
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={showTitle} />
				<span>Enable Title</span>
			</label>
		</div>
		{#if showTitle}
			<div class="settings-grid">
				<div class="setting-row full-width">
					<label for="title-text">Title Text (use {'{name}'} for icon name)</label>
					<input type="text" id="title-text" bind:value={titleText} placeholder="e.g., {'{name}'} Token" />
				</div>
				<div class="setting-row">
					<label for="title-x">Title X Position (px)</label>
					<input type="number" id="title-x" bind:value={titleX} min="0" max={canvasWidth} />
				</div>
				<div class="setting-row">
					<label for="title-y">Title Y Position (px)</label>
					<input type="number" id="title-y" bind:value={titleY} min="0" max={canvasHeight} />
				</div>
				<div class="setting-row">
					<label for="title-font-size">Font Size (px)</label>
					<input type="number" id="title-font-size" bind:value={titleFontSize} min="8" max="200" />
				</div>
				<div class="setting-row">
					<label for="title-color">Color</label>
					<input type="color" id="title-color" bind:value={titleColor} />
				</div>
				<div class="setting-row">
					<label for="title-font-weight">Font Weight</label>
					<select id="title-font-weight" bind:value={titleFontWeight}>
						<option value="normal">Normal</option>
						<option value="bold">Bold</option>
						<option value="lighter">Light</option>
					</select>
				</div>
				<div class="setting-row">
					<label for="title-align">Text Align</label>
					<select id="title-align" bind:value={titleAlign}>
						<option value="left">Left</option>
						<option value="center">Center</option>
						<option value="right">Right</option>
					</select>
				</div>
			</div>
		{/if}
	</section>

	<!-- Preview -->
	{#if previewUrl}
		<section class="config-section">
			<h3>Preview</h3>
			<div class="preview-container">
				<img src={previewUrl} alt="Preview" class="preview-image" />
			</div>
		</section>
	{/if}

	<!-- Icon Selection -->
	<section class="config-section">
		<div class="section-header">
			<h3>Select Icons ({selectedIcons.size} selected)</h3>
			<div class="selection-actions">
				<button class="link-button" onclick={selectAll}>Select All</button>
				<button class="link-button" onclick={clearSelection}>Clear</button>
			</div>
		</div>
		<div class="icons-grid">
			{#each allIcons as icon (icon.id)}
				<button
					class="icon-card"
					class:selected={selectedIcons.has(icon.id)}
					onclick={() => toggleIcon(icon.id)}
				>
					<img src={icon.url} alt={icon.name} />
					<span class="icon-name">{icon.name}</span>
				</button>
			{/each}
		</div>
	</section>

	<!-- Export Actions -->
	<section class="config-section">
		<div class="export-actions">
			<Button
				variant="primary"
				onclick={batchExport}
				disabled={generating || !selectedBackgroundUrl || selectedIcons.size === 0}
			>
				{generating ? 'Exporting...' : `Export ${selectedIcons.size} Graphics`}
			</Button>
		</div>
		{#if progress}
			<p class="progress-text">{progress}</p>
		{/if}
	</section>
</div>

<style>
	.tts-graphics-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.config-section {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 10px;
		padding: 1rem;
	}

	.config-section h3 {
		margin: 0 0 0.75rem 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.section-header h3 {
		margin: 0;
	}

	.selection-actions {
		display: flex;
		gap: 0.5rem;
	}

	.link-button {
		background: none;
		border: none;
		color: #818cf8;
		font-size: 0.75rem;
		cursor: pointer;
		text-decoration: underline;
		padding: 0;
	}

	.link-button:hover {
		color: #a5b4fc;
	}

	.dropzone {
		border: 2px dashed rgba(148, 163, 184, 0.3);
		padding: 1.5rem;
		text-align: center;
		border-radius: 8px;
		position: relative;
		transition: all 0.2s ease;
		min-height: 200px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.dropzone.drag-active {
		background: rgba(79, 70, 229, 0.08);
		border-color: rgba(129, 140, 248, 0.4);
	}

	.dropzone p {
		margin: 0.25rem 0;
		color: #cbd5e1;
		font-size: 0.75rem;
	}

	.upload-hint {
		font-size: 0.7rem;
		color: #94a3b8;
		margin-top: 0.5rem;
	}

	.dropzone input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.background-preview {
		max-width: 100%;
		max-height: 150px;
		object-fit: contain;
		border-radius: 6px;
	}

	.settings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
	}

	.setting-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.setting-row.full-width {
		grid-column: 1 / -1;
	}

	.setting-row label {
		font-size: 0.7rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.setting-row input[type='number'],
	.setting-row input[type='text'],
	.setting-row input[type='color'],
	.setting-row select {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		padding: 0.5rem;
		color: #e2e8f0;
		font-size: 0.75rem;
	}

	.setting-row input[type='color'] {
		height: 40px;
		cursor: pointer;
	}

	.setting-row input:focus,
	.setting-row select:focus {
		outline: none;
		border-color: #6366f1;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: #cbd5e1;
		cursor: pointer;
	}

	.checkbox-label input[type='checkbox'] {
		cursor: pointer;
		width: 16px;
		height: 16px;
	}

	.checkbox-label span {
		user-select: none;
	}

	.preview-container {
		display: flex;
		justify-content: center;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
		border-radius: 8px;
	}

	.preview-image {
		max-width: 100%;
		max-height: 400px;
		object-fit: contain;
		border-radius: 6px;
	}

	.icons-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.5rem;
		max-height: 400px;
		overflow-y: auto;
	}

	.icon-card {
		background: rgba(30, 41, 59, 0.5);
		border: 2px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		padding: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.icon-card:hover {
		background: rgba(30, 41, 59, 0.8);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.icon-card.selected {
		background: rgba(79, 70, 229, 0.2);
		border-color: #6366f1;
	}

	.icon-card img {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	.icon-name {
		font-size: 0.65rem;
		color: #cbd5e1;
		text-align: center;
		word-break: break-word;
		line-height: 1.2;
	}

	.export-actions {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}

	.progress-text {
		margin-top: 0.5rem;
		text-align: center;
		font-size: 0.75rem;
		color: #cbd5e1;
	}
</style>
