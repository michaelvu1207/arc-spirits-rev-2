<script lang="ts">
// @ts-nocheck
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { DiceSideRow } from '$lib/types/gameData';
	import { EditorModal } from '$lib';
	import { generateDiceSide } from '$lib/generators/dice';
	import {
		DICE_TYPE_ICONS,
		DICE_TYPE_LABELS,
		createInitialForm,
		deleteDiceRecord,
		fetchDiceRecords,
		normalizeSides,
		saveDiceRecord,
		toFormData,
		type CustomDiceWithSides,
		type DiceFormData,
		type DiceType
	} from '$lib/features/dice/dice';
	import { processAndUploadImage, deleteStorageFile } from '$lib/utils/storage';

	const gameAssetsStorage = supabase.storage.from('game_assets');

	let diceList: CustomDiceWithSides[] = [];
	let selectedDiceId: string | null = null;
	let numberOfDice = 1;
	let isRolling = false;
	let results: DiceSideRow[] = [];
	let error: string | null = null;
	let loading = true;
	let exportingDiceFaces = false;
	let showTemplateEditor = false;
	let templateImageUrl: string | null = null;
	let globalTemplateId: string | null = null;
	let templatePositions: Record<number, { x: number; y: number }> = {};
	let templateScale = 100; // Scale percentage (100 = 100px base size)
	let generatingTemplate = false;
	let uploadingTemplate = false;

let showEditor = false;
let editingDice: CustomDiceWithSides | null = null;

let formData: DiceFormData = createInitialForm();
let diceBackgroundUrl: string | null = null;
let uploadingBackground = false;
let sideImageUrls: Record<number, string> = {};
let resultSideImages: Record<number, string> = {};
let activeDiceSideImages: Record<number, string> = {};

type AttackStats = { mean: number; sd: number } | null;

// Reactive statement to generate side images when background or sides change
$: if (diceBackgroundUrl && formData.dice_sides) {
	void generateAllSideImages();
}

// Reactive statement to generate images for active dice
$: if (selectedDiceId) {
	const dice = currentDice();
	if (dice?.background_image_path) {
		void generateActiveDiceSideImages(dice);
	} else {
		activeDiceSideImages = {};
	}
}

// Reactive statement to generate images for results
$: if (results.length && selectedDiceId) {
	const dice = currentDice();
	if (dice?.background_image_path) {
		void generateResultSideImages(dice);
	} else {
		resultSideImages = {};
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

			if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
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
				
				// Load global template positions
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
				
				// Load global template scale
				if (data.template_scale !== null && data.template_scale !== undefined) {
					templateScale = data.template_scale;
				} else {
					templateScale = 100; // Default
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

	async function rollDice() {
		const dice = currentDice();
		if (!dice || dice.dice_sides.length === 0) return;
		if (isRolling) return;

		isRolling = true;
		const rolled: DiceSideRow[] = [];
		for (let i = 0; i < numberOfDice; i += 1) {
			const idx = Math.floor(Math.random() * dice.dice_sides.length);
			rolled.push(dice.dice_sides[idx]);
		}

		await new Promise((resolve) => setTimeout(resolve, 400));
		results = rolled;
		isRolling = false;
	}

function openCreate() {
	editingDice = null;
	formData = createInitialForm();
	diceBackgroundUrl = null;
	sideImageUrls = {};
	showEditor = true;
}

async function openEdit(dice: CustomDiceWithSides) {
	editingDice = dice;
	formData = toFormData(dice);
	await loadDiceBackground();
	await generateAllSideImages();
	showEditor = true;
}

async function loadDiceBackground() {
	if (!formData.background_image_path) {
		diceBackgroundUrl = null;
		return;
	}

	try {
		const path = formData.background_image_path.startsWith('dice_backgrounds/')
			? formData.background_image_path
			: `dice_backgrounds/${formData.background_image_path}`;
		const { data } = gameAssetsStorage.getPublicUrl(path);
		if (data) {
			diceBackgroundUrl = data.publicUrl;
		}
	} catch (err) {
		console.warn('Failed to load dice background:', err);
		diceBackgroundUrl = null;
	}
}

async function generateAllSideImages() {
	sideImageUrls = {};
	if (!diceBackgroundUrl || !formData.dice_sides) return;

	for (const side of formData.dice_sides) {
		// For attack dice, use the numeric value; for special dice, use the text
		const text = formData.dice_type === 'attack' 
			? side.reward_value 
			: (side.reward_value || String(side.side_number));
		
			try {
				const imageUrl = await generateDiceSide({
					backgroundUrl: diceBackgroundUrl,
					text: text,
					size: 800
				});
				sideImageUrls = { ...sideImageUrls, [side.side_number]: imageUrl };
		} catch (err) {
			console.warn(`Failed to generate side ${side.side_number}:`, err);
		}
	}
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
			// For attack dice, use the numeric value; for special dice, use the text
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

async function generateResultSideImages(dice: CustomDiceWithSides) {
	resultSideImages = {};
	if (!dice.background_image_path) return;

	try {
		const path = dice.background_image_path.startsWith('dice_backgrounds/')
			? dice.background_image_path
			: `dice_backgrounds/${dice.background_image_path}`;
		const { data } = gameAssetsStorage.getPublicUrl(path);
		if (!data?.publicUrl) return;

		const newImages: Record<number, string> = {};
		for (const side of results) {
			// For attack dice, use the numeric value; for special dice, use the text
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
				console.warn(`Failed to generate result side ${side.side_number}:`, err);
			}
		}
		resultSideImages = newImages;
	} catch (err) {
		console.warn('Failed to generate result side images:', err);
	}
}

async function handleBackgroundUpload(event: Event) {
	const target = event.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file) return;

	if (!file.type.startsWith('image/')) {
		alert('Please select an image file.');
		return;
	}

	if (file.size > 10 * 1024 * 1024) {
		alert('Image must be smaller than 10MB.');
		return;
	}

	uploadingBackground = true;
	try {
		// Remove old background if it exists
		if (formData.background_image_path) {
			const oldPath = formData.background_image_path.startsWith('dice_backgrounds/')
				? formData.background_image_path
				: `dice_backgrounds/${formData.background_image_path}`;
			await gameAssetsStorage.remove([oldPath]);
		}

		// Generate filename based on dice name or ID
		const diceId = formData.id ?? 'new';
		const fileName = `dice_${diceId}_background`;
		const folder = 'dice_backgrounds';

		// Upload new background with transparent area cropping
		const { data, error: uploadError } = await processAndUploadImage(file, {
			folder,
			filename: fileName,
			cropTransparent: true,
			upsert: true
		});

		if (uploadError) {
			throw uploadError;
		}

		// Update form data
		formData.background_image_path = data?.path ?? '';
		await loadDiceBackground();
		await generateAllSideImages();
	} catch (err) {
		console.error(err);
		alert('Failed to upload background. Please try again.');
	} finally {
		uploadingBackground = false;
		// Reset file input
		target.value = '';
	}
}

async function removeBackground() {
	if (!confirm('Remove the dice background? Sides will use default styling.')) {
		return;
	}

	try {
		if (formData.background_image_path) {
			const path = formData.background_image_path.startsWith('dice_backgrounds/')
				? formData.background_image_path
				: `dice_backgrounds/${formData.background_image_path}`;
			const { error } = await gameAssetsStorage.remove([path]);
			if (error) throw error;
		}

		formData.background_image_path = null;
		diceBackgroundUrl = null;
		sideImageUrls = {};
	} catch (err) {
		console.error(err);
		alert('Failed to remove background. Please try again.');
	}
}

function setDiceType(type: DiceType) {
	formData = {
		...formData,
		dice_type: type,
		dice_sides: normalizeSides(type, formData.dice_sides)
	};
}

async function updateSideValue(index: number, value: string) {
	if (!formData.dice_sides) return;
	const updated = [...formData.dice_sides];
	updated[index] = { ...updated[index], reward_value: value };
	formData = { ...formData, dice_sides: updated };
	// Regenerate side images if background exists
	if (diceBackgroundUrl) {
		await generateAllSideImages();
	}
}

function updateSideIcon(index: number, value: string) {
	if (!formData.dice_sides) return;
	const updated = [...formData.dice_sides];
	updated[index] = { ...updated[index], icon: value };
	formData = { ...formData, dice_sides: updated };
}

function formatSideValue(diceType: DiceType, side: DiceSideRow): string {
	return diceType === 'attack' ? `${side.reward_value} ATK` : side.reward_value;
}

function getSideIcon(diceType: DiceType, side: DiceSideRow): string {
	return side.icon ?? DICE_TYPE_ICONS[diceType];
}

function computeAttackStats(dice: CustomDiceWithSides): AttackStats {
    if ((dice.dice_type ?? 'attack') !== 'attack') return null;
    const values = dice.dice_sides
        .map((side) => Number(side.reward_value))
        .filter((value) => Number.isFinite(value) && value !== 100) as number[];
    if (!values.length) return null;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const meanSquares = values.reduce((sum, value) => sum + value * value, 0) / values.length;
    const variance = meanSquares - mean * mean;
    const sd = Math.sqrt(Math.max(variance, 0));
    return {
        mean,
        sd
    };
}

function formatStat(value: number): string {
	return Number.isFinite(value) ? value.toFixed(2) : '—';
}

async function saveDice() {
	if (!formData.name?.trim()) {
		alert('Dice name is required');
		return;
	}

	try {
		const saved = await saveDiceRecord(formData);
		showEditor = false;
		await loadDice();
		selectedDiceId = saved.id;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to save dice: ${message}`);
	}
}

async function deleteDice(dice: CustomDiceWithSides) {
	if (!confirm(`Delete custom dice "${dice.name}"?`)) return;
	try {
		await deleteDiceRecord(dice.id);
		if (selectedDiceId === dice.id) {
			selectedDiceId = null;
			results = [];
		}
		await loadDice();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to delete dice: ${message}`);
	}
}

function submitDiceForm(event: Event) {
	event.preventDefault();
	void saveDice();
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
				// Get background URL
				const path = diceItem.background_image_path.startsWith('dice_backgrounds/')
					? diceItem.background_image_path
					: `dice_backgrounds/${diceItem.background_image_path}`;
				const { data } = gameAssetsStorage.getPublicUrl(path);
				if (!data?.publicUrl) continue;

				// Generate and upload faces for each side
				for (const side of diceItem.dice_sides) {
					try {
						// For attack dice, use the numeric value; for special dice, use the text
						const text = diceItem.dice_type === 'attack' 
							? side.reward_value 
							: (side.reward_value || String(side.side_number));

						// Generate dice face image
						const diceFaceDataUrl = await generateDiceSide({
							backgroundUrl: data.publicUrl,
							text: text,
							size: 800
						});

						// Convert data URL to blob
						const response = await fetch(diceFaceDataUrl);
						const blob = await response.blob();

						// Create file path and upload with transparent area cropping
						const sanitizedName = sanitizeFileName(diceItem.name);
						const fileName = `${sanitizedName}_side_${side.side_number}`;
						const folder = 'dice_faces';

						// Upload to storage
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
							// Update database with image path
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

		// Reload dice to get updated image paths
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
	
	// Set selected dice so reactive statement generates correct images
	selectedDiceId = diceToEdit.id;
	editingDice = diceToEdit;
	
	// Load global template (already loaded on mount, but refresh to be sure)
	// This will also load the saved scale
	await loadGlobalTemplate();
	
	// Always regenerate dice side images for the selected dice
	// This ensures we show the correct dice's faces
	// The reactive statement will handle this, but we'll also call it directly to ensure it happens
	if (diceToEdit.background_image_path) {
		await generateActiveDiceSideImages(diceToEdit);
	} else {
		activeDiceSideImages = {};
	}
	
	// Positions are now loaded from global template in loadGlobalTemplate()
	// No need to load per-dice positions anymore
	
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
		// Ensure we have a global template record
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

		// Remove old template if it exists
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

		// Generate filename and upload with transparent area cropping
		const fileName = 'global_dice_template';
		const folder = 'dice_templates';

		// Upload template
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

		// Update global template record
		const { error: updateError } = await supabase
			.from('dice_templates')
			.update({ template_image_path: uploadedPath })
			.eq('id', globalTemplateId);

		if (updateError) {
			throw updateError;
		}

		// Update local state
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
	templatePositions = { ...templatePositions }; // Trigger reactivity
}

async function saveTemplatePositions() {
	if (!globalTemplateId) {
		alert('Template not initialized. Please upload a template image first.');
		return;
	}

	try {
		// Convert templatePositions to JSONB format: { "1": { "x": 100, "y": 200 }, ... }
		const positionsJson: Record<string, { x: number; y: number }> = {};
		for (const [sideNum, pos] of Object.entries(templatePositions)) {
			if (pos && typeof pos === 'object' && 'x' in pos && 'y' in pos) {
				positionsJson[sideNum] = { x: pos.x, y: pos.y };
			}
		}

		// Save to global template (positions and scale)
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

		// Reload global template to ensure sync
		await loadGlobalTemplate();
		alert('Template positions and scale saved! These will be used as defaults for all dice.');
	} catch (err) {
		console.error('Failed to save template positions:', err);
		alert('Failed to save template positions.');
	}
}

async function generateTemplateImage() {
	if (!editingDice || !templateImageUrl) {
		alert('Please upload a template image first.');
		return;
	}

	generatingTemplate = true;
	try {
		// Load template image
		const templateImg = new Image();
		templateImg.crossOrigin = 'anonymous';
		await new Promise((resolve, reject) => {
			templateImg.onload = resolve;
			templateImg.onerror = reject;
			templateImg.src = templateImageUrl!;
		});

		// Get the displayed image element to calculate scale ratio
		const displayedImg = document.getElementById('template-image') as HTMLImageElement;
		let scaleX = 1;
		let scaleY = 1;
		
		if (displayedImg) {
			const displayedRect = displayedImg.getBoundingClientRect();
			scaleX = templateImg.width / displayedRect.width;
			scaleY = templateImg.height / displayedRect.height;
		}

		// Create canvas
		const canvas = document.createElement('canvas');
		canvas.width = templateImg.width;
		canvas.height = templateImg.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Could not get canvas context');

		// Draw template background
		ctx.drawImage(templateImg, 0, 0);

		// Generate dice face images if needed
		if (!editingDice.background_image_path) {
			alert('Dice must have a background image to generate template.');
			return;
		}

		const bgPath = editingDice.background_image_path.startsWith('dice_backgrounds/')
			? editingDice.background_image_path
			: `dice_backgrounds/${editingDice.background_image_path}`;
		const { data: bgData } = gameAssetsStorage.getPublicUrl(bgPath);
		if (!bgData?.publicUrl) {
			alert('Could not load dice background image.');
			return;
		}

		// Load and draw each dice face at its position
		for (const side of editingDice.dice_sides) {
			const position = templatePositions[side.side_number];
			if (!position) continue;

			try {
				// Generate dice face image
				const text = editingDice.dice_type === 'attack' 
					? side.reward_value 
					: (side.reward_value || String(side.side_number));
				
				const diceFaceDataUrl = await generateDiceSide({
					backgroundUrl: bgData.publicUrl,
					text: text,
					size: 800
				});

				// Load dice face image
				const diceFaceImg = new Image();
				diceFaceImg.crossOrigin = 'anonymous';
				await new Promise((resolve, reject) => {
					diceFaceImg.onload = resolve;
					diceFaceImg.onerror = reject;
					diceFaceImg.src = diceFaceDataUrl;
				});

				// Scale positions from displayed size to actual image size
				const scaledX = position.x * scaleX;
				const scaledY = position.y * scaleY;
				
				// Scale dice face size (base 100px * scale percentage * image scale)
				const baseSize = 100;
				const scaledFaceSize = (templateScale / 100) * baseSize * scaleX;
				
				ctx.drawImage(diceFaceImg, scaledX, scaledY, scaledFaceSize, scaledFaceSize);
			} catch (err) {
				console.warn(`Failed to draw dice face for side ${side.side_number}:`, err);
			}
		}

		// Convert to blob and upload to storage
		canvas.toBlob(async (blob) => {
			if (!blob) {
				alert('Failed to generate image.');
				return;
			}

			try {
				// Upload to game_assets bucket with transparent area cropping
				const sanitizedDiceName = editingDice.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
				const uploadFileName = `exported_template_${sanitizedDiceName}`;
				const folder = 'dice_templates';

				const { data: uploadData, error: uploadError } = await processAndUploadImage(blob, {
					folder,
					filename: uploadFileName,
					cropTransparent: true,
					upsert: true
				});

				if (uploadError) {
					throw uploadError;
				}

				const uploadedPath = uploadData?.path ?? '';

				// Update dice_templates table with exported path (global)
				if (globalTemplateId) {
					const { error: updateError } = await supabase
						.from('dice_templates')
						.update({ exported_template_path: uploadedPath })
						.eq('id', globalTemplateId);

					if (updateError) {
						console.warn('Failed to update exported template path:', updateError);
					}
				}

				// Update custom_dice table with exported path (per-dice)
				if (editingDice.id) {
					const { error: diceUpdateError } = await supabase
						.from('custom_dice')
						.update({ exported_template_path: uploadedPath })
						.eq('id', editingDice.id);

					if (diceUpdateError) {
						console.warn('Failed to update dice exported template path:', diceUpdateError);
					} else {
						// Reload dice to get updated path
						await loadDice();
					}
				}

				// Also download for user
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${sanitizeFileName(editingDice.name)}_template.png`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);

				alert('Template image saved to storage and downloaded!');
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
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Custom Dice Simulator</h1>
			<p>Design dice, preview sides, and simulate rolls for rev2 mechanics.</p>
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
			<button class="btn" type="button" onclick={openCreate}>Create Dice</button>
		</div>
	</header>

	{#if loading}
		<div class="card loading">Loading dice…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else}
		<section class="simulator">
			<div class="dice-row">
				{#each diceList as dice}
					{@const stats = computeAttackStats(dice)}
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
								{#if stats}
                               <span class="dice-panel__stats">EV {formatStat(stats.mean)} • SD {formatStat(stats.sd)}</span>
								{/if}
							</div>
							<div class="dice-panel__type">{DICE_TYPE_LABELS[dice.dice_type ?? 'attack']}</div>
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
					<button
						class="icon-btn"
						type="button"
						onclick={(event) => {
							event.stopPropagation();
							openEdit(dice);
						}}
						title="Edit dice"
					>
								✏️
							</button>
					<button
						class="icon-btn danger"
						type="button"
						onclick={(event) => {
							event.stopPropagation();
							deleteDice(dice);
						}}
						title="Delete dice"
					>
								🗑️
							</button>
						</div>
					</div>
				{:else}
					<div class="card empty">Create your first dice to begin.</div>
				{/each}
			</div>

			{#if selectedDiceId}
				{@const activeDice = currentDice()}
				<div class="roll-controls">
					<label>
						<span>Number of dice</span>
						<div class="range-input">
							<input type="range" min="1" max="10" bind:value={numberOfDice} />
							<span class="range-value">{numberOfDice}</span>
						</div>
					</label>
			<button class="btn btn--primary" type="button" disabled={isRolling} onclick={rollDice}>
						{isRolling ? 'Rolling…' : `Roll ${numberOfDice}d${activeDice?.dice_sides.length ?? 6}`}
					</button>
				</div>

			{#if results.length}
				<div class="results">
					<h2>Results</h2>
					<div class="results-grid">
						{#each results as side, index}
							<div class="result-card">
								{#if resultSideImages[side.side_number]}
									<img class="result-image" src={resultSideImages[side.side_number]} alt={`Side ${side.side_number}`} />
								{:else}
									<span class="result-icon"
										>{getSideIcon(activeDice?.dice_type ?? 'attack', side)}</span
									>
								{/if}
								<div class="result-content">
									<strong>Die {index + 1}</strong>
									<p>{formatSideValue(activeDice?.dice_type ?? 'attack', side)}</p>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if activeDice}
					<div class="dice-details">
						<h2>Dice Sides</h2>
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
										<span class="side-icon"
											>{getSideIcon(activeDice.dice_type ?? 'attack', side)}</span
										>
									{/if}
									<div class="side-content">
										<strong>Side {side.side_number}</strong>
										<p>{formatSideValue(activeDice.dice_type ?? 'attack', side)}</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
			{/if}
			{:else}
				<div class="card empty">Select a dice set to begin rolling.</div>
			{/if}
		</section>
	{/if}

	{#if showEditor}
		<EditorModal
			title={editingDice ? 'Edit Dice' : 'Create Dice'}
			description="Update core dice metadata, configure sides, and preview results."
			size="lg"
			onclose={() => (showEditor = false)}
		>
			<form id="dice-editor-form" class="dice-editor" onsubmit={submitDiceForm}>
				<section class="dice-editor__grid">
					<label>
						Name
						<input type="text" bind:value={formData.name} required />
					</label>
					<label>
						Icon
						<input type="text" bind:value={formData.icon} />
					</label>
					<label>
						Color
						<input type="color" bind:value={formData.color} />
					</label>
				<label>
					Dice type
				<select
					bind:value={formData.dice_type}
					onchange={(event) => setDiceType((event.currentTarget.value as DiceType) ?? 'attack')}
				>
							<option value="attack">Attack Dice</option>
							<option value="special">Special Dice</option>
						</select>
					</label>
				</section>

				<label>
					Description
					<textarea rows="2" bind:value={formData.description}></textarea>
				</label>

				<h3>Dice Background</h3>
				<div class="dice-background-section">
					<p>Upload a background image that will be used for all dice sides. Numbers will be overlaid on this background.</p>
					<div class="dice-background-controls">
						{#if diceBackgroundUrl}
							<div class="dice-background-preview">
								<img src={diceBackgroundUrl} alt="Dice background" />
						<button class="btn btn--small" type="button" onclick={removeBackground} disabled={uploadingBackground}>
									Remove
								</button>
							</div>
						{/if}
						<label class="btn btn--small">
							{uploadingBackground ? 'Uploading...' : diceBackgroundUrl ? 'Replace Background' : 'Upload Background'}
						<input
							type="file"
							accept="image/*"
							onchange={handleBackgroundUpload}
							disabled={uploadingBackground}
							style="display: none;"
						/>
						</label>
					</div>
					{#if diceBackgroundUrl && sideImageUrls && Object.keys(sideImageUrls).length > 0}
						<div class="dice-sides-preview">
							<h4>Side Preview</h4>
							<div class="sides-preview-grid">
								{#each formData.dice_sides as side}
									{#if sideImageUrls[side.side_number]}
										<div class="side-preview">
											<img src={sideImageUrls[side.side_number]} alt={`Side ${side.side_number}`} />
											<span>Side {side.side_number}</span>
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<h3>Sides</h3>
				<div class="sides-grid">
					{#if formData.dice_sides}
						{#each formData.dice_sides as side, index}
							<div class="side-editor">
								<strong>Side {index + 1}</strong>
								{#if formData.dice_type === 'attack'}
									<label>
										<span>Attack value</span>
										<input
											type="number"
											min="0"
											value={side.reward_value ?? String(index + 1)}
											oninput={(event) => updateSideValue(index, (event.currentTarget.value ?? '').trim())}
										/>
									</label>
								{:else}
									<label>
										<span>Effect text</span>
										<textarea
											rows="2"
											value={side.reward_value ?? ''}
											oninput={(event) => updateSideValue(index, event.currentTarget.value)}
										></textarea>
									</label>
								{/if}
								<label>
									<span>Icon</span>
									<input
										type="text"
										value={side.icon ?? DICE_TYPE_ICONS[formData.dice_type ?? 'attack']}
										oninput={(event) => updateSideIcon(index, event.currentTarget.value)}
									/>
								</label>
							</div>
						{/each}
					{/if}
				</div>
			</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="dice-editor-form">Save</button>
				<button class="btn" type="button" onclick={() => (showEditor = false)}>Cancel</button>
			</div>
		</EditorModal>
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
										// Auto-save scale when changed
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

				<div class="modal-actions">
					<button class="btn" onclick={saveTemplatePositions}>Save Positions</button>
					<button 
						class="btn btn--primary" 
						onclick={generateTemplateImage}
						disabled={generatingTemplate || !templateImageUrl}
					>
						{generatingTemplate ? 'Generating...' : 'Export Template Image'}
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

	.simulator {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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
	}

	.dice-panel__stats {
		margin-left: 0.4rem;
		font-weight: 600;
		text-transform: none;
		letter-spacing: 0.02em;
		color: #f8fafc;
	}

	.dice-panel__type {
		margin-top: 0.25rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: #fde68a;
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

	.icon-btn.danger:hover {
		background: rgba(248, 113, 113, 0.2);
	}

	.roll-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.85rem;
	}

	.roll-controls label {
		display: flex;
		align-items: center;
		gap: 1rem;
		color: #cbd5f5;
	}

	.range-input {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.range-input input[type='range'] {
		width: 160px;
	}

	.range-value {
		min-width: 24px;
		text-align: right;
		font-weight: 600;
		color: #f8fafc;
	}

	.btn--primary {
		background: linear-gradient(135deg, #3b82f6, #8b5cf6);
		border: none;
		color: #f8fafc;
	}

	.dice-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.dice-editor__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.6rem;
	}

	.results {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.9rem;
		display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.results-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	gap: 0.6rem;
}

.result-card {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	padding: 0.6rem;
	border-radius: 10px;
	background: rgba(30, 41, 59, 0.6);
	border: 1px solid rgba(148, 163, 184, 0.18);
}

.result-icon {
	font-size: 1.6rem;
}

.result-image {
	width: 60px;
	height: 60px;
	object-fit: cover;
	border-radius: 8px;
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

.side-icon {
	font-size: 1.4rem;
}

.side-image {
	width: 80px;
	height: 80px;
	object-fit: cover;
	border-radius: 8px;
}

.side-content {
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
}

	.sides-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.6rem;
	}

.side-editor {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	padding: 0.6rem;
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 10px;
	background: rgba(30, 41, 59, 0.55);
}

.side-editor label {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
	color: #cbd5f5;
}

	.side-editor textarea,
	.side-editor input[type='text'],
	.side-editor input[type='number'] {
		font: inherit;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.6);
		color: #f8fafc;
	}

	.side-editor textarea {
		resize: vertical;
		min-height: 72px;
	}

	.dice-background-section {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.dice-background-section p {
		margin: 0;
		color: #cbd5f5;
		font-size: 0.9rem;
	}

	.dice-background-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.dice-background-preview {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	.dice-background-preview img {
		width: 200px;
		height: 200px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.btn--small {
		padding: 0.4rem 0.75rem;
		font-size: 0.85rem;
	}

	.dice-sides-preview {
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
	}

	.dice-sides-preview h4 {
		margin: 0 0 0.5rem;
		color: #f8fafc;
		font-size: 0.95rem;
	}

	.sides-preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
		gap: 0.5rem;
	}

	.side-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.side-preview img {
		width: 100px;
		height: 100px;
		object-fit: cover;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.side-preview span {
		font-size: 0.75rem;
		color: #94a3b8;
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

	.modal-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
		padding-top: 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
	}
</style>
