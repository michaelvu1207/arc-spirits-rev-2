<script lang="ts">
// @ts-nocheck
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { DiceSideRow } from '$lib/types/gameData';
	import { generateDiceSide } from '$lib/generators/dice';
	import {
		fetchDiceRecords,
		type CustomDiceWithSides
	} from '$lib/features/dice/dice';
	import { processAndUploadImage } from '$lib/utils/storage';
	import { ImageUploader } from '$lib/components/shared';

	const gameAssetsStorage = supabase.storage.from('game_assets');

	let diceList: CustomDiceWithSides[] = [];
	let selectedDiceId: string | null = null;
	let error: string | null = null;
	let loading = true;
	let exportingDiceFaces = false;
	let showTemplateEditor = false;
	let templateImageUrl: string | null = null;
	let globalTemplateId: string | null = null;
	let templatePositions: Record<number, { x: number; y: number }> = {};
	let templateScale = 100;
	let generatingTemplate = false;
	let uploadingTemplate = false;
	let uploadingPrefab = false;

	let editingDice: CustomDiceWithSides | null = null;
	let activeDiceSideImages: Record<number, string> = {};
	let prefabUploadPath: string | null = null;

	// Reactive statement to generate images for active dice
	$: if (selectedDiceId) {
		const dice = currentDice();
		if (dice?.background_image_path) {
			void generateActiveDiceSideImages(dice);
		} else {
			activeDiceSideImages = {};
		}
	}

	onMount(async () => {
		await loadDice();
		await loadGlobalTemplate();
	});

	async function loadGlobalTemplate() {
		try {
			const { data, error } = await supabase
				.from('dice_templates')
				.select('*')
				.limit(1)
				.single();

			if (error && error.code !== 'PGRST116') {
				console.error('Error loading global template:', error);
				return;
			}

			if (data) {
				globalTemplateId = data.id;
				if (data.template_image_path) {
					const path = data.template_image_path.startsWith('dice_templates/')
						? data.template_image_path
						: `dice_templates/${data.template_image_path}`;
					const { data: urlData } = gameAssetsStorage.getPublicUrl(path);
					templateImageUrl = urlData?.publicUrl ?? null;
				} else {
					templateImageUrl = null;
				}

				if (data.template_positions && typeof data.template_positions === 'object') {
					const positions: Record<number, { x: number; y: number }> = {};
					for (const [sideNum, pos] of Object.entries(data.template_positions)) {
						if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos) {
							positions[parseInt(sideNum)] = { x: pos.x, y: pos.y };
						}
					}
					templatePositions = positions;
				} else {
					templatePositions = {};
				}

				if (data.template_scale !== null && data.template_scale !== undefined) {
					templateScale = data.template_scale;
				} else {
					templateScale = 100;
				}
			}
		} catch (err) {
			console.error('Failed to load global template:', err);
		}
	}

	async function loadDice() {
		loading = true;
		error = null;
		try {
			diceList = await fetchDiceRecords();
			if (diceList.length && !selectedDiceId) {
				selectedDiceId = diceList[0].id;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	function currentDice(): CustomDiceWithSides | null {
		return diceList.find((dice) => dice.id === selectedDiceId) ?? null;
	}

	async function generateActiveDiceSideImages(dice: CustomDiceWithSides) {
		activeDiceSideImages = {};
		if (!dice.background_image_path) return;

		try {
			const path = dice.background_image_path.startsWith('dice_backgrounds/')
				? dice.background_image_path
				: `dice_backgrounds/${dice.background_image_path}`;
			const { data } = gameAssetsStorage.getPublicUrl(path);
			if (!data?.publicUrl) return;

			const newImages: Record<number, string> = {};
			for (const side of dice.dice_sides) {
				const text = dice.dice_type === 'attack'
					? side.reward_value
					: (side.reward_value || String(side.side_number));

				try {
					const imageUrl = await generateDiceSide({
						backgroundUrl: data.publicUrl,
						text: text,
						size: 800
					});
					newImages[side.side_number] = imageUrl;
				} catch (err) {
					console.warn(`Failed to generate side ${side.side_number}:`, err);
				}
			}
			activeDiceSideImages = newImages;
		} catch (err) {
			console.warn('Failed to generate active dice side images:', err);
		}
	}

	function sanitizeFileName(name: string): string {
		return name
			.replace(/[^a-z0-9]/gi, '_')
			.toLowerCase()
			.replace(/_+/g, '_')
			.replace(/^_|_$/g, '');
	}

	async function exportAllDiceFaces() {
		if (exportingDiceFaces) return;
		exportingDiceFaces = true;
		error = null;

		try {
			let successCount = 0;
			let errorCount = 0;

			for (const diceItem of diceList) {
				if (!diceItem.background_image_path) continue;

				try {
					const path = diceItem.background_image_path.startsWith('dice_backgrounds/')
						? diceItem.background_image_path
						: `dice_backgrounds/${diceItem.background_image_path}`;
					const { data } = gameAssetsStorage.getPublicUrl(path);
					if (!data?.publicUrl) continue;

					for (const side of diceItem.dice_sides) {
						try {
							const text = diceItem.dice_type === 'attack'
								? side.reward_value
								: (side.reward_value || String(side.side_number));

							const diceFaceDataUrl = await generateDiceSide({
								backgroundUrl: data.publicUrl,
								text: text,
								size: 800
							});

							const response = await fetch(diceFaceDataUrl);
							const blob = await response.blob();

							const sanitizedName = sanitizeFileName(diceItem.name);
							const fileName = `${sanitizedName}_side_${side.side_number}`;
							const folder = 'dice_faces';

							const { data: uploadData, error: uploadError } = await processAndUploadImage(blob, {
								folder,
								filename: fileName,
								cropTransparent: true,
								upsert: true
							});

							if (uploadError) {
								console.error(`Failed to upload dice face for ${diceItem.name} side ${side.side_number}:`, uploadError);
								errorCount++;
							} else {
								const { error: updateError } = await supabase
									.from('dice_sides')
									.update({ image_path: uploadData?.path })
									.eq('id', side.id);

								if (updateError) {
									console.error(`Failed to update dice side ${side.id}:`, updateError);
									errorCount++;
								} else {
									successCount++;
								}
							}
						} catch (err) {
							console.error(`Error exporting dice face for ${diceItem.name} side ${side.side_number}:`, err);
							errorCount++;
						}
					}
				} catch (err) {
					console.error(`Error processing dice ${diceItem.name}:`, err);
					errorCount++;
				}
			}

			if (errorCount > 0) {
				error = `Exported ${successCount} dice faces, ${errorCount} errors occurred.`;
			} else {
				error = null;
				alert(`Successfully exported ${successCount} dice faces!`);
			}

			await loadDice();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to export dice faces';
			console.error('Error exporting dice faces:', err);
		} finally {
			exportingDiceFaces = false;
		}
	}

	async function openTemplateEditor(dice?: CustomDiceWithSides) {
		const diceToEdit = dice || currentDice();
		if (!diceToEdit) return;

		selectedDiceId = diceToEdit.id;
		editingDice = diceToEdit;

		await loadGlobalTemplate();

		if (diceToEdit.background_image_path) {
			await generateActiveDiceSideImages(diceToEdit);
		} else {
			activeDiceSideImages = {};
		}

		showTemplateEditor = true;
	}

	async function handleTemplateUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}

		uploadingTemplate = true;
		try {
			if (!globalTemplateId) {
				const { data: newTemplate, error: createError } = await supabase
					.from('dice_templates')
					.insert({ template_image_path: null })
					.select()
					.single();

				if (createError) {
					throw createError;
				}
				globalTemplateId = newTemplate.id;
			}

			const { data: currentTemplate } = await supabase
				.from('dice_templates')
				.select('template_image_path')
				.eq('id', globalTemplateId)
				.single();

			if (currentTemplate?.template_image_path) {
				const oldPath = currentTemplate.template_image_path.startsWith('dice_templates/')
					? currentTemplate.template_image_path
					: `dice_templates/${currentTemplate.template_image_path}`;
				await gameAssetsStorage.remove([oldPath]);
			}

			const fileName = 'global_dice_template';
			const folder = 'dice_templates';

			const { data, error: uploadError } = await processAndUploadImage(file, {
				folder,
				filename: fileName,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) {
				throw uploadError;
			}

			const uploadedPath = data?.path ?? '';

			const { error: updateError } = await supabase
				.from('dice_templates')
				.update({ template_image_path: uploadedPath })
				.eq('id', globalTemplateId);

			if (updateError) {
				throw updateError;
			}

			const { data: urlData } = gameAssetsStorage.getPublicUrl(uploadedPath);
			templateImageUrl = urlData?.publicUrl ?? null;
		} catch (err) {
			console.error(err);
			alert('Failed to upload template. Please try again.');
		} finally {
			uploadingTemplate = false;
			target.value = '';
		}
	}

	function updateTemplatePosition(sideNumber: number, x: number, y: number) {
		templatePositions[sideNumber] = { x, y };
		templatePositions = { ...templatePositions };
	}

	async function saveTemplatePositions() {
		if (!globalTemplateId) {
			alert('Template not initialized. Please upload a template image first.');
			return;
		}

		try {
			const positionsJson: Record<string, { x: number; y: number }> = {};
			for (const [sideNum, pos] of Object.entries(templatePositions)) {
				if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos) {
					positionsJson[sideNum] = { x: pos.x, y: pos.y };
				}
			}

			const { error } = await supabase
				.from('dice_templates')
				.update({
					template_positions: positionsJson,
					template_scale: templateScale
				})
				.eq('id', globalTemplateId);

			if (error) {
				throw error;
			}

			await loadGlobalTemplate();
			alert('Template positions and scale saved! These will be used as defaults for all dice.');
		} catch (err) {
			console.error('Failed to save template positions:', err);
			alert('Failed to save template positions.');
		}
	}

	async function generateTemplateCanvas(): Promise<HTMLCanvasElement | null> {
		if (!editingDice || !templateImageUrl) {
			return null;
		}

		const templateImg = new Image();
		templateImg.crossOrigin = 'anonymous';
		await new Promise((resolve, reject) => {
			templateImg.onload = resolve;
			templateImg.onerror = reject;
			templateImg.src = templateImageUrl!;
		});

		const displayedImg = document.getElementById('template-image') as HTMLImageElement;
		let scaleX = 1;
		let scaleY = 1;

		if (displayedImg) {
			const displayedRect = displayedImg.getBoundingClientRect();
			scaleX = templateImg.width / displayedRect.width;
			scaleY = templateImg.height / displayedRect.height;
		}

		const canvas = document.createElement('canvas');
		canvas.width = templateImg.width;
		canvas.height = templateImg.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get canvas context');

		ctx.drawImage(templateImg, 0, 0);

		if (!editingDice.background_image_path) {
			return canvas;
		}

		const bgPath = editingDice.background_image_path.startsWith('dice_backgrounds/')
			? editingDice.background_image_path
			: `dice_backgrounds/${editingDice.background_image_path}`;
		const { data: bgData } = gameAssetsStorage.getPublicUrl(bgPath);
		if (!bgData?.publicUrl) {
			return canvas;
		}

		for (const side of editingDice.dice_sides) {
			const position = templatePositions[side.side_number];
			if (!position) continue;

			try {
				const text = editingDice.dice_type === 'attack'
					? side.reward_value
					: (side.reward_value || String(side.side_number));

				const diceFaceDataUrl = await generateDiceSide({
					backgroundUrl: bgData.publicUrl,
					text: text,
					size: 800
				});

				const diceFaceImg = new Image();
				diceFaceImg.crossOrigin = 'anonymous';
				await new Promise((resolve, reject) => {
					diceFaceImg.onload = resolve;
					diceFaceImg.onerror = reject;
					diceFaceImg.src = diceFaceDataUrl;
				});

				const scaledX = position.x * scaleX;
				const scaledY = position.y * scaleY;

				const baseSize = 100;
				const scaledFaceSize = (templateScale / 100) * baseSize * scaleX;

				ctx.drawImage(diceFaceImg, scaledX, scaledY, scaledFaceSize, scaledFaceSize);
			} catch (err) {
				console.warn(`Failed to draw dice face for side ${side.side_number}:`, err);
			}
		}

		return canvas;
	}

	async function downloadTemplatePng() {
		if (!editingDice || !templateImageUrl) {
			alert('Please upload a template image first.');
			return;
		}

		generatingTemplate = true;
		try {
			const canvas = await generateTemplateCanvas();
			if (!canvas) {
				alert('Failed to generate template.');
				return;
			}

			canvas.toBlob((blob) => {
				if (!blob) {
					alert('Failed to generate image.');
					return;
				}

				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${sanitizeFileName(editingDice!.name)}_template.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
			}, 'image/png');
		} catch (err) {
			console.error('Failed to download template image:', err);
			alert('Failed to download template image.');
		} finally {
			generatingTemplate = false;
		}
	}

	async function generateTemplateImage() {
		if (!editingDice || !templateImageUrl) {
			alert('Please upload a template image first.');
			return;
		}

		generatingTemplate = true;
		try {
			const canvas = await generateTemplateCanvas();
			if (!canvas) {
				alert('Failed to generate template.');
				return;
			}

			canvas.toBlob(async (blob) => {
				if (!blob) {
					alert('Failed to generate image.');
					return;
				}

				try {
					const sanitizedDiceName = editingDice!.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
					const uploadFileName = `exported_template_${sanitizedDiceName}`;
					const folder = 'dice_templates';

					// IMPORTANT: cropTransparent: false to preserve the full template layout
					const { data: uploadData, error: uploadError } = await processAndUploadImage(blob, {
						folder,
						filename: uploadFileName,
						cropTransparent: false,
						upsert: true
					});

					if (uploadError) {
						throw uploadError;
					}

					const uploadedPath = uploadData?.path ?? '';

					if (globalTemplateId) {
						const { error: updateError } = await supabase
							.from('dice_templates')
							.update({ exported_template_path: uploadedPath })
							.eq('id', globalTemplateId);

						if (updateError) {
							console.warn('Failed to update exported template path:', updateError);
						}
					}

					if (editingDice!.id) {
						const { error: diceUpdateError } = await supabase
							.from('custom_dice')
							.update({ exported_template_path: uploadedPath })
							.eq('id', editingDice!.id);

						if (diceUpdateError) {
							console.warn('Failed to update dice exported template path:', diceUpdateError);
						} else {
							await loadDice();
						}
					}

					alert('Template image saved to database!');
				} catch (err) {
					console.error('Failed to save template image:', err);
					alert('Failed to save template image to storage.');
				}
			}, 'image/png');
		} catch (err) {
			console.error('Failed to generate template image:', err);
			alert('Failed to generate template image.');
		} finally {
			generatingTemplate = false;
		}
	}

	async function handlePrefabUpload(path: string) {
		if (!editingDice) return;

		uploadingPrefab = true;
		try {
			const { error: updateError } = await supabase
				.from('custom_dice')
				.update({ exported_template_path: path })
				.eq('id', editingDice.id);

			if (updateError) {
				throw updateError;
			}

			await loadDice();
			// Update the editing dice with the new path
			editingDice = { ...editingDice, exported_template_path: path };
			alert('Prefab image uploaded successfully!');
		} catch (err) {
			console.error('Failed to update dice prefab:', err);
			alert('Failed to save prefab to database.');
		} finally {
			uploadingPrefab = false;
		}
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Dice Gallery</h1>
			<p>Generate dice side images and templates from your custom dice.</p>
		</div>
		<div style="display: flex; gap: 0.5rem;">
			<button
				class="btn"
				type="button"
				onclick={exportAllDiceFaces}
				disabled={exportingDiceFaces || diceList.length === 0}
			>
				{exportingDiceFaces ? 'Exporting...' : 'Export All Dice Faces'}
			</button>
		</div>
	</header>

	{#if loading}
		<div class="card loading">Loading dice…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<div class="dice-row">
			{#each diceList as dice}
				<div
					class={`dice-panel ${selectedDiceId === dice.id ? 'dice-panel--selected' : ''}`}
					style={`border-color: ${dice.color ?? '#4a9eff'}`}
					role="button"
					tabindex="0"
					onclick={() => (selectedDiceId = dice.id)}
					onkeydown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							selectedDiceId = dice.id;
						}
					}}
				>
					<div class="dice-panel__icon">{dice.icon ?? '🎲'}</div>
					<div class="dice-panel__content">
						<h3>{dice.name}</h3>
						{#if dice.description}
							<p>{dice.description}</p>
						{/if}
						<div class="dice-panel__sides">
							{dice.dice_sides.length} sides
							{#if dice.exported_template_path}
								<span class="dice-panel__prefab-badge">📐 Prefab</span>
							{/if}
						</div>
					</div>
					<div class="dice-panel__actions">
						<button
							class="icon-btn"
							type="button"
							onclick={(event) => {
								event.stopPropagation();
								openTemplateEditor(dice);
							}}
							title="Edit template"
						>
							📐
						</button>
					</div>
				</div>
			{:else}
				<div class="card empty">No dice available. Create dice first.</div>
			{/each}
		</div>

		{#if selectedDiceId}
			{#key selectedDiceId}
				{@const activeDice = currentDice()}
				{#if activeDice}
					{#if activeDice.exported_template_path}
						{@const prefabPath = activeDice.exported_template_path.startsWith('dice_templates/')
							? activeDice.exported_template_path
							: `dice_templates/${activeDice.exported_template_path}`}
						{@const prefabUrl = gameAssetsStorage.getPublicUrl(prefabPath).data?.publicUrl}
						<div class="prefab-section">
							<h2>Prefab Template Image</h2>
							<div class="prefab-display">
								{#if prefabUrl}
									<img src={prefabUrl} alt="Prefab template for {activeDice.name}" class="prefab-image" />
								{:else}
									<div class="prefab-placeholder">
										<span>Prefab image not available</span>
									</div>
								{/if}
							</div>
						</div>
					{/if}
					<div class="dice-details">
						<h2>Generated Dice Sides</h2>
						<div class="sides-display">
							{#each activeDice.dice_sides
								.slice()
								.sort(
									(a: DiceSideRow, b: DiceSideRow) => a.side_number - b.side_number
								) as side}
								<div class="side-card">
									{#if activeDiceSideImages[side.side_number]}
										<img class="side-image" src={activeDiceSideImages[side.side_number]} alt={`Side ${side.side_number}`} />
									{:else}
										<div class="side-placeholder">
											<span>No background image</span>
										</div>
									{/if}
									<div class="side-content">
										<strong>Side {side.side_number}</strong>
										<p>{side.reward_value}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/key}
		{:else}
			<div class="card empty">Select a dice set to preview generated images.</div>
		{/if}
	{/if}

	{#if showTemplateEditor && editingDice}
		<div class="modal-layer">
			<button
				type="button"
				class="modal-overlay"
				aria-label="Close template editor"
				onclick={() => (showTemplateEditor = false)}
			></button>
			<div class="modal-content" role="dialog" aria-modal="true" tabindex="-1">
				<div class="modal-header">
					<div>
						<h2>Template Editor: {editingDice.name}</h2>
						<p style="color: #94a3b8; font-size: 0.85rem; margin: 0.25rem 0 0;">Template is shared by all dice</p>
					</div>
					<button class="icon-btn" onclick={() => (showTemplateEditor = false)}>✕</button>
				</div>

				<div class="template-editor">
					<div class="template-upload-section">
						<label>
							<span>Global Template Image (shared by all dice):</span>
							<input
								type="file"
								accept="image/*"
								onchange={handleTemplateUpload}
								disabled={uploadingTemplate}
							/>
							{#if uploadingTemplate}
								<span style="color: #94a3b8; font-size: 0.9rem; margin-left: 0.5rem;">Uploading...</span>
							{/if}
						</label>
						{#if templateImageUrl}
							<div class="template-preview-container">
								<p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 0.5rem;">
									Click on the template image to position each dice face, or use the coordinate inputs below.
								</p>
								<div
									class="template-preview"
									style="position: relative; display: inline-block;"
									role="button"
									tabindex="0"
									aria-label="Click to position dice faces"
									onclick={(e) => {
										const img = document.getElementById('template-image');
										if (!img) return;
										const rect = img.getBoundingClientRect();
										const x = e.clientX - rect.left;
										const y = e.clientY - rect.top;
										const sides = editingDice.dice_sides;
										const sideToPosition = sides.find((s) => !templatePositions[s.side_number]) || sides[0];
										if (sideToPosition) {
											const offset = (templateScale / 100) * 50;
											updateTemplatePosition(sideToPosition.side_number, x - offset, y - offset);
										}
									}}
									onkeydown={(e) => {
										if (e.key !== 'Enter' && e.key !== ' ') return;
										e.preventDefault();
										const img = document.getElementById('template-image');
										if (!img) return;
										const rect = img.getBoundingClientRect();
										const x = rect.width / 2;
										const y = rect.height / 2;
										const sides = editingDice.dice_sides;
										const sideToPosition = sides.find((s) => !templatePositions[s.side_number]) || sides[0];
										if (sideToPosition) {
											const offset = (templateScale / 100) * 50;
											updateTemplatePosition(sideToPosition.side_number, x - offset, y - offset);
										}
									}}
								>
									<img
										src={templateImageUrl}
										alt="Template"
										id="template-image"
										style="max-width: 100%; height: auto; cursor: crosshair;"
									/>
									{#each editingDice.dice_sides as side}
										{@const pos = templatePositions[side.side_number]}
										{@const faceUrl = activeDiceSideImages[side.side_number]}
										{@const faceSize = (templateScale / 100) * 100}
										{#if pos && faceUrl}
											<div
												class="dice-face-marker" role="button"
												style="position: absolute; left: {pos.x}px; top: {pos.y}px; width: {faceSize}px; height: {faceSize}px; border: 2px solid #3b82f6; cursor: move; background: rgba(59, 130, 246, 0.2); pointer-events: auto;"
												draggable="true"
												tabindex="0"
												ondrag={(e) => {
													const img = document.getElementById('template-image');
													if (img && e.clientX && e.clientY) {
														const rect = img.getBoundingClientRect();
														const offset = faceSize / 2;
														const x = e.clientX - rect.left - offset;
														const y = e.clientY - rect.top - offset;
														updateTemplatePosition(side.side_number, Math.max(0, x), Math.max(0, y));
													}
												}}
											>
												<img src={faceUrl} alt="Side {side.side_number}" style="width: 100%; height: 100%; object-fit: contain;" />
												<span style="position: absolute; bottom: -20px; left: 0; background: rgba(0,0,0,0.7); color: white; padding: 2px 4px; font-size: 10px; white-space: nowrap;">Side {side.side_number}</span>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<div class="template-controls-section">
						<div class="template-scale-control">
							<label>
								<span>Scale (%):</span>
								<input
									type="range"
									min="50"
									max="500"
									step="5"
									value={templateScale}
									oninput={(e) => {
										templateScale = parseInt(e.currentTarget.value) || 100;
									}}
									onchange={async () => {
										if (globalTemplateId) {
											try {
												const { error } = await supabase
													.from('dice_templates')
													.update({ template_scale: templateScale })
													.eq('id', globalTemplateId);
												if (error) {
													console.warn('Failed to auto-save scale:', error);
												}
											} catch (err) {
												console.warn('Failed to auto-save scale:', err);
											}
										}
									}}
								/>
								<span class="scale-value">{templateScale}%</span>
							</label>
						</div>
					</div>

					<div class="template-positions-section">
						<h3>Position Dice Faces</h3>
						<div class="position-inputs">
							{#each editingDice.dice_sides as side}
								<div class="position-input-row">
									<span class="side-label">Side {side.side_number}:</span>
									<div class="coordinate-inputs">
										<input
											type="number"
											placeholder="X"
											value={templatePositions[side.side_number]?.x ?? ''}
											oninput={(e) => {
												const x = parseInt(e.currentTarget.value) || 0;
												const y = templatePositions[side.side_number]?.y ?? 0;
												updateTemplatePosition(side.side_number, x, y);
											}}
										/>
										<input
											type="number"
											placeholder="Y"
											value={templatePositions[side.side_number]?.y ?? ''}
											oninput={(e) => {
												const x = templatePositions[side.side_number]?.x ?? 0;
												const y = parseInt(e.currentTarget.value) || 0;
												updateTemplatePosition(side.side_number, x, y);
											}}
										/>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<div class="prefab-upload-section">
						<h3>Manual Prefab Upload</h3>
						<p class="section-hint">Upload a pre-made prefab image directly instead of generating one.</p>
						<ImageUploader
							value={editingDice.exported_template_path}
							folder={`dice_templates/prefabs/${editingDice.id}`}
							maxSizeMB={50}
							cropTransparent={false}
							onupload={handlePrefabUpload}
							onerror={(err) => alert(`Upload failed: ${err}`)}
						/>
					</div>

					<div class="modal-actions">
						<button class="btn" onclick={saveTemplatePositions}>Save Positions</button>
						<button
							class="btn"
							onclick={downloadTemplatePng}
							disabled={generatingTemplate || !templateImageUrl}
						>
							{generatingTemplate ? 'Generating...' : '📥 Download PNG'}
						</button>
						<button
							class="btn btn--primary"
							onclick={generateTemplateImage}
							disabled={generatingTemplate || !templateImageUrl}
						>
							{generatingTemplate ? 'Saving...' : '💾 Save to Database'}
						</button>
						<button class="btn" onclick={() => (showTemplateEditor = false)}>Close</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.dice-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.75rem;
	}

	.dice-panel {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.6rem;
		align-items: center;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.65);
		border: 2px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.dice-panel:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 16px rgba(15, 23, 42, 0.35);
	}

	.dice-panel--selected {
		border-width: 2px;
		box-shadow: 0 12px 20px rgba(59, 130, 246, 0.35);
	}

	.dice-panel__icon {
		font-size: 1.8rem;
	}

	.dice-panel__content h3 {
		margin: 0;
		color: #f8fafc;
		font-size: 1rem;
	}

	.dice-panel__content p {
		margin: 0.2rem 0 0;
		color: #cbd5f5;
		font-size: 0.85rem;
	}

	.dice-panel__sides {
		margin-top: 0.4rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #94a3b8;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dice-panel__prefab-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.15rem 0.4rem;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.4);
		border-radius: 4px;
		font-size: 0.65rem;
		color: #60a5fa;
		text-transform: none;
		letter-spacing: normal;
	}

	.dice-panel__actions {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.icon-btn {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 8px;
		color: inherit;
		cursor: pointer;
		padding: 0.25rem 0.45rem;
		transition: background 0.15s ease;
	}

	.icon-btn:hover {
		background: rgba(59, 130, 246, 0.2);
	}

	.prefab-section {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin-bottom: 1.5rem;
	}

	.prefab-section h2 {
		margin: 0;
		color: #f8fafc;
		font-size: 1.1rem;
	}

	.prefab-display {
		background: rgba(30, 41, 59, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.prefab-image {
		max-width: 100%;
		max-height: 600px;
		object-fit: contain;
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.prefab-placeholder {
		padding: 3rem;
		color: #94a3b8;
		font-size: 0.9rem;
		text-align: center;
	}

	.dice-details {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.sides-display {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.6rem;
	}

	.side-card {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem;
		border-radius: 10px;
		background: rgba(30, 41, 59, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.side-image {
		width: 80px;
		height: 80px;
		object-fit: cover;
		border-radius: 8px;
	}

	.side-placeholder {
		width: 80px;
		height: 80px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.6);
		border-radius: 8px;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		font-size: 0.7rem;
		color: #94a3b8;
		text-align: center;
		padding: 0.5rem;
	}

	.side-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.btn--primary {
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		border: none;
		color: #f8fafc;
	}

	.modal-layer {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
	}

	.modal-content {
		position: relative;
		z-index: 1;
		background: #1e293b;
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		max-width: 90vw;
		max-height: 90vh;
		overflow: auto;
		width: 100%;
		max-width: 1200px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.modal-header > div {
		flex: 1;
	}

	.modal-header h2 {
		margin: 0;
		color: #f8fafc;
	}

	.template-editor {
		padding: 1.5rem;
	}

	.template-upload-section {
		margin-bottom: 2rem;
	}

	.template-upload-section label {
		display: block;
		margin-bottom: 1rem;
		color: #cbd5f5;
	}

	.template-preview-container {
		margin-top: 1rem;
	}

	.template-preview {
		display: inline-block;
		position: relative;
	}

	.dice-face-marker {
		pointer-events: auto;
		user-select: none;
	}

	.template-controls-section {
		margin-bottom: 2rem;
		padding: 1rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.template-scale-control {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.template-scale-control label {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex: 1;
		color: #cbd5f5;
	}

	.template-scale-control input[type="range"] {
		flex: 1;
		max-width: 300px;
	}

	.scale-value {
		min-width: 50px;
		text-align: right;
		font-weight: 600;
		color: #f8fafc;
	}

	.template-positions-section {
		margin-bottom: 2rem;
	}

	.template-positions-section h3 {
		color: #f8fafc;
		margin-bottom: 1rem;
	}

	.position-inputs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.position-input-row {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.side-label {
		color: #cbd5f5;
		font-size: 0.9rem;
		font-weight: 500;
		margin: 0;
	}

	.coordinate-inputs {
		display: flex;
		gap: 0.5rem;
	}

	.coordinate-inputs input {
		flex: 1;
		padding: 0.5rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.coordinate-inputs input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}

	.prefab-upload-section {
		margin-bottom: 2rem;
		padding: 1rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.prefab-upload-section h3 {
		color: #f8fafc;
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
	}

	.section-hint {
		color: #94a3b8;
		font-size: 0.85rem;
		margin: 0 0 1rem 0;
	}

	.modal-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		flex-wrap: wrap;
	}
</style>
