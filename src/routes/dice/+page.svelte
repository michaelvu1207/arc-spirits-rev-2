<script lang="ts">
	// @ts-nocheck
	import { onMount } from 'svelte';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import { ImageUploader } from '$lib/components/shared';
	import { Modal, PageLayout } from '$lib/components/layout';
	import { useFormModal, useFileUpload } from '$lib/composables';
	import { getErrorMessage, publicAssetUrl } from '$lib/utils';
	import { supabase } from '$lib/api/supabaseClient';
	import type { DiceSideRow } from '$lib/types/gameData';
	import { BASE_LANGUAGE, type TranslationLanguage, getTranslationValue, normalizeLanguageCode, setTranslationValue } from '$lib/i18n/translations';
	import { generateDiceSide } from '$lib/generators/dice';
	import { generateAndSavePrefab, generateAllPrefabs, loadGlobalTemplate } from '$lib/services/dicePrefabService';
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
	import { processAndUploadImage } from '$lib/utils/storage';

	const gameAssetsStorage = supabase.storage.from('game_assets');

	// Shared data
	let diceList = $state<CustomDiceWithSides[]>([]);
	let error = $state<string | null>(null);
	let loading = $state(true);

	// Dice editor modal state
	const modal = useFormModal<DiceFormData>(createInitialForm());
	const backgroundUpload = useFileUpload('game_assets', 'dice_backgrounds');
	let editingDice = $state<CustomDiceWithSides | null>(null);
	let isGeneratingPrefab = $state(false);
	let prefabGenerationError = $state<string | null>(null);
	let isBatchGenerating = $state(false);
	let batchProgress = $state({ current: 0, total: 0, diceName: '' });

	// Selection & gallery state
	let selectedDiceId = $state<string | null>(null);
	let exportingDiceFaces = $state(false);
	let showTemplateEditor = $state(false);
	let templateImageUrl = $state<string | null>(null);
	let globalTemplateId = $state<string | null>(null);
	let templatePositions = $state<Record<number, { x: number; y: number }>>({});
	let templateScale = $state(100);
	let generatingTemplate = $state(false);
	let uploadingTemplate = $state(false);
	let activeDiceSideImages = $state<Record<number, string>>({});

	// TTS JSON state
	let ttsJsonOutput = $state('');
	let copySuccess = $state(false);
	let ttsOpen = $state(false);

	// Language state
	let diceLanguage = $state<TranslationLanguage>(BASE_LANGUAGE);
	let diceLanguageSelect = $state<TranslationLanguage>(BASE_LANGUAGE);
	let newDiceLanguageDraft = $state('');
	let extraDiceLanguages = $state<string[]>([]);

	type AttackStats = { mean: number; sd: number } | null;

	// Reactive effect for generating gallery images when a row is expanded
	$effect(() => {
		if (selectedDiceId) {
			const dice = currentDice();
			if (dice?.background_image_path) {
				void generateActiveDiceSideImages(dice);
			} else {
				activeDiceSideImages = {};
			}
		}
	});

	// Generate TTS JSON when details section is opened
	$effect(() => {
		if (ttsOpen) {
			updateTTSJson();
		}
	});

	onMount(async () => {
		await loadDice();
		await loadGlobalTemplateUI();
	});

	async function loadDice() {
		loading = true;
		error = null;
		try {
			diceList = await fetchDiceRecords();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function ensureDiceLanguageListed(lang: string) {
		if (!lang || lang === BASE_LANGUAGE) return;
		if (!extraDiceLanguages.includes(lang)) extraDiceLanguages = [...extraDiceLanguages, lang];
	}

	function getDiceName(dice: CustomDiceWithSides, lang: TranslationLanguage = diceLanguage): string {
		if (lang === BASE_LANGUAGE) return dice.name;
		return getTranslationValue((dice as any).name_translations, String(lang)) ?? dice.name;
	}

	function getDiceDescription(dice: CustomDiceWithSides, lang: TranslationLanguage = diceLanguage): string {
		const base = dice.description ?? '';
		if (lang === BASE_LANGUAGE) return base;
		return getTranslationValue((dice as any).description_translations, String(lang)) ?? base;
	}

	const detectedDiceLanguages = $derived.by(() => {
		const out = new Set<string>();
		for (const dice of diceList) {
			const sources = [(dice as any).name_translations, (dice as any).description_translations];
			for (const source of sources) {
				if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
				for (const key of Object.keys(source as Record<string, unknown>)) {
					const normalized = normalizeLanguageCode(key);
					if (!normalized) continue;
					out.add(normalized);
				}
			}
		}
		return Array.from(out).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	});

	const diceLanguageOptions = $derived.by(() => {
		const merged = new Set<string>([...detectedDiceLanguages, ...extraDiceLanguages]);
		const langs = Array.from(merged).filter((l) => l && l !== BASE_LANGUAGE);
		langs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		return [{ value: BASE_LANGUAGE, label: 'Default' }, ...langs.map((l) => ({ value: l, label: l }))];
	});

	$effect(() => {
		if (diceLanguageSelect !== diceLanguage) {
			requestDiceLanguageChange(String(diceLanguageSelect));
		}
	});

	function requestDiceLanguageChange(nextRaw: string) {
		const normalized = nextRaw === BASE_LANGUAGE ? BASE_LANGUAGE : normalizeLanguageCode(nextRaw);
		const next = normalized.length > 0 ? normalized : BASE_LANGUAGE;
		if (next === diceLanguage) return;

		if (modal.isOpen) {
			const ok = confirm('Switching language will discard any unsaved changes in the editor. Continue?');
			if (!ok) {
				diceLanguageSelect = diceLanguage;
				return;
			}
			modal.close();
			editingDice = null;
		}

		diceLanguage = next;
		diceLanguageSelect = next;
	}

	function addDiceLanguage() {
		const normalized = normalizeLanguageCode(newDiceLanguageDraft);
		if (!normalized) return;
		ensureDiceLanguageListed(normalized);
		newDiceLanguageDraft = '';
		requestDiceLanguageChange(normalized);
	}

	async function loadGlobalTemplateUI() {
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

	// Row selection
	function selectRow(diceId: string) {
		selectedDiceId = selectedDiceId === diceId ? null : diceId;
	}

	// Dice CRUD
	function openCreate() {
		if (diceLanguage !== BASE_LANGUAGE) {
			alert('Create dice in Default language first, then add translations.');
			return;
		}
		editingDice = null;
		prefabGenerationError = null;
		modal.open();
	}

	function openEdit(dice: CustomDiceWithSides) {
		editingDice = dice;
		prefabGenerationError = null;
		const baseForm = toFormData(dice);
		if (diceLanguage === BASE_LANGUAGE) {
			modal.open(baseForm);
			return;
		}

		modal.open({
			...baseForm,
			name: getTranslationValue((dice as any).name_translations, String(diceLanguage)) ?? '',
			description: getTranslationValue((dice as any).description_translations, String(diceLanguage)) ?? ''
		});
	}

	function setDiceType(type: DiceType) {
		modal.formData = {
			...modal.formData,
			dice_type: type,
			dice_sides: normalizeSides(type, modal.formData.dice_sides)
		};
	}

	function updateSideValue(index: number, value: string) {
		if (!modal.formData.dice_sides) return;
		const updated = [...modal.formData.dice_sides];
		updated[index] = { ...updated[index], reward_value: value };
		modal.formData = { ...modal.formData, dice_sides: updated };
	}

	function updateSideIcon(index: number, value: string) {
		if (!modal.formData.dice_sides) return;
		const updated = [...modal.formData.dice_sides];
		updated[index] = { ...updated[index], icon: value };
		modal.formData = { ...modal.formData, dice_sides: updated };
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
		return { mean, sd };
	}

	function formatStat(value: number): string {
		return Number.isFinite(value) ? value.toFixed(2) : '—';
	}

	async function saveDice() {
		const isBase = diceLanguage === BASE_LANGUAGE;

		if (isBase && !modal.formData.name?.trim()) {
			alert('Dice name is required');
			return;
		}

		if (!isBase && !editingDice?.id) {
			alert('Create the dice in Default language first, then add translations.');
			return;
		}

		try {
			let savedDice: CustomDiceWithSides;
			if (isBase) {
				savedDice = await saveDiceRecord(modal.formData);
			} else {
				const translationName = modal.formData.name ?? '';
				const translationDescription = modal.formData.description ?? '';

				savedDice = await saveDiceRecord({
					...modal.formData,
					id: editingDice!.id,
					name: editingDice!.name,
					description: editingDice!.description ?? ''
				});

				const { error: updateError } = await supabase
					.from('custom_dice')
					.update({
						name_translations: setTranslationValue(
							(editingDice as any).name_translations,
							String(diceLanguage),
							translationName
						),
						description_translations: setTranslationValue(
							(editingDice as any).description_translations,
							String(diceLanguage),
							translationDescription
						),
						updated_at: new Date().toISOString()
					})
					.eq('id', editingDice!.id);

				if (updateError) throw updateError;
			}

			// Automatically generate prefab after successful save
			if (isBase && savedDice.background_image_path) {
				isGeneratingPrefab = true;
				prefabGenerationError = null;

				try {
					const template = await loadGlobalTemplate();
					if (!template) {
						prefabGenerationError = 'No template configured. Please set up a template first.';
						isGeneratingPrefab = false;
						modal.close();
						await loadDice();
						return;
					}

					const result = await generateAndSavePrefab(savedDice, template);

					if (result === null) {
						prefabGenerationError = 'Prefab generation failed. Check console for details.';
					}
				} catch (err) {
					prefabGenerationError = `Prefab generation error: ${getErrorMessage(err)}`;
					console.error('Error generating prefab:', err);
				} finally {
					isGeneratingPrefab = false;
				}
			}

			modal.close();
			await loadDice();
		} catch (err) {
			alert(`Failed to save dice: ${getErrorMessage(err)}`);
		}
	}

	async function deleteDice(dice: CustomDiceWithSides) {
		if (!confirm(`Delete custom dice "${getDiceName(dice)}"?`)) return;
		try {
			await deleteDiceRecord(dice.id);
			if (selectedDiceId === dice.id) selectedDiceId = null;
			await loadDice();
		} catch (err) {
			alert(`Failed to delete dice: ${getErrorMessage(err)}`);
		}
	}

	async function batchGeneratePrefabs() {
		if (isBatchGenerating) return;

		const template = await loadGlobalTemplate();
		if (!template) {
			alert('No template configured. Please set up a template first.');
			return;
		}

		const eligibleDice = diceList.filter((dice) => dice.background_image_path);
		if (eligibleDice.length === 0) {
			alert('No dice with background images found.');
			return;
		}

		if (!confirm(`Generate prefabs for ${eligibleDice.length} dice?`)) {
			return;
		}

		isBatchGenerating = true;
		error = null;

		try {
			const result = await generateAllPrefabs(diceList, (current, total, diceName) => {
				batchProgress = { current, total, diceName };
			});

			if (result.errorCount > 0) {
				error = `Generated ${result.successCount} prefabs. ${result.errorCount} errors occurred:\n${result.errors.join('\n')}`;
			} else {
				alert(`Successfully generated ${result.successCount} prefabs!`);
			}

			await loadDice();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			isBatchGenerating = false;
			batchProgress = { current: 0, total: 0, diceName: '' };
		}
	}

	function handleBackgroundUpload(path: string) {
		modal.formData = { ...modal.formData, background_image_path: path };
	}

	function handleBackgroundError(message: string) {
		alert(message);
	}

	function submitDiceForm(event: Event) {
		event.preventDefault();
		void saveDice();
	}

	// Gallery functions
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

		await loadGlobalTemplateUI();

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

			await loadGlobalTemplateUI();
			alert('Template positions and scale saved! These will be used as defaults for all dice.');
		} catch (err) {
			console.error('Failed to save template positions:', err);
			alert('Failed to save template positions.');
		}
	}

	// TTS JSON functions
	function generateTTSJson(): string {
		const ttsData: Record<string, any> = {};

		for (const dice of diceList) {
			let prefabImageUrl: string | null = null;
			if (dice.exported_template_path) {
				const prefabPath = dice.exported_template_path.startsWith('dice_templates/')
					? dice.exported_template_path
					: `dice_templates/${dice.exported_template_path}`;
				prefabImageUrl = publicAssetUrl(prefabPath);
			}

			let backgroundImageUrl: string | null = null;
			if (dice.background_image_path) {
				const bgPath = dice.background_image_path.startsWith('dice_backgrounds/')
					? dice.background_image_path
					: `dice_backgrounds/${dice.background_image_path}`;
				backgroundImageUrl = gameAssetsStorage.getPublicUrl(bgPath).data?.publicUrl ?? null;
			}

			ttsData[dice.id] = {
				Name: getDiceName(dice),
				PrefabImage: prefabImageUrl,
				BackgroundImage: backgroundImageUrl,
				Description: getDiceDescription(dice)
			};
		}

		const output = {
			Name: 'Custom_Model_Bag',
			CustomDice: ttsData
		};

		return JSON.stringify(output, null, 2);
	}

	function updateTTSJson() {
		ttsJsonOutput = generateTTSJson();
	}

	async function copyTTSJson() {
		try {
			await navigator.clipboard.writeText(ttsJsonOutput);
			copySuccess = true;
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (err) {
			alert('Failed to copy to clipboard: ' + getErrorMessage(err));
		}
	}

	function downloadTTSJson() {
		const blob = new Blob([ttsJsonOutput], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'arc_spirits_dice_tts.json';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
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

				const sanitizedName = editingDice!.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${sanitizedName}_template.png`;
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
					const uploadFileName = 'prefab_composite';
					const folder = `dice_templates/${editingDice!.id}`;

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

					if (editingDice!.id) {
						const { error: diceUpdateError } = await supabase
							.from('custom_dice')
							.update({ exported_template_path: uploadedPath })
							.eq('id', editingDice!.id);

						if (diceUpdateError) {
							console.warn('Failed to update dice exported template path:', diceUpdateError);
						} else {
							await loadDice();
							editingDice = { ...editingDice!, exported_template_path: uploadedPath };
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

		try {
			const { error: updateError } = await supabase
				.from('custom_dice')
				.update({ exported_template_path: path })
				.eq('id', editingDice.id);

			if (updateError) {
				throw updateError;
			}

			await loadDice();
			editingDice = { ...editingDice, exported_template_path: path };
			alert('Prefab image uploaded successfully!');
		} catch (err) {
			console.error('Failed to update dice prefab:', err);
			alert('Failed to save prefab to database.');
		}
	}
</script>

<PageLayout title="Dice" subtitle="Custom dice definitions and gallery">
	{#snippet headerActions()}
		<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
			<Button onclick={openCreate}>Create Dice</Button>
			<button
				class="btn"
				type="button"
				onclick={batchGeneratePrefabs}
				disabled={isBatchGenerating || diceList.length === 0}
				title="Generate prefab templates for all dice with backgrounds"
			>
				{isBatchGenerating ? `Generating ${batchProgress.current}/${batchProgress.total}...` : 'Gen All Prefabs'}
			</button>
			<button
				class="btn"
				type="button"
				onclick={exportAllDiceFaces}
				disabled={exportingDiceFaces || diceList.length === 0}
			>
				{exportingDiceFaces ? 'Exporting...' : 'Export Faces'}
			</button>
		</div>
	{/snippet}

	<div class="language-bar">
		<FormField label="Language">
			<Select bind:value={diceLanguageSelect} options={diceLanguageOptions} />
		</FormField>
		<FormField label="Add language">
			<div class="language-bar__add">
				<Input bind:value={newDiceLanguageDraft} placeholder="e.g. ja" />
				<Button
					variant="secondary"
					onclick={addDiceLanguage}
					disabled={!newDiceLanguageDraft.trim()}
				>
					Add
				</Button>
			</div>
		</FormField>
	</div>

	{#if loading}
		<div class="card loading">Loading dice…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else if diceList.length === 0}
		<div class="card empty">Create your first dice to begin.</div>
	{:else}
		<table class="t">
			<thead><tr>
				<th class="w36"></th>
				<th>Name</th>
				<th class="tc w72">Type</th>
				<th class="tc w48">Sides</th>
				<th class="tc w96">Stats</th>
				<th class="tc w60">Prefab</th>
				<th class="tc w96">Actions</th>
			</tr></thead>
			<tbody>
				{#each diceList as dice (dice.id)}
					{@const sel = selectedDiceId === dice.id}
					{@const stats = computeAttackStats(dice)}
					{@const displayName = getDiceName(dice)}
					<tr class="row" class:sel onclick={() => selectRow(dice.id)}>
						<td>
							<span class="dice-icon">{dice.icon ?? '🎲'}</span>
						</td>
						<td>
							<span class="nm">{displayName}</span>
						</td>
						<td class="tc">
							<span class="type-badge" data-type={dice.dice_type}>
								{DICE_TYPE_ICONS[dice.dice_type ?? 'attack']}
								{DICE_TYPE_LABELS[dice.dice_type ?? 'attack']}
							</span>
						</td>
						<td class="tc">{dice.dice_sides.length}</td>
						<td class="tc mono">
							{#if stats}
								EV {formatStat(stats.mean)} / SD {formatStat(stats.sd)}
							{:else}
								—
							{/if}
						</td>
						<td class="tc">
							{#if dice.exported_template_path}
								<span class="prefab-ok" title="Prefab available">✅</span>
							{:else}
								<span class="prefab-warn" title="No prefab">⚠️</span>
							{/if}
						</td>
						<td class="tc actions-cell">
							<button
								class="xbtn"
								title="Edit"
								onclick={(e) => { e.stopPropagation(); openEdit(dice); }}
							>✏️</button>
							<button
								class="xbtn xbtn--danger"
								title="Delete"
								onclick={(e) => { e.stopPropagation(); deleteDice(dice); }}
							>🗑️</button>
							<button
								class="xbtn"
								title="Template Editor"
								onclick={(e) => { e.stopPropagation(); openTemplateEditor(dice); }}
							>📐</button>
						</td>
					</tr>
					{#if sel}
						<tr class="erow"><td colspan="7">
							<div class="expanded-detail">
								{#key selectedDiceId}
									{@const activeDice = currentDice()}
									{#if activeDice}
										{#if activeDice.exported_template_path}
											{@const prefabPath = activeDice.exported_template_path.startsWith('dice_templates/')
												? activeDice.exported_template_path
												: `dice_templates/${activeDice.exported_template_path}`}
											{@const prefabUrl = gameAssetsStorage.getPublicUrl(prefabPath).data?.publicUrl}
											<div class="prefab-section">
												<h3>Prefab Template Image</h3>
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
											<h3>Generated Dice Sides</h3>
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
							</div>
						</td></tr>
					{/if}
				{/each}
			</tbody>
		</table>
	{/if}

	<!-- TTS JSON collapsible section -->
	<details class="tts-details" bind:open={ttsOpen}>
		<summary class="tts-summary">TTS JSON Export</summary>
		<div class="tts-json-container">
			<div class="tts-json-header">
				<p class="tts-json-subtitle">
					Export your dice as JSON for importing into Tabletop Simulator.
					{#if diceList.some((d) => !d.exported_template_path)}
						<span class="warning-badge">
							⚠️ Some dice are missing prefab images
						</span>
					{/if}
				</p>
				<div class="tts-json-actions">
					<Button onclick={copyTTSJson}>
						{copySuccess ? '✅ Copied!' : '📋 Copy JSON'}
					</Button>
					<Button onclick={downloadTTSJson}>💾 Download JSON</Button>
				</div>
			</div>

			<div class="tts-json-output">
				<pre><code>{ttsJsonOutput}</code></pre>
			</div>

			<div class="tts-json-info">
				<h3>Dice Status</h3>
				<div class="dice-status-grid">
					{#each diceList as dice}
						{@const hasPrefab = !!dice.exported_template_path}
						<div class="dice-status-card" class:has-missing={!hasPrefab}>
							<div class="dice-status-header">
								<span class="dice-status-icon">{dice.icon ?? '🎲'}</span>
								<span class="dice-status-name">{getDiceName(dice)}</span>
							</div>
							{#if hasPrefab}
								<div class="dice-status-success">✅ Prefab image available</div>
							{:else}
								<div class="dice-status-warning">⚠️ No prefab image</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>
	</details>
</PageLayout>

<!-- Dice Editor Modal -->
<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Dice' : 'Create Dice'} size="lg">
	<form id="dice-editor-form" class="dice-editor" onsubmit={submitDiceForm}>
		<section class="dice-editor__grid">
			<FormField
				label={`Name${diceLanguage === BASE_LANGUAGE ? '' : ` (${diceLanguage})`}`}
				required={diceLanguage === BASE_LANGUAGE}
			>
				<Input bind:value={modal.formData.name} required={diceLanguage === BASE_LANGUAGE} />
			</FormField>

			<FormField label="Icon">
				<Input bind:value={modal.formData.icon} />
			</FormField>

			<FormField label="Color">
				<Input type="color" bind:value={modal.formData.color} />
			</FormField>

			<FormField label="Dice type">
				<Select
					bind:value={modal.formData.dice_type}
					options={[
						{ value: 'attack', label: 'Attack Dice' },
						{ value: 'special', label: 'Special Dice' }
					]}
					onchange={(event) => setDiceType((event.currentTarget.value as DiceType) ?? 'attack')}
				/>
			</FormField>
		</section>

		<FormField label={`Description${diceLanguage === BASE_LANGUAGE ? '' : ` (${diceLanguage})`}`}>
			<Textarea rows={2} bind:value={modal.formData.description} />
		</FormField>

		<h3>Dice Background</h3>
		<ImageUploader
			bind:value={modal.formData.background_image_path}
			bucket="game_assets"
			folder="dice_backgrounds"
			maxSizeMB={10}
			onupload={handleBackgroundUpload}
			onerror={handleBackgroundError}
		>
			<p>Upload a background image that will be used for all dice sides.</p>
		</ImageUploader>

		<h3>Sides</h3>
		<div class="sides-grid">
			{#if modal.formData.dice_sides}
				{#each modal.formData.dice_sides as side, index}
					<div class="side-editor">
						<strong>Side {index + 1}</strong>
						{#if modal.formData.dice_type === 'attack'}
							<FormField label="Attack value">
								<Input
									type="number"
									value={side.reward_value ?? String(index + 1)}
									oninput={(event) => updateSideValue(index, (event.currentTarget.value ?? '').trim())}
								/>
							</FormField>
						{:else}
							<FormField label="Effect text">
								<Textarea
									rows={2}
									value={side.reward_value ?? ''}
									oninput={(event) => updateSideValue(index, event.currentTarget.value)}
								/>
							</FormField>
						{/if}
						<FormField label="Icon">
							<Input
								value={side.icon ?? DICE_TYPE_ICONS[modal.formData.dice_type ?? 'attack']}
								oninput={(event) => updateSideIcon(index, event.currentTarget.value)}
							/>
						</FormField>
					</div>
				{/each}
			{/if}
		</div>
	</form>

	{#snippet footer()}
		<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
			<div style="font-size: 0.7rem; color: #94a3b8;">
				{#if isGeneratingPrefab}
					<span style="color: #60a5fa;">Generating prefab...</span>
				{:else if prefabGenerationError}
					<span style="color: #f87171;" title={prefabGenerationError}>
						⚠️ Prefab generation failed
					</span>
				{/if}
			</div>
			<div style="display: flex; gap: 0.5rem;">
				<Button variant="primary" type="submit" form="dice-editor-form">Save</Button>
				<Button onclick={() => modal.close()}>Cancel</Button>
			</div>
		</div>
	{/snippet}
</Modal>

<!-- Template Editor Modal -->
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
					<p style="color: #94a3b8; font-size: 0.7rem; margin: 0.25rem 0 0;">Template is shared by all dice</p>
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
							<span style="color: #94a3b8; font-size: 0.7rem; margin-left: 0.5rem;">Uploading...</span>
						{/if}
					</label>
					{#if templateImageUrl}
						<div class="template-preview-container">
							<p style="color: #94a3b8; font-size: 0.7rem; margin-bottom: 0.5rem;">
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

<style>
	/* Language bar */
	.language-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 1rem;
		margin-bottom: 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		align-items: flex-end;
	}

	.language-bar__add {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	/* Compact table */
	.t { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
	.t thead { position: sticky; top: 0; z-index: 1; }
	.t th {
		padding: 0.3rem 0.5rem; text-align: left;
		font-size: 0.65rem; font-weight: 600; color: #64748b;
		text-transform: uppercase; letter-spacing: 0.05em;
		border-bottom: 1px solid rgba(148,163,184,0.15);
		background: rgba(15,23,42,0.6);
	}

	.row { cursor: pointer; transition: background 0.1s; }
	.row:hover { background: rgba(99,102,241,0.08); }
	.row.sel { background: rgba(59,130,246,0.12); }
	.row td {
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid rgba(148,163,184,0.08);
		color: #cbd5e1;
	}
	.row.sel td { border-bottom-color: transparent; }

	.erow td { padding: 0; border-bottom: 1px solid rgba(148,163,184,0.08); }

	.tc { text-align: center; }
	.w36 { width: 36px; }
	.w48 { width: 48px; }
	.w60 { width: 60px; }
	.w72 { width: 72px; }
	.w96 { width: 96px; }
	.mono { font-family: 'Courier New', monospace; font-size: 0.68rem; }

	.nm { font-weight: 600; color: #f1f5f9; }
	.dice-icon { font-size: 1.2rem; }

	.type-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.2rem;
		font-size: 0.62rem;
		font-weight: 500;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		white-space: nowrap;
	}

	.type-badge[data-type='attack'] {
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
	}

	.type-badge[data-type='special'] {
		background: rgba(139, 92, 246, 0.2);
		border: 1px solid rgba(139, 92, 246, 0.4);
		color: #c4b5fd;
	}

	.prefab-ok { font-size: 0.85rem; }
	.prefab-warn { font-size: 0.85rem; }

	.actions-cell {
		display: flex;
		gap: 0.2rem;
		justify-content: center;
		align-items: center;
	}

	.xbtn {
		background: none;
		border: 1px solid rgba(148,163,184,0.2);
		border-radius: 4px;
		cursor: pointer;
		padding: 0.15rem 0.3rem;
		font-size: 0.75rem;
		color: #cbd5e1;
		transition: background 0.1s;
		line-height: 1;
	}

	.xbtn:hover {
		background: rgba(59,130,246,0.15);
		border-color: rgba(59,130,246,0.4);
	}

	.xbtn--danger:hover {
		background: rgba(248,113,113,0.15);
		border-color: rgba(248,113,113,0.4);
	}

	/* Expanded detail row */
	.expanded-detail {
		padding: 0.75rem;
		background: rgba(30,41,59,0.25);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.prefab-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.prefab-section h3 {
		margin: 0;
		color: #f8fafc;
		font-size: 0.8rem;
	}

	.prefab-display {
		background: rgba(30, 41, 59, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 10px;
		padding: 0.75rem;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.prefab-image {
		max-width: 100%;
		max-height: 600px;
		object-fit: contain;
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.prefab-placeholder {
		padding: 2rem;
		color: #94a3b8;
		font-size: 0.7rem;
		text-align: center;
	}

	.dice-details {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dice-details h3 {
		margin: 0;
		color: #f8fafc;
		font-size: 0.8rem;
	}

	.sides-display {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.5rem;
	}

	.side-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.side-image {
		width: 70px;
		height: 70px;
		object-fit: cover;
		border-radius: 6px;
	}

	.side-placeholder {
		width: 70px;
		height: 70px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(15, 23, 42, 0.6);
		border-radius: 6px;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		font-size: 0.65rem;
		color: #94a3b8;
		text-align: center;
		padding: 0.4rem;
	}

	.side-content {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.side-content strong {
		font-size: 0.7rem;
		color: #cbd5f5;
	}

	.side-content p {
		margin: 0;
		font-size: 0.7rem;
		color: #94a3b8;
	}

	/* Dice editor modal */
	.dice-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.dice-editor__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 0.5rem;
	}

	.sides-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 0.5rem;
	}

	.side-editor {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		padding: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.55);
	}

	.side-editor strong {
		color: #cbd5f5;
		font-size: 0.7rem;
	}

	/* TTS JSON collapsible */
	.tts-details {
		margin-top: 1rem;
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.4);
	}

	.tts-summary {
		padding: 0.75rem 1rem;
		cursor: pointer;
		color: #94a3b8;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		user-select: none;
	}

	.tts-summary:hover {
		color: #cbd5e1;
	}

	.tts-json-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1rem 1rem;
	}

	.tts-json-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tts-json-subtitle {
		margin: 0;
		color: #cbd5f5;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.warning-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.2rem 0.5rem;
		background: rgba(251, 146, 60, 0.2);
		border: 1px solid rgba(251, 146, 60, 0.4);
		border-radius: 4px;
		font-size: 0.7rem;
		color: #fb923c;
	}

	.tts-json-actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.tts-json-output {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 1rem;
		overflow-x: auto;
		max-height: 500px;
		overflow-y: auto;
	}

	.tts-json-output pre {
		margin: 0;
		color: #f8fafc;
		font-family: 'Courier New', monospace;
		font-size: 0.7rem;
		line-height: 1.5;
	}

	.tts-json-output code {
		color: #cbd5f5;
	}

	.tts-json-info {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tts-json-info h3 {
		margin: 0;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.dice-status-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.5rem;
	}

	.dice-status-card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
	}

	.dice-status-card.has-missing {
		border-color: rgba(251, 146, 60, 0.4);
		background: rgba(30, 41, 59, 0.7);
	}

	.dice-status-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dice-status-icon {
		font-size: 1.2rem;
	}

	.dice-status-name {
		color: #f8fafc;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.dice-status-warning {
		color: #fb923c;
		font-size: 0.7rem;
	}

	.dice-status-success {
		color: #4ade80;
		font-size: 0.7rem;
	}

	/* Template editor modal */
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
		border-radius: 10px;
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
		padding: 1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.modal-header > div {
		flex: 1;
	}

	.modal-header h2 {
		margin: 0;
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.icon-btn {
		background: rgba(30, 41, 59, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		color: inherit;
		cursor: pointer;
		padding: 0.25rem 0.4rem;
		transition: background 0.15s ease;
	}

	.icon-btn:hover {
		background: rgba(59, 130, 246, 0.2);
	}

	.template-editor {
		padding: 1rem;
	}

	.template-upload-section {
		margin-bottom: 1.5rem;
	}

	.template-upload-section label {
		display: block;
		margin-bottom: 0.75rem;
		color: #cbd5f5;
		font-size: 0.7rem;
	}

	.template-preview-container {
		margin-top: 0.75rem;
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
		margin-bottom: 1.5rem;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.template-scale-control {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.template-scale-control label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
		color: #cbd5f5;
		font-size: 0.7rem;
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
		font-size: 0.7rem;
	}

	.template-positions-section {
		margin-bottom: 1.5rem;
	}

	.template-positions-section h3 {
		color: #f8fafc;
		margin-bottom: 0.75rem;
		font-size: 0.8rem;
	}

	.position-inputs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}

	.position-input-row {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.side-label {
		color: #cbd5f5;
		font-size: 0.7rem;
		font-weight: 500;
		margin: 0;
	}

	.coordinate-inputs {
		display: flex;
		gap: 0.4rem;
	}

	.coordinate-inputs input {
		flex: 1;
		padding: 0.4rem;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 4px;
		color: #f8fafc;
		font-size: 0.7rem;
	}

	.coordinate-inputs input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}

	.prefab-upload-section {
		margin-bottom: 1.5rem;
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
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		flex-wrap: wrap;
	}
</style>
