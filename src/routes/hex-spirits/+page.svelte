<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import html2canvas from 'html2canvas';
	import JSZip from 'jszip';
	import type {
		AwakenRuneToken,
		ClassRow,
		HexSpiritArtRawVariantRow,
		HexSpiritRow,
		OriginRow,
		MatItemRow
	} from '$lib/types/gameData';
	import { isAwakenOrRuneToken, awakenRuneTokensSlotsUsed } from '$lib/utils/awakenRuneTokens';
	import {
		deleteHexSpiritRecord,
		emptyHexSpiritForm,
		buildArtRawVariantUploadTarget,
		createArtRawVariantRecord,
		deleteArtRawVariantRecord,
		fetchArtRawVariantRecords,
		fetchHexSpiritRecords,
		hexSpiritRowToForm,
		isArtRawVariantCurrent,
		normalizeArtRawVariantLabel,
		parseVariationExportId,
		saveHexSpiritRecord,
		selectVariationForSpirit,
		updateArtRawVariantOutputs,
		useArtRawVariantAsCurrent,
		type HexSpiritFormData
	} from '$lib/features/hex-spirits/hexSpirits';
	import {
		buildHexSpiritVariationCandidates,
		getSelectedVariationBySpiritId,
		type HexSpiritVariationCandidate
	} from '$lib/features/hex-spirits/variationCandidates';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchClassRecords, parseEffectSchema, formatEffectSummary } from '$lib/features/classes/classes';
	import { useFormModal, useFilteredData, useLookup } from '$lib/composables';
	import { getErrorMessage } from '$lib/utils';
	import { Button } from '$lib/components/ui';
	import { FilterBar, ImageUploader } from '$lib/components/shared';
	import { Modal, PageLayout, type Tab } from '$lib/components/layout';
	import {
		HexSpiritsCombinedView,
		HexSpiritsTTSView
	} from '$lib/components/hex-spirits';
	import { downloadImageAsBlob } from '$lib/utils/sinkinApi';
	import { processAndUploadImage } from '$lib/utils/storage';
	import IconPlacementConfigurator from '$lib/components/spirits/IconPlacementConfigurator.svelte';
	import BackIconPlacementConfigurator from '$lib/components/spirits/BackIconPlacementConfigurator.svelte';
	import {
		FRAME_TIERS,
		type FrameTier,
		loadFrontIconPlacementConfigFromDatabase,
		generateSpiritWithIcons,
		type SpiritIconData
	} from '$lib/generators/spirits/spiritIconPlacer';
	import {
		loadBackIconPlacementConfigFromDatabase,
		generateBackWithIcons,
		type RuneIconData
	} from '$lib/generators/spirits/spiritBackIconPlacer';
	import {
		computeSmartTrimRect,
		generateCombinedTTSTexture
	} from '$lib/generators/spirits/ttsCombinedTexture';
	import {
		runHexSpiritBatchPipeline,
		type HexSpiritBatchPipelineSummary,
		type HexSpiritPipelineSpirit,
		type HexSpiritPipelineStatus
	} from '$lib/generators/spirits/hexSpiritBatchPipeline';

	import gamePrintScript from '../../../scripts/hex-spirit-game-print.jsx?raw';
	import mediumHexProofExportScript from '../../../scripts/medium-hex-proof-export.jsx?raw';
	import templateUpdaterScript from '../../../scripts/update_photoshop_template_path.py?raw';

	type HexSpirit = HexSpiritRow & {
		game_print_image_url: string | null;
		game_print_no_icons_url: string | null;
		art_raw_image_url: string | null;
		back_side_base_url: string | null;
		back_side_export_url: string | null;
		tts_combined_image_url: string | null;
	};

	type OriginOption = Pick<OriginRow, 'id' | 'name' | 'position' | 'icon_emoji' | 'icon_png'>;
	type ClassOption = Pick<
		ClassRow,
		'id' | 'name' | 'position' | 'icon_emoji' | 'icon_png' | 'class_type' | 'is_special' | 'effect_schema' | 'description'
	> & {
		isHuman?: boolean;
	};

	function countOccurrences(arr: string[], id: string): number {
		return arr.reduce((sum, val) => (val === id ? sum + 1 : sum), 0);
	}

	function primaryOriginId(spirit: HexSpiritRow | HexSpirit): string | null {
		return spirit.traits?.origin_ids?.[0] ?? null;
	}

	function primaryClassId(spirit: HexSpiritRow | HexSpirit): string | null {
		return spirit.traits?.class_ids?.[0] ?? null;
	}

	// Data state
	let spirits: HexSpirit[] = $state([]);
	let artRawVariants: HexSpiritArtRawVariantRow[] = $state([]);
	let origins: OriginOption[] = $state([]);
	let classes: ClassOption[] = $state([]);
	let runes: MatItemRow[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);

	// Tab state
	const tabs: Tab[] = [
		{ id: 'data', label: 'Data', icon: '📊' },
		{ id: 'gallery', label: 'Spirit Gallery', icon: '🎨' },
		{ id: 'tts', label: 'TTS JSON', icon: '🎮' }
	];
	let activeTab = $state('data');
	let assetViewMode: 'primary' | 'variation' = $state('primary');
	let ttsExportSource: 'primary' | 'variation' = $state('primary');

	// Filter state
	let originFilter = $state('all');
	let classFilter = $state('all');

	// Gallery state
	let selectedOriginsForGrid: Set<string | null> = $state(new Set());
	const TTS_INDEPENDENT_EXPORT_WIDTH = 825;
	const TTS_INDEPENDENT_EXPORT_HEIGHT = 750;
	const TTS_MEMBER_EXPORT_QUANTITY = 2;
	let galleryImageSide: 'front' | 'back' | 'data' = $state('front');
	let exportingArtPack = $state(false);
	let exportingVariationArtPack = $state(false);
	let exportingMissingPrintsPack = $state(false);
	let exportingTTSMemberPack = $state(false);
	let ttsMemberPackProgress = $state({ processed: 0, total: 0, current: '' });
	let batchUploadInProgress = $state(false);
	let variationBatchUploadInProgress = $state(false);
	let batchUploadProgress = $state({ processed: 0, total: 0 });
	let variationBatchUploadProgress = $state({ processed: 0, total: 0 });
	let exportingGridImage = $state(false);
	let batchUploadInput: HTMLInputElement | null = $state(null);
	let variationBatchUploadInput: HTMLInputElement | null = $state(null);
	let iconPlacerOpen = $state(false);
	let pipelineModalOpen = $state(false);
	let pipelineConcurrency = $state(3);
	let pipelineInProgress = $state(false);
	let pipelineProgress = $state({
		processed: 0,
		total: 0,
		failed: 0,
		current: '',
		status: '' as HexSpiritPipelineStatus | ''
	});
	let pipelineSummary: HexSpiritBatchPipelineSummary | null = $state(null);
	let generatingWithIcons = $state(false);
	let generatingProgress = $state({ processed: 0, total: 0, current: '' });
	let backIconPlacerOpen = $state(false);
	let generatingBackIcons = $state(false);
	let generatingBackProgress = $state({ processed: 0, total: 0, current: '' });
	let generatingTTSCombined = $state(false);
	let ttsCombinedProgress = $state({ processed: 0, total: 0, current: '' });
	let artRawVariationInput: HTMLInputElement | null = $state(null);
	let artRawVariationTarget: HexSpirit | null = $state(null);
	let artRawVariationUploading = $state(false);

	const originIconFileMap = new Map<string, string>();
	const classIconFileMap = new Map<string, string>();

	const gameAssetsStorage = supabase.storage.from('game_assets');

	// Use composables
	const modal = useFormModal<HexSpiritFormData>(emptyHexSpiritForm());
	const originLookup = useLookup(() => origins);
	const classLookup = useLookup(() => classes);

	// Enhanced filtered data with lookups for search
	const filteredData = useFilteredData(
		() => spirits,
		{
			searchFields: ['name'],
			filters: [
				{
					key: 'traits',
					value: () => {
						const originId = originFilter;
						const classId = classFilter;
						if (originId === 'all' && classId === 'all') return 'all';
						return JSON.stringify({ originId, classId });
					}
				}
			]
		}
	);

	// Override filtered logic to handle complex filtering with lookups
	const filteredSpirits = $derived(
		spirits.filter((spirit) => {
			const spiritOriginId = primaryOriginId(spirit);
			const spiritClassId = primaryClassId(spirit);

			if (originFilter !== 'all' && spiritOriginId !== originFilter) return false;
			if (classFilter !== 'all' && spiritClassId !== classFilter) return false;
			if (filteredData.searchQuery.trim()) {
				const term = filteredData.searchQuery.trim().toLowerCase();
				if (
					!spirit.name.toLowerCase().includes(term) &&
					!originLookup.getLabel(spiritOriginId).toLowerCase().includes(term) &&
					!classLookup.getLabel(spiritClassId).toLowerCase().includes(term)
				) {
					return false;
				}
			}
			return true;
		})
	);

	onMount(async () => {
		await Promise.all([loadOrigins(), loadClasses(), loadRunes()]);
		selectedOriginsForGrid = new Set([...origins.map((o) => o.id), null]);
		await loadSpirits();
	});

	function getPublicImage(path: string | null | undefined, updatedAt?: string | null): string | null {
		if (!path) return null;
		const fullPath = path.startsWith('hex_spirits/') ? path : `hex_spirits/${path}`;
		const { data } = gameAssetsStorage.getPublicUrl(fullPath);
		if (!data?.publicUrl) return null;

		const cacheBuster = updatedAt ? new Date(updatedAt).getTime() : Date.now();
		const separator = data.publicUrl.includes('?') ? '&' : '?';
		return `${data.publicUrl}${separator}v=${cacheBuster}`;
	}

	const variationCandidates = $derived(
		buildHexSpiritVariationCandidates({
			spirits,
			variants: artRawVariants,
			getPublicImage
		})
	);

	const filteredVariationCandidates = $derived(
		variationCandidates.filter((candidate) => {
			const spirit = candidate.spirit;
			const spiritOriginId = primaryOriginId(spirit);
			const spiritClassId = primaryClassId(spirit);

			if (originFilter !== 'all' && spiritOriginId !== originFilter) return false;
			if (classFilter !== 'all' && spiritClassId !== classFilter) return false;
			if (filteredData.searchQuery.trim()) {
				const term = filteredData.searchQuery.trim().toLowerCase();
				if (
					!spirit.name.toLowerCase().includes(term) &&
					!candidate.variant.label.toLowerCase().includes(term) &&
					!originLookup.getLabel(spiritOriginId).toLowerCase().includes(term) &&
					!classLookup.getLabel(spiritClassId).toLowerCase().includes(term)
				) {
					return false;
				}
			}
			return true;
		})
	);

	const selectedVariationBySpiritId = $derived(getSelectedVariationBySpiritId(variationCandidates));

	const variationReadyStats = $derived.by(() => {
		let selected = 0;
		let front = 0;
		let back = 0;
		let combined = 0;
		for (const candidate of selectedVariationBySpiritId.values()) {
			selected += 1;
			if (candidate.frontUrl) front += 1;
			if (candidate.backUrl) back += 1;
			if (candidate.ttsCombinedUrl) combined += 1;
		}
		return { selected, front, back, combined, fallback: Math.max(0, spirits.length - selected) };
	});

	async function loadOrigins() {
		try {
			const records = await fetchOriginRecords();
			origins = records.map(({ id, name, position, icon_emoji, icon_png }) => ({
				id,
				name,
				position,
				icon_emoji,
				icon_png
			}));
		} catch (err) {
			error = getErrorMessage(err);
		}
	}

	async function loadClasses() {
		try {
			const records = await fetchClassRecords();
			classes = records.map((record) => {
				const { id, name, position, icon_emoji, icon_png, class_type, is_special, effect_schema, description } = record;
				return {
					id,
				name,
				position,
				icon_emoji,
				icon_png,
				class_type,
				is_special,
				effect_schema,
					description,
					isHuman: class_type === 'human'
				};
			});
		} catch (err) {
			error = getErrorMessage(err);
		}
	}

	async function loadRunes() {
		try {
			const { data, error: fetchError } = await supabase
				.from('mat_items')
				.select('*')
				.order('name', { ascending: true });
			if (fetchError) throw fetchError;
			runes = data ?? [];
		} catch (err) {
			console.warn('Failed to load runes:', err);
			runes = [];
		}
	}

	async function loadSpirits() {
		loading = true;
		error = null;
		try {
			const [data, variants] = await Promise.all([
				fetchHexSpiritRecords(),
				fetchArtRawVariantRecords()
			]);
			spirits = data.map((spirit) => ({
				...spirit,
				game_print_image_url: getPublicImage(spirit.game_print_image_path, spirit.updated_at),
				game_print_no_icons_url: getPublicImage(spirit.game_print_no_icons_path, spirit.updated_at),
				art_raw_image_url: getPublicImage(spirit.art_raw_image_path, spirit.updated_at),
				back_side_base_url: getPublicImage(spirit.back_side_base, spirit.updated_at),
				back_side_export_url: getPublicImage(spirit.back_side_export, spirit.updated_at),
				tts_combined_image_url: getPublicImage(spirit.tts_combined_image_path, spirit.updated_at)
			}));
			artRawVariants = variants;
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	function openSpiritForm(spirit?: HexSpiritRow) {
		if (spirit) {
			const formData = hexSpiritRowToForm(spirit);
			modal.open({
				...formData,
				id: spirit.id
			});
		} else {
			modal.open();
		}
	}

	function addNameTranslationRow() {
		const current = modal.formData.name_translations ?? [];
		modal.formData = {
			...modal.formData,
			name_translations: [...current, { lang: '', name: '' }]
		};
	}

	function updateNameTranslationRow(index: number, patch: Partial<{ lang: string; name: string }>) {
		const current = modal.formData.name_translations ?? [];
		if (index < 0 || index >= current.length) return;
		const next = current.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
		modal.formData = { ...modal.formData, name_translations: next };
	}

	function removeNameTranslationRow(index: number) {
		const current = modal.formData.name_translations ?? [];
		if (index < 0 || index >= current.length) return;
		const next = current.filter((_, idx) => idx !== index);
		modal.formData = { ...modal.formData, name_translations: next };
	}

	function getArtRawVariants(spiritId: string): HexSpiritArtRawVariantRow[] {
		return artRawVariants.filter((variant) => variant.hex_spirit_id === spiritId);
	}

	function getArtRawVariantUrl(variant: HexSpiritArtRawVariantRow): string | null {
		return getPublicImage(variant.storage_path, variant.updated_at);
	}

	function requestArtRawVariationUpload(spirit: HexSpirit) {
		artRawVariationTarget = spirit;
		artRawVariationInput?.click();
	}

	async function handleArtRawVariationInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0] ?? null;
		target.value = '';
		if (!file || !artRawVariationTarget) return;
		await uploadArtRawVariation(artRawVariationTarget, file);
	}

	async function uploadArtRawVariation(spirit: HexSpirit, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 50 * 1024 * 1024) {
			alert('Image must be smaller than 50MB.');
			return;
		}

		artRawVariationUploading = true;
		try {
			const existingCount = getArtRawVariants(spirit.id).length;
			const fileLabel = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
			const label = normalizeArtRawVariantLabel(fileLabel, `Uploaded variation ${existingCount + 1}`);
			const uploadTarget = buildArtRawVariantUploadTarget({
				spiritId: spirit.id,
				spiritName: spirit.name,
				label
			});
			const { data, error: uploadError } = await processAndUploadImage(file, {
				folder: uploadTarget.folder,
				filename: `${uploadTarget.filename}_${Date.now()}`,
				cropTransparent: true,
				upsert: false
			});
			if (uploadError) throw uploadError;
			if (!data?.path) throw new Error('Upload did not return a storage path.');

			await createArtRawVariantRecord({
				hex_spirit_id: spirit.id,
				label,
				description: 'Uploaded from the Hex Spirits editor.',
				storage_path: data.path,
				source: 'uploaded'
			});
			await loadSpirits();
		} catch (err) {
			alert(`Failed to upload art raw variation: ${getErrorMessage(err)}`);
		} finally {
			artRawVariationUploading = false;
			artRawVariationTarget = null;
		}
	}

	async function useArtRawVariant(variant: HexSpiritArtRawVariantRow) {
		try {
			await useArtRawVariantAsCurrent(variant);
			modal.formData.art_raw_image_path = variant.storage_path;
			await loadSpirits();
		} catch (err) {
			alert(`Failed to switch art raw variation: ${getErrorMessage(err)}`);
		}
	}

	async function selectVariationCandidate(candidate: HexSpiritVariationCandidate<HexSpirit>) {
		try {
			await selectVariationForSpirit(candidate.spirit.id, candidate.variant.id);
			await loadSpirits();
		} catch (err) {
			alert(`Failed to select variation: ${getErrorMessage(err)}`);
		}
	}

	async function removeArtRawVariant(variant: HexSpiritArtRawVariantRow) {
		if (isArtRawVariantCurrent(variant, modal.formData.art_raw_image_path)) {
			alert('This variation is currently active. Switch to another art raw before removing it.');
			return;
		}
		if (!confirm(`Remove art raw variation "${variant.label}"?`)) return;

		try {
			await deleteArtRawVariantRecord(variant.id);
			await gameAssetsStorage.remove([variant.storage_path]);
			await loadSpirits();
		} catch (err) {
			alert(`Failed to remove art raw variation: ${getErrorMessage(err)}`);
		}
	}

	async function saveSpirit() {
		if (!modal.formData.name.trim()) {
			alert('Spirit name is required.');
			return;
		}

		try {
			const payload: HexSpiritFormData = {
				...modal.formData,
				traits: {
					origin_ids: modal.formData.traits.origin_ids ?? [],
					class_ids: modal.formData.traits.class_ids ?? []
				},
				game_print_image_path: modal.formData.game_print_image_path ?? null,
				game_print_no_icons_path: modal.formData.game_print_no_icons_path ?? null,
				art_raw_image_path: modal.formData.art_raw_image_path ?? null,
				description: modal.formData.description ?? null,
				description_translations: modal.formData.description_translations ?? []
			};
			if (modal.editingId) {
				payload.id = modal.editingId;
			}
			await saveHexSpiritRecord(payload);
			await loadSpirits();
			modal.close();
		} catch (err) {
			alert(`Failed to save spirit: ${getErrorMessage(err)}`);
		}
	}

	async function deleteSpirit(spirit: HexSpiritRow) {
		if (!confirm(`Delete hex spirit "${spirit.name}"?`)) return;
		try {
			await deleteHexSpiritRecord(spirit.id);
			await loadSpirits();
		} catch (err) {
			alert(`Failed to delete spirit: ${getErrorMessage(err)}`);
		}
	}

	function updateOriginQuantity(originId: string, quantity: number) {
		const qty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
		const filtered = modal.formData.traits.origin_ids.filter((id) => id !== originId);
		const expanded = filtered.concat(Array(qty).fill(originId));
		modal.formData = {
			...modal.formData,
			traits: { ...modal.formData.traits, origin_ids: expanded },
			origin_id: expanded[0] ?? null
		};
	}

	function updateClassQuantity(classId: string, quantity: number) {
		const qty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
		const filtered = modal.formData.traits.class_ids.filter((id) => id !== classId);
		const expanded = filtered.concat(Array(qty).fill(classId));
		modal.formData = {
			...modal.formData,
			traits: { ...modal.formData.traits, class_ids: expanded },
			class_id: expanded[0] ?? null
		};
	}

	function getAwakenRuneTokens(): AwakenRuneToken[] {
		const ac = modal.formData.awaken_condition;
		if (ac?.type === 'rune_cost') return ac.rune_ids ?? [];
		return [];
	}

	function updateRuneCostQuantity(runeId: string, quantity: number) {
		const qty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
		const tokens = getAwakenRuneTokens();
		// Only modify plain string tokens; preserve OR tokens
		const orTokens = tokens.filter((t) => isAwakenOrRuneToken(t));
		const plainTokens = tokens.filter((t): t is string => typeof t === 'string');
		const filtered = plainTokens.filter((id) => id !== runeId);
		const expanded = filtered.concat(Array(qty).fill(runeId));
		const newTokens: AwakenRuneToken[] = [...expanded, ...orTokens];
		modal.formData = {
			...modal.formData,
			awaken_condition: newTokens.length > 0
				? { type: 'rune_cost' as const, rune_ids: newTokens }
				: null
		};
	}

	function countRuneOccurrences(runeId: string): number {
		return getAwakenRuneTokens().filter((t): t is string => typeof t === 'string' && t === runeId).length;
	}

	function addAwakenOrSlot() {
		const tokens = getAwakenRuneTokens();
		if (awakenRuneTokensSlotsUsed(tokens) >= 5) return;
		const newTokens: AwakenRuneToken[] = [...tokens, { kind: 'or', rune_ids: [] }];
		modal.formData = {
			...modal.formData,
			awaken_condition: { type: 'rune_cost' as const, rune_ids: newTokens }
		};
	}

	function updateOrSlotRune(tokenIndex: number, runeId: string, add: boolean) {
		const tokens = [...getAwakenRuneTokens()];
		const token = tokens[tokenIndex];
		if (!token || !isAwakenOrRuneToken(token)) return;
		const ids = [...(token.rune_ids ?? [])];
		if (add && !ids.includes(runeId)) {
			ids.push(runeId);
		} else if (!add) {
			const idx = ids.indexOf(runeId);
			if (idx >= 0) ids.splice(idx, 1);
		}
		tokens[tokenIndex] = { kind: 'or', rune_ids: ids };
		modal.formData = {
			...modal.formData,
			awaken_condition: { type: 'rune_cost' as const, rune_ids: tokens }
		};
	}

	function removeAwakenToken(tokenIndex: number) {
		const tokens = getAwakenRuneTokens().filter((_, i) => i !== tokenIndex);
		modal.formData = {
			...modal.formData,
			awaken_condition: tokens.length > 0
				? { type: 'rune_cost' as const, rune_ids: tokens }
				: null
		};
	}

	function getAwakenConditionType(): 'none' | 'rune_cost' | 'text' {
		if (!modal.formData.awaken_condition) return 'none';
		return modal.formData.awaken_condition.type;
	}

	function setAwakenConditionType(type: 'none' | 'rune_cost' | 'text') {
		if (type === 'none') {
			modal.formData = { ...modal.formData, awaken_condition: null };
		} else if (type === 'rune_cost') {
			modal.formData = { ...modal.formData, awaken_condition: { type: 'rune_cost', rune_ids: [] } };
		} else {
			modal.formData = { ...modal.formData, awaken_condition: { type: 'text', text: '' } };
		}
	}

	function updateAwakenText(text: string) {
		modal.formData = { ...modal.formData, awaken_condition: { type: 'text', text } };
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	// Gallery helper functions
	type ImageVariant = 'game_print' | 'art_raw' | 'back_side';

	function getOriginIconUrl(icon: string | null): { url: string; path: string } | null {
		if (!icon || !icon.includes('/')) return null;
		const normalized = icon.startsWith('origin_icons/') ? icon : `origin_icons/${icon}`;
		const { data } = gameAssetsStorage.getPublicUrl(normalized);
		if (!data?.publicUrl) return null;
		return { url: data.publicUrl, path: normalized };
	}

	function getClassIconUrl(icon: string | null): { url: string; path: string } | null {
		if (!icon || !icon.includes('/')) return null;
		const normalized = icon.startsWith('class_icons/') ? icon : `class_icons/${icon}`;
		const { data } = gameAssetsStorage.getPublicUrl(normalized);
		if (!data?.publicUrl) return null;
		return { url: data.publicUrl, path: normalized };
	}

	function buildIconSlots(
		spirit: HexSpirit
	): { type: 'origin' | 'class'; refId: string; file: string | null }[] {
		const slots: { type: 'origin' | 'class'; refId: string; file: string | null }[] = [];
		const originsOrdered = spirit.traits?.origin_ids ?? [];
		const classesOrdered = spirit.traits?.class_ids ?? [];

		for (const id of originsOrdered) {
			if (!id) continue;
			slots.push({ type: 'origin', refId: id, file: originIconFileMap.get(id) ?? null });
		}
		for (const id of classesOrdered) {
			if (!id) continue;
			slots.push({ type: 'class', refId: id, file: classIconFileMap.get(id) ?? null });
		}
		return slots;
	}

	function flattenIconSlots(
		slots: { type: 'origin' | 'class'; refId: string; file: string | null }[],
		target = 4
	): string[] {
		const filled = slots.slice(0, target);
		while (filled.length < target) {
			filled.push({ type: '', refId: '', file: '' } as any);
		}
		const flat: string[] = [];
		for (const slot of filled) {
			flat.push(slot.type ?? '');
			flat.push(slot.refId ?? '');
			flat.push(slot.file ?? '');
		}
		return flat;
	}

	function renderEmojiToBlob(emoji: string, size = 512): Promise<Blob> {
		return new Promise((resolve, reject) => {
			try {
				const canvas = document.createElement('canvas');
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext('2d', { alpha: true });
				if (!ctx) {
					reject(new Error('Unable to obtain 2D context'));
					return;
				}
				ctx.clearRect(0, 0, size, size);
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = `${size * 0.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
				ctx.fillText(emoji, size / 2, size / 2);
				canvas.toBlob(
					(blob) => {
						if (!blob) {
							reject(new Error('Failed to render emoji blob'));
						} else {
							resolve(blob);
						}
					},
					'image/png'
				);
			} catch (err) {
				reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	async function normalizeImageBuffer(buffer: ArrayBuffer, size = 512): Promise<ArrayBuffer> {
		const blob = new Blob([buffer]);
		const image = await loadImageFromBlob(blob);
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Unable to obtain 2D context');
		ctx.clearRect(0, 0, size, size);
		const scale = Math.max(size / image.width, size / image.height);
		const drawWidth = image.width * scale;
		const drawHeight = image.height * scale;
		const dx = (size - drawWidth) / 2;
		const dy = (size - drawHeight) / 2;
		ctx.drawImage(image, dx, dy, drawWidth, drawHeight);
		const resizedBlob = await canvasToBlob(canvas, 'image/png');
		return resizedBlob.arrayBuffer();
	}

	function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(blob);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(url);
				resolve(img);
			};
			img.onerror = (err) => {
				URL.revokeObjectURL(url);
				reject(err);
			};
			img.src = url;
		});
	}

	function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
		return new Promise((resolve, reject) => {
			canvas.toBlob(
				(blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to convert canvas to blob'));
					}
				},
				type
			);
		});
	}

	function getRarityFromCost(
		cost: number
	): 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Prismatic' {
		if (cost === 1) return 'Common';
		if (cost >= 2 && cost <= 3) return 'Rare';
		if (cost >= 4 && cost <= 5) return 'Epic';
		if (cost === 7) return 'Legendary';
		if (cost >= 9) return 'Prismatic';
		return 'Common';
	}

	function csvEscape(value: string | number | null | undefined): string {
		const str = value === null || value === undefined ? '' : String(value);
		if (/[,"\n]/.test(str)) {
			return '"' + str.replace(/"/g, '""') + '"';
		}
		return str;
	}

	function sanitizeFileName(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50);
	}

	function sanitizeMemberExportName(name: string): string {
		return name
			.trim()
			.replace(/[\[\]]/g, '')
			.replace(/,/g, ' ')
			.replace(/[\\/:*?"<>|]/g, ' ')
			.replace(/\s+/g, ' ')
			.slice(0, 80)
			.trim();
	}

	function getOriginIconFileName(origin: OriginOption): string {
		const slug = sanitizeFileName(origin.name) || origin.id;
		return `origin_${slug}.png`;
	}

	function getClassIconFileName(cls: ClassOption): string {
		const slug = sanitizeFileName(cls.name) || cls.id;
		return `class_${slug}.png`;
	}

	function normalizeHexSpiritPath(path: string): string {
		return path.startsWith('hex_spirits/') ? path : `hex_spirits/${path}`;
	}

	function getCombatPower(cost: number): number {
		if (cost >= 1 && cost <= 3) return 1;
		if (cost >= 4 && cost <= 5) return 1;
		if (cost === 7) return 2;
		if (cost === 9) return 3;
		if (cost === 6) return 2;
		if (cost === 8) return 3;
		return 3;
	}

	const originName = (originId: string | null) =>
		origins.find((origin) => origin.id === originId)?.name ?? 'Unassigned';

	const className = (classId: string | null) =>
		classes.find((cls) => cls.id === classId)?.name ?? 'None';

	function usesBackSpecialClassIconSlot(
		cls: (Pick<ClassRow, 'class_type' | 'is_special'> & { isHuman?: boolean }) | null | undefined
	): boolean {
		return Boolean(cls?.is_special || cls?.class_type === 'special' || cls?.isHuman);
	}

	const FAIRY_CLASS_ID = 'd4752205-1dcb-4f87-8b46-14c4b1bd97d5';
	const ARCANE_SPIRIT_CLASS_ID = '91322cba-4201-48a3-86b1-2d6d034fce3f';
	const FAIRY_DROID_CLASS_ID = '41180098-1490-4223-9a5a-415a6ec89ca0';
	const HUMAN_ENCLAVE_ORIGIN_ID = '48e4acb4-ee9e-42ea-ba82-70165770c368';
	const ROYAL_FAMILY_ORIGIN_ID = '59d3e23e-c7fd-48f9-911d-b8a306029404';
	// Origins that always populate SpecialClassName (using primary class if no is_special class is present).
	const ALWAYS_SPECIAL_ORIGIN_IDS = new Set([HUMAN_ENCLAVE_ORIGIN_ID, ROYAL_FAMILY_ORIGIN_ID]);
	const ORIGIN_TO_SUBFOLDER: Record<string, string> = {
		'Moon Tide': 'tidal',
		'Floral Patch': 'forest',
		'Lantern Lights': 'lantern',
		'Cyber City': 'cyber',
		'Astral Zone': 'astral',
		'Void': 'void',
		'Human Enclave': 'human_enclave',
		'Royal Family': 'royal_family'
	};

	function originToSubfolder(originId: string | null): string | null {
		const name = originName(originId);
		return ORIGIN_TO_SUBFOLDER[name] ?? null;
	}

	function getSpiritTierAndSubfolder(spirit: HexSpirit): { tier: string; subfolder: string } | null {
		const classIds = spirit.traits?.class_ids ?? [];

		// Fairy Droid always exports on the fairy tier, cyber subfolder — regardless of origin.
		if (classIds.includes(FAIRY_DROID_CLASS_ID)) {
			return { tier: 'fairy', subfolder: 'cyber' };
		}

		const isFairy = classIds.includes(FAIRY_CLASS_ID);
		const isArcane = classIds.includes(ARCANE_SPIRIT_CLASS_ID);

		if (isFairy) {
			const primaryOId = primaryOriginId(spirit);
			const subfolder = originToSubfolder(primaryOId);
			return subfolder ? { tier: 'fairy', subfolder } : null;
		}

		if (isArcane) {
			const primaryOId = primaryOriginId(spirit);
			const name = originName(primaryOId);
			// Arcane tier in frames_final.psd uses "florest" (typo) for Floral Patch
			const subfolder = name === 'Floral Patch' ? 'florest' : originToSubfolder(primaryOId);
			return subfolder ? { tier: 'arcane', subfolder } : null;
		}

		const primaryOId = primaryOriginId(spirit);
		const subfolder = originToSubfolder(primaryOId);
		if (!subfolder) return null;

		if (subfolder === 'human_enclave') return { tier: 'human_enclave', subfolder };
		if (subfolder === 'royal_family') return { tier: 'royal_family', subfolder };

		if (spirit.cost >= 11) return null;

		if (spirit.cost < 7) return { tier: 'spirit_world', subfolder };
		if (subfolder === 'void' || subfolder === 'astral') {
			return { tier: 'abyss_void_astral', subfolder };
		}
		return { tier: 'abyss', subfolder };
	}

	function getSampleImageUrls(): Record<FrameTier, string | null> {
		const samples: Record<FrameTier, string | null> = {
			spirit_world: null,
			abyss: null,
			abyss_void_astral: null,
			arcane: null,
			fairy: null,
			human_enclave: null,
			royal_family: null
		};

		for (const spirit of spirits) {
			const sampleUrl = spirit.game_print_no_icons_url || spirit.game_print_image_url;
			if (!sampleUrl) continue;
			const tierInfo = getSpiritTierAndSubfolder(spirit);
			if (tierInfo && !samples[tierInfo.tier as FrameTier]) {
				samples[tierInfo.tier as FrameTier] = sampleUrl;
			}
		}

		return samples;
	}

	function getSampleImageUrlOptions(): Record<FrameTier, string[]> {
		const samples: Record<FrameTier, string[]> = {
			spirit_world: [],
			abyss: [],
			abyss_void_astral: [],
			arcane: [],
			fairy: [],
			human_enclave: [],
			royal_family: []
		};

		for (const spirit of spirits) {
			const sampleUrl = spirit.game_print_no_icons_url || spirit.game_print_image_url;
			if (!sampleUrl) continue;
			const tierInfo = getSpiritTierAndSubfolder(spirit);
			if (!tierInfo) continue;
			const tier = tierInfo.tier as FrameTier;
			if (!samples[tier].includes(sampleUrl)) {
				samples[tier].push(sampleUrl);
			}
		}

		return samples;
	}

	function getGalleryImageUrl(spirit: HexSpirit): string | null {
		if (galleryImageSide === 'back') {
			return spirit.back_side_export_url || spirit.back_side_base_url;
		}

		return spirit.game_print_image_url;
	}

	async function toggleOriginForGrid(originId: string | null) {
		const newSet = new Set(selectedOriginsForGrid);
		if (newSet.has(originId)) {
			newSet.delete(originId);
		} else {
			newSet.add(originId);
		}
		selectedOriginsForGrid = newSet;
	}

	function handleBatchUploadInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const files = target.files ? Array.from(target.files) : [];
		target.value = '';
		void batchUploadGamePrints(files);
	}

	function handleVariationBatchUploadInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const files = target.files ? Array.from(target.files) : [];
		target.value = '';
		void batchUploadVariationGamePrints(files);
	}

	async function handleImageUpload(
		spirit: HexSpirit,
		file: File,
		variant: ImageVariant,
		options: { reloadAfterUpload?: boolean } = {}
	) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 50 * 1024 * 1024) {
			alert('Image must be smaller than 50MB.');
			return;
		}

		try {
			let existingPath: string | null = null;
			if (variant === 'game_print') existingPath = spirit.game_print_no_icons_path;
			else if (variant === 'art_raw') existingPath = spirit.art_raw_image_path;
			else if (variant === 'back_side') existingPath = spirit.back_side_base;

			if (existingPath) {
				await gameAssetsStorage.remove([normalizeHexSpiritPath(existingPath)]);
			}

			const sanitizedName = sanitizeFileName(spirit.name);
			let variantFolder: string;
			let fileName: string;

			if (variant === 'game_print') {
				variantFolder = 'game_print';
				fileName = `hex_${sanitizedName}_game_print_no_icons`;
			} else if (variant === 'back_side') {
				variantFolder = 'back_side';
				fileName = `hex_${sanitizedName}_back_side_base`;
			} else {
				variantFolder = 'art_raw';
				fileName = `hex_${sanitizedName}_art_raw`;
			}
			const folder = `hex_spirits/${spirit.id}/${variantFolder}`;

			// Use unified upload with transparent area cropping
			const { data, error: uploadError } = await processAndUploadImage(file, {
				folder,
				filename: fileName,
				cropTransparent: true,
				upsert: true
			});
			if (uploadError) {
				throw uploadError;
			}

			const fullPath = data?.path ?? '';

			const updateData: {
				game_print_no_icons_path?: string | null;
				art_raw_image_path?: string | null;
				back_side_base?: string | null;
				updated_at: string;
			} = {
				updated_at: new Date().toISOString()
			};
			if (variant === 'game_print') {
				updateData.game_print_no_icons_path = fullPath;
			} else if (variant === 'back_side') {
				updateData.back_side_base = fullPath;
			} else {
				updateData.art_raw_image_path = fullPath;
			}

			const { error: updateError } = await supabase
				.from('hex_spirits')
				.update(updateData)
				.eq('id', spirit.id);
			if (updateError) {
				throw updateError;
			}

			if (options.reloadAfterUpload ?? true) {
				await loadSpirits();
			}
		} catch (err) {
			console.error(err);
			if (options.reloadAfterUpload === false) {
				throw err;
			}
			alert('Failed to upload image. Please try again.');
		}
	}

	function getVariationBatchUploadMatch(file: File): {
		side: BatchUploadSide;
		spiritId: string;
		variantId: string;
	} | null {
		const filename = file.name.replace(/\.[^.]+$/, '');
		const match = filename.match(/^(.+)_(front|back)_game_print$/i);
		if (!match) return null;
		const parsed = parseVariationExportId(match[1]);
		if (!parsed) return null;
		return {
			side: match[2].toLowerCase() === 'back' ? 'back' : 'front',
			...parsed
		};
	}

	async function batchUploadVariationGamePrints(files: File[]) {
		if (!files || files.length === 0) return;
		variationBatchUploadInProgress = true;
		variationBatchUploadProgress = { processed: 0, total: files.length };
		const errors: string[] = [];
		const uploadedCounts = { front: 0, back: 0 };
		const variantsById = new Map(artRawVariants.map((variant) => [variant.id, variant]));

		try {
			for (const file of files) {
				const match = getVariationBatchUploadMatch(file);
				if (!match) {
					errors.push(`${file.name}: missing variation ExportID prefix.`);
					variationBatchUploadProgress.processed += 1;
					continue;
				}

				const variant = variantsById.get(match.variantId);
				if (!variant || variant.hex_spirit_id !== match.spiritId) {
					errors.push(`${file.name}: no matching variation row.`);
					variationBatchUploadProgress.processed += 1;
					continue;
				}

				if (!file.type.startsWith('image/')) {
					errors.push(`${file.name}: not an image file.`);
					variationBatchUploadProgress.processed += 1;
					continue;
				}

				try {
					const uploadFolder =
						match.side === 'front'
							? `hex_spirits/${match.spiritId}/variations/${match.variantId}/game_print`
							: `hex_spirits/${match.spiritId}/variations/${match.variantId}/back_side`;
					const uploadName = match.side === 'front' ? 'front_no_icons' : 'back_side_base';
					const { data, error: uploadError } = await processAndUploadImage(file, {
						folder: uploadFolder,
						filename: uploadName,
						cropTransparent: true,
						upsert: true
					});
					if (uploadError) throw uploadError;
					if (!data?.path) throw new Error('Upload did not return a storage path.');

					await updateArtRawVariantOutputs(match.variantId, {
						...(match.side === 'front'
							? { game_print_no_icons_path: data.path }
							: { back_side_base_path: data.path }),
						pipeline_status: 'uploaded',
						pipeline_error: null
					});
					uploadedCounts[match.side] += 1;
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					errors.push(`${file.name}: ${message}`);
				}

				variationBatchUploadProgress.processed += 1;
			}

			await loadSpirits();
			const countLabel = `${uploadedCounts.front} front variation print(s), ${uploadedCounts.back} back variation print(s)`;
			if (errors.length > 0) {
				alert(`Variation batch upload finished: ${countLabel}, with ${errors.length} issue(s).\n` + errors.slice(0, 5).join('\n'));
			} else {
				alert(`Variation batch upload complete: ${countLabel}.`);
			}
		} finally {
			variationBatchUploadInProgress = false;
		}
	}

	type BatchUploadSide = 'front' | 'back';

	function getBatchUploadSide(file: File): BatchUploadSide | null {
		const path = `${'webkitRelativePath' in file ? file.webkitRelativePath : ''}/${file.name}`.toLowerCase();
		if (/(^|[/_-])front([/_-]|$)/.test(path) || path.includes('front_game_print')) return 'front';
		if (/(^|[/_-])back([/_-]|$)/.test(path) || path.includes('back_game_print') || path.includes('back_side')) return 'back';
		return null;
	}

	async function batchUploadGamePrints(files: File[]) {
		if (!files || files.length === 0) return;
		batchUploadInProgress = true;
		batchUploadProgress = { processed: 0, total: files.length };
		const errors: string[] = [];
		const uploadedCounts = { front: 0, back: 0 };
		for (const file of files) {
			const match = file.name.match(
				/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
			);
			if (!match) {
				errors.push(`${file.name}: missing SpiritID prefix.`);
				batchUploadProgress.processed += 1;
				continue;
			}
			const side = getBatchUploadSide(file);
			if (!side) {
				errors.push(`${file.name}: could not tell if this is a front or back print. Use "_front_game_print" or "_back_game_print" in the filename.`);
				batchUploadProgress.processed += 1;
				continue;
			}
			const spirit = spirits.find((s) => s.id === match[0]);
			if (!spirit) {
				errors.push(`${file.name}: no matching spirit.`);
				batchUploadProgress.processed += 1;
				continue;
			}
			try {
				const imageVariant: ImageVariant = side === 'back' ? 'back_side' : 'game_print';
				await handleImageUpload(spirit, file, imageVariant, { reloadAfterUpload: false });
				uploadedCounts[side] += 1;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push(`${file.name}: ${message}`);
			}
			batchUploadProgress.processed += 1;
		}
		await loadSpirits();
		batchUploadInProgress = false;
		const countLabel = `${uploadedCounts.front} front print(s), ${uploadedCounts.back} back print(s)`;
		if (errors.length > 0) {
			alert(`Batch upload finished: ${countLabel}, with ${errors.length} issue(s).\n` + errors.slice(0, 5).join('\n'));
		} else {
			alert(`Batch upload complete: ${countLabel}.`);
		}
	}

	async function generateTTSCombinedTextures() {
		const eligible = spirits.filter((s) => s.game_print_image_url && s.back_side_export_url);
		if (eligible.length === 0) {
			alert('No spirits with both front and back images found.');
			return;
		}

		generatingTTSCombined = true;
		ttsCombinedProgress = { processed: 0, total: eligible.length, current: '' };
		const errors: string[] = [];

		for (const spirit of eligible) {
			ttsCombinedProgress.current = spirit.name;
			try {
				const blob = await generateCombinedTTSTexture(
					spirit.game_print_image_url!,
					spirit.back_side_export_url!
				);
				const { data, error: uploadError } = await processAndUploadImage(blob, {
					folder: `hex_spirits/${spirit.id}/tts_combined`,
					filename: 'combined',
					cropTransparent: false,
					upsert: true
				});
				if (uploadError) throw uploadError;
				if (data?.path) {
					await supabase
						.from('hex_spirits')
						.update({
							tts_combined_image_path: data.path,
							updated_at: new Date().toISOString()
						})
						.eq('id', spirit.id);
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push(`${spirit.name}: ${message}`);
			}
			ttsCombinedProgress.processed += 1;
		}

		await loadSpirits();
		generatingTTSCombined = false;

		if (errors.length > 0) {
			alert(
				`Generated TTS combined textures with ${errors.length} error(s).\n` +
					errors.slice(0, 5).join('\n')
			);
		} else {
			alert(`Successfully generated ${eligible.length} TTS combined textures!`);
		}
	}

	async function renderTrimmedTTSSide(blob: Blob): Promise<Blob> {
		const image = await loadImageFromBlob(blob);
		const trim = computeSmartTrimRect(image);
		const canvas = document.createElement('canvas');
		canvas.width = TTS_INDEPENDENT_EXPORT_WIDTH;
		canvas.height = TTS_INDEPENDENT_EXPORT_HEIGHT;
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Unable to obtain 2D context');
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.drawImage(
			image,
			trim.sx,
			trim.sy,
			trim.sw,
			trim.sh,
			0,
			0,
			canvas.width,
			canvas.height
		);
		return canvasToBlob(canvas, 'image/png');
	}

	async function exportTTSMemberImportPack() {
		const eligible = spirits.filter((s) => s.game_print_image_url && s.back_side_export_url);
		if (eligible.length === 0) {
			alert('No spirits with both front and back images found.');
			return;
		}

		exportingTTSMemberPack = true;
		ttsMemberPackProgress = { processed: 0, total: eligible.length, current: '' };
		const zip = new JSZip();
		const errors: string[] = [];

		for (const spirit of eligible) {
			ttsMemberPackProgress.current = spirit.name;
			try {
				const [frontSourceBlob, backSourceBlob] = await Promise.all([
					downloadImageAsBlob(spirit.game_print_image_url!),
					downloadImageAsBlob(spirit.back_side_export_url!)
				]);
				const [frontBlob, backBlob] = await Promise.all([
					renderTrimmedTTSSide(frontSourceBlob),
					renderTrimmedTTSSide(backSourceBlob)
				]);
				const memberName = sanitizeMemberExportName(spirit.name) || sanitizeFileName(spirit.name) || spirit.id;
				const quantity = TTS_MEMBER_EXPORT_QUANTITY;
				const frontFileName = `${memberName}[face,${quantity}].png`;
				const backFileName = `${memberName}[back,${quantity}].png`;
				zip.file(frontFileName, await frontBlob.arrayBuffer());
				zip.file(backFileName, await backBlob.arrayBuffer());
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push(`${spirit.name}: ${message}`);
			}
			ttsMemberPackProgress.processed += 1;
		}

		try {
			zip.file('scripts/medium-hex-proof-export.jsx', mediumHexProofExportScript);
			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `hex_spirits_members_import_825x750_${new Date().toISOString().slice(0, 10)}.zip`;
			anchor.click();
			URL.revokeObjectURL(url);

			if (errors.length > 0) {
				alert(
					`Exported independent front/back images with ${errors.length} error(s).\n` +
						errors.slice(0, 5).join('\n')
				);
			} else {
				alert(`Successfully exported ${eligible.length} front/back image pairs.`);
			}
		} catch (err) {
			console.error(err);
			alert('Failed to create ZIP file.');
		} finally {
			exportingTTSMemberPack = false;
		}
	}

	async function exportGridAsPng() {
		if (typeof window === 'undefined') return;
		const table = document.querySelector('.spirit-matrix') as HTMLElement | null;
		if (!table) {
			alert('Grid view must be visible to export.');
			return;
		}
		exportingGridImage = true;
		try {
			const canvas = await html2canvas(table, {
				backgroundColor: '#0f172a',
				scale: Math.max(2, window.devicePixelRatio * 2),
				useCORS: true,
				allowTaint: false,
				logging: false
			});
			const dataUrl = canvas.toDataURL('image/png');
			const link = document.createElement('a');
			link.href = dataUrl;
			link.download = `hex_spirits_game_prints_grid_${new Date().toISOString().slice(0, 10)}.png`;
			link.click();
		} catch (err) {
			console.error(err);
			alert('Failed to export grid as PNG.');
		} finally {
			exportingGridImage = false;
		}
	}

	async function generateWithIcons(tierOnly?: FrameTier) {
		// Filter to spirits that have a base image AND are not manually set
		const spiritsWithGamePrint = spirits.filter(
			(s) => (s.game_print_no_icons_url || s.game_print_image_url) && !s.manual_game_print
		).filter((spirit) => {
			const tierInfo = getSpiritTierAndSubfolder(spirit);
			if (!tierInfo) return false;
			if (!tierOnly) return true;
			return tierInfo.tier === tierOnly;
		});

		const skippedManual = spirits
			.filter((s) => s.manual_game_print)
			.filter((spirit) => {
				const tierInfo = getSpiritTierAndSubfolder(spirit);
				if (!tierInfo) return false;
				if (!tierOnly) return true;
				return tierInfo.tier === tierOnly;
			}).length;

		if (spiritsWithGamePrint.length === 0) {
			const scopeLabel = tierOnly ? ` for "${tierOnly}"` : '';
			const msg = skippedManual > 0
				? `No spirits to generate${scopeLabel}. ${skippedManual} spirit(s) are marked as manual and were skipped.`
				: 'No spirits with game prints found.';
			alert(msg);
			return;
		}

		generatingWithIcons = true;
		generatingProgress = { processed: 0, total: spiritsWithGamePrint.length, current: '' };

		const config = await loadFrontIconPlacementConfigFromDatabase();
		const zip = new JSZip();
		const errors: string[] = [];

		for (const spirit of spiritsWithGamePrint) {
			generatingProgress.current = spirit.name;

			try {
				const tierInfo = getSpiritTierAndSubfolder(spirit);

				// Skip spirits with no tier mapping
				if (!tierInfo) {
					generatingProgress.processed += 1;
					continue;
				}

				const iconSlots: SpiritIconData[] = [];
				const originIds = spirit.traits?.origin_ids ?? [];
				const classIds = spirit.traits?.class_ids ?? [];

				for (const originId of originIds) {
					const origin = origins.find((o) => o.id === originId);
					if (origin?.icon_png) {
						const iconInfo = getOriginIconUrl(origin.icon_png);
						if (iconInfo) {
							iconSlots.push({ type: 'origin', iconUrl: iconInfo.url });
						}
					}
				}

				for (const classId of classIds) {
					const cls = classes.find((c) => c.id === classId);
					if (cls?.icon_png) {
						const iconInfo = getClassIconUrl(cls.icon_png);
						if (iconInfo) {
							iconSlots.push({ type: 'class', iconUrl: iconInfo.url });
						}
					}
				}

				// Prefer game_print_no_icons_url, fallback to game_print_image_url
				const sourceImageUrl = spirit.game_print_no_icons_url || spirit.game_print_image_url;
				if (!sourceImageUrl) {
					throw new Error('No game print image available');
				}

				const resultBlob = await generateSpiritWithIcons({
					gamePrintUrl: sourceImageUrl,
					iconSlots,
					config,
					tier: tierInfo.tier as FrameTier
				});

				// Upload to storage
				const storagePath = `hex_spirits/${spirit.id}_game_print.png`;
				const { error: uploadError } = await gameAssetsStorage.upload(storagePath, resultBlob, {
					contentType: 'image/png',
					upsert: true
				});

				if (uploadError) {
					throw uploadError;
				}

				// Update database with new path
				const { error: updateError } = await supabase
					.from('hex_spirits')
					.update({
						game_print_image_path: storagePath,
						updated_at: new Date().toISOString()
					})
					.eq('id', spirit.id);

				if (updateError) {
					throw updateError;
				}

				// Still add to zip for download
				const safeSlug = sanitizeFileName(spirit.name) || 'spirit';
				const fileName = `${spirit.id}_${safeSlug}_game_print_with_icons.png`;
				zip.file(fileName, await resultBlob.arrayBuffer());
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push(`${spirit.name}: ${message}`);
			}

			generatingProgress.processed += 1;
		}

		// Reload spirits to get updated URLs
		await loadSpirits();

		try {
			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			const dateTag = new Date().toISOString().slice(0, 10);
			const tierTag = tierOnly ? `_${tierOnly}` : '';
			anchor.download = `game_prints_with_icons${tierTag}_${dateTag}.zip`;
			anchor.click();
			URL.revokeObjectURL(url);

			const scopeLabel = tierOnly ? ` for "${tierOnly}"` : '';
			if (errors.length > 0) {
				alert(
					`Generated ${spiritsWithGamePrint.length - errors.length} images${scopeLabel} with ${errors.length} error(s).` +
						(skippedManual > 0 ? ` (${skippedManual} manual spirits skipped${scopeLabel})` : '') +
						'\n' + errors.slice(0, 5).join('\n')
				);
			} else {
				const skippedMsg = skippedManual > 0 ? ` (${skippedManual} manual spirits skipped${scopeLabel})` : '';
				alert(`Successfully generated ${spiritsWithGamePrint.length} game prints with icons${scopeLabel}!${skippedMsg}`);
			}
		} catch (err) {
			console.error(err);
			alert('Failed to create ZIP file.');
		}

		generatingWithIcons = false;
		iconPlacerOpen = false;
	}

	function generateAllWithIcons() {
		return generateWithIcons();
	}

	function generateTierWithIcons(tier: FrameTier) {
		return generateWithIcons(tier);
	}

	function getBackSampleImageUrl(): string | null {
		for (const spirit of spirits) {
			if (spirit.back_side_base_url) return spirit.back_side_base_url;
		}
		return null;
	}

	function getBackSampleImageUrls(): string[] {
		const urls: string[] = [];
		for (const spirit of spirits) {
			if (spirit.back_side_base_url && !urls.includes(spirit.back_side_base_url)) {
				urls.push(spirit.back_side_base_url);
			}
		}
		return urls;
	}

	function pipelineStatusLabel(status: HexSpiritPipelineStatus | ''): string {
		if (status === 'queued') return 'Queued';
		if (status === 'front') return 'Front';
		if (status === 'back') return 'Back';
		if (status === 'combined') return 'Combined';
		if (status === 'complete') return 'Complete';
		if (status === 'failed') return 'Failed';
		return 'Idle';
	}

	const pipelineEligibleCount = $derived(
		spirits.filter((spirit) => {
			const hasFrontSource = spirit.manual_game_print
				? Boolean(spirit.game_print_image_url || spirit.game_print_image_path)
				: Boolean(spirit.game_print_no_icons_url || spirit.game_print_image_url);
			return hasFrontSource && Boolean(spirit.back_side_base_url);
		}).length
	);

	const variationPipelineEligibleCount = $derived(
		filteredVariationCandidates.filter((candidate) =>
			Boolean(candidate.frontNoIconsUrl || candidate.frontUrl) && Boolean(candidate.backBaseUrl)
		).length
	);

	function candidateToPipelineSpirit(
		candidate: HexSpiritVariationCandidate<HexSpirit>
	): HexSpiritPipelineSpirit {
		return {
			...candidate.spirit,
			game_print_image_path: candidate.variant.game_print_image_path,
			game_print_no_icons_path: candidate.variant.game_print_no_icons_path,
			art_raw_image_path: candidate.variant.storage_path,
			back_side_base: candidate.variant.back_side_base_path,
			back_side_export: candidate.variant.back_side_export_path,
			tts_combined_image_path: candidate.variant.tts_combined_image_path,
			game_print_image_url: candidate.frontUrl,
			game_print_no_icons_url: candidate.frontNoIconsUrl,
			art_raw_image_url: candidate.rawArtUrl,
			back_side_base_url: candidate.backBaseUrl,
			back_side_export_url: candidate.backUrl,
			tts_combined_image_url: candidate.ttsCombinedUrl,
			manual_game_print: false,
			pipeline_target: { kind: 'variation', variantId: candidate.variant.id }
		};
	}

	async function generateHexSpiritPipeline() {
		const eligible = spirits.filter((spirit) => {
			const hasFrontSource = spirit.manual_game_print
				? Boolean(spirit.game_print_image_url || spirit.game_print_image_path)
				: Boolean(spirit.game_print_no_icons_url || spirit.game_print_image_url);
			return hasFrontSource && Boolean(spirit.back_side_base_url);
		});

		if (eligible.length === 0) {
			alert('No spirits have both a usable front source and a back side base image.');
			return;
		}

		pipelineInProgress = true;
		pipelineSummary = null;
		pipelineProgress = {
			processed: 0,
			total: eligible.length,
			failed: 0,
			current: '',
			status: 'queued'
		};

		try {
			const summary = await runHexSpiritBatchPipeline({
				spirits: eligible,
				origins,
				classes,
				runes,
				frontConfig: await loadFrontIconPlacementConfigFromDatabase(),
				backConfig: await loadBackIconPlacementConfigFromDatabase(),
				concurrency: pipelineConcurrency,
				getTier: (spirit) => (getSpiritTierAndSubfolder(spirit)?.tier ?? null) as FrameTier | null,
				onProgress: (progress) => {
					pipelineProgress = {
						processed: progress.completed + progress.failed,
						total: progress.total,
						failed: progress.failed,
						current: progress.spiritName,
						status: progress.status
					};
				}
			});

			pipelineSummary = summary;
			await loadSpirits();

			const failures = summary.results.filter((result) => !result.success);
			if (failures.length > 0) {
				alert(
					`HexSpirit pipeline completed with ${summary.completed} success(es) and ${summary.failed} failure(s).\n` +
						failures.slice(0, 5).map((result) => `${result.spiritName}: ${result.error}`).join('\n')
				);
			} else {
				alert(`HexSpirit pipeline completed for ${summary.completed} spirit(s).`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`HexSpirit pipeline failed: ${message}`);
		} finally {
			pipelineInProgress = false;
		}
	}

	async function generateVariationHexSpiritPipeline() {
		const eligible = filteredVariationCandidates
			.filter((candidate) =>
				Boolean(candidate.frontNoIconsUrl || candidate.frontUrl) && Boolean(candidate.backBaseUrl)
			)
			.map(candidateToPipelineSpirit);

		if (eligible.length === 0) {
			alert('No variation rows have both a front source and a back base image.');
			return;
		}

		pipelineInProgress = true;
		pipelineSummary = null;
		pipelineProgress = {
			processed: 0,
			total: eligible.length,
			failed: 0,
			current: '',
			status: 'queued'
		};

		try {
			const summary = await runHexSpiritBatchPipeline({
				spirits: eligible,
				origins,
				classes,
				runes,
				frontConfig: await loadFrontIconPlacementConfigFromDatabase(),
				backConfig: await loadBackIconPlacementConfigFromDatabase(),
				concurrency: pipelineConcurrency,
				getTier: (spirit) => (getSpiritTierAndSubfolder(spirit)?.tier ?? null) as FrameTier | null,
				onProgress: (progress) => {
					pipelineProgress = {
						processed: progress.completed + progress.failed,
						total: progress.total,
						failed: progress.failed,
						current: progress.spiritName,
						status: progress.status
					};
				}
			});

			pipelineSummary = summary;
			await loadSpirits();

			const failures = summary.results.filter((result) => !result.success);
			if (failures.length > 0) {
				alert(
					`Variation pipeline completed with ${summary.completed} success(es) and ${summary.failed} failure(s).\n` +
						failures.slice(0, 5).map((result) => `${result.spiritName}: ${result.error}`).join('\n')
				);
			} else {
				alert(`Variation pipeline completed for ${summary.completed} variant(s).`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Variation pipeline failed: ${message}`);
		} finally {
			pipelineInProgress = false;
		}
	}

	function getRuneIconUrl(iconPath: string | null): string | null {
		if (!iconPath) return null;
		const normalized = iconPath.startsWith('runes/') ? iconPath : `runes/${iconPath}`;
		const { data } = gameAssetsStorage.getPublicUrl(normalized);
		return data?.publicUrl ?? null;
	}

	async function generateBackWithIconsPipeline() {
		const spiritsWithBackSide = spirits.filter((s) => s.back_side_base_url);

		if (spiritsWithBackSide.length === 0) {
			alert('No spirits with back side base images found.');
			return;
		}

		generatingBackIcons = true;
		generatingBackProgress = { processed: 0, total: spiritsWithBackSide.length, current: '' };

		const backConfig = await loadBackIconPlacementConfigFromDatabase();
		const frontConfig = await loadFrontIconPlacementConfigFromDatabase();
		const zip = new JSZip();
		const errors: string[] = [];

		for (const spirit of spiritsWithBackSide) {
			generatingBackProgress.current = spirit.name;

			try {
				const tierInfo = getSpiritTierAndSubfolder(spirit);
				const tier = (tierInfo?.tier ?? 'spirit_world') as FrameTier;

				const iconSlots: SpiritIconData[] = [];
				const originIds = spirit.traits?.origin_ids ?? [];
				const classIds = spirit.traits?.class_ids ?? [];

				for (const originId of originIds) {
					const origin = origins.find((o) => o.id === originId);
					if (origin?.icon_png) {
						const iconInfo = getOriginIconUrl(origin.icon_png);
						if (iconInfo) {
							iconSlots.push({ type: 'origin', iconUrl: iconInfo.url });
						}
					}
				}

				for (const classId of classIds) {
					const cls = classes.find((c) => c.id === classId);
					if (usesBackSpecialClassIconSlot(cls)) continue; // special/human class icon is placed separately
					if (cls?.icon_png) {
						const iconInfo = getClassIconUrl(cls.icon_png);
						if (iconInfo) {
							iconSlots.push({ type: 'class', iconUrl: iconInfo.url });
						}
					}
				}

				const runeIconSlots: RuneIconData[] = [];
				const awakenCondition = spirit.awaken_condition;
				if (awakenCondition?.type === 'rune_cost' && awakenCondition.rune_ids?.length) {
					for (const token of awakenCondition.rune_ids) {
						if (typeof token === 'string') {
							const rune = runes.find((r) => r.id === token);
							if (!rune?.icon_path) continue;
							const iconUrl = getRuneIconUrl(rune.icon_path);
							if (iconUrl) {
								runeIconSlots.push({ type: 'single', iconUrl });
							}
						} else if (token && typeof token === 'object' && token.kind === 'or') {
							const urls: string[] = [];
							for (const runeId of token.rune_ids ?? []) {
								const rune = runes.find((r) => r.id === runeId);
								if (!rune?.icon_path) continue;
								const iconUrl = getRuneIconUrl(rune.icon_path);
								if (iconUrl) urls.push(iconUrl);
							}
							if (urls.length > 0) {
								runeIconSlots.push({ type: 'or', iconUrls: urls });
							}
						}
					}
				}

				const awakenText = spirit.awaken_condition?.type === 'text' ? spirit.awaken_condition.text : null;

				// Find special class icon URL
				let specialClassIconUrl: string | null = null;
				const specialCls = classIds
					.map((cid) => classes.find((c) => c.id === cid))
					.find((c) => usesBackSpecialClassIconSlot(c));
				if (specialCls?.icon_png) {
					const iconInfo = getClassIconUrl(specialCls.icon_png);
					if (iconInfo) specialClassIconUrl = iconInfo.url;
				}

				const resultBlob = await generateBackWithIcons({
					backSideUrl: spirit.back_side_base_url!,
					iconSlots,
					runeSlots: runeIconSlots,
					backConfig,
					frontConfig,
					tier,
					awakenText,
					specialClassIconUrl
				});

				// Upload to storage
				const storagePath = `hex_spirits/${spirit.id}_back_side_export.png`;
				const { error: uploadError } = await gameAssetsStorage.upload(storagePath, resultBlob, {
					contentType: 'image/png',
					upsert: true
				});

				if (uploadError) {
					throw uploadError;
				}

				// Update database
				const { error: updateError } = await supabase
					.from('hex_spirits')
					.update({
						back_side_export: storagePath,
						updated_at: new Date().toISOString()
					})
					.eq('id', spirit.id);

				if (updateError) {
					throw updateError;
				}

				// Add to zip
				const safeSlug = sanitizeFileName(spirit.name) || 'spirit';
				const fileName = `${spirit.id}_${safeSlug}_back_side_export.png`;
				zip.file(fileName, await resultBlob.arrayBuffer());
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push(`${spirit.name}: ${message}`);
			}

			generatingBackProgress.processed += 1;
		}

		await loadSpirits();

		try {
			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `back_prints_with_icons_${new Date().toISOString().slice(0, 10)}.zip`;
			anchor.click();
			URL.revokeObjectURL(url);

			const generated = spiritsWithBackSide.length - errors.length;
			if (errors.length > 0) {
				alert(
					`Generated ${generated} back prints with ${errors.length} error(s).\n` +
						errors.slice(0, 5).join('\n')
				);
			} else {
				alert(`Successfully generated ${generated} back prints with icons!`);
			}
		} catch (err) {
			console.error(err);
			alert('Failed to create ZIP file.');
		}

		generatingBackIcons = false;
		backIconPlacerOpen = false;
	}

	type ArtRawPackItem = {
		spirit: HexSpirit;
		variantId: string;
		exportId: string;
		artRawPath: string | null;
		artUpdatedAt: string | null;
		existingGamePrintPath: string | null;
	};

	async function exportArtRawPack(
		filterMissingGamePrints = false,
		variationItems: HexSpiritVariationCandidate<HexSpirit>[] | null = null
	) {
		const isVariationPack = Boolean(variationItems);
		const packItems: ArtRawPackItem[] = isVariationPack
			? (variationItems ?? []).map((candidate) => ({
					spirit: candidate.spirit,
					variantId: candidate.variant.id,
					exportId: candidate.exportId,
					artRawPath: candidate.variant.storage_path,
					artUpdatedAt: candidate.variant.updated_at,
					existingGamePrintPath: candidate.variant.game_print_image_path
				}))
			: spirits.map((spirit) => ({
					spirit,
					variantId: '',
					exportId: spirit.id,
					artRawPath: spirit.art_raw_image_path,
					artUpdatedAt: spirit.updated_at,
					existingGamePrintPath: spirit.game_print_image_path
				}));

		if (packItems.length === 0) {
			alert(isVariationPack ? 'No variation art rows to export.' : 'Load spirits before exporting.');
			return;
		}

		if (isVariationPack) {
			exportingVariationArtPack = true;
		} else if (filterMissingGamePrints) {
			exportingMissingPrintsPack = true;
		} else {
			exportingArtPack = true;
		}
		try {
			const zip = new JSZip();
			const artFolder = zip.folder('art_raw');
			const originFolder = zip.folder('origin_icons');
			const classFolder = zip.folder('class_icons');
			originIconFileMap.clear();
			classIconFileMap.clear();
			for (const origin of origins) {
				originIconFileMap.set(origin.id, getOriginIconFileName(origin));
			}
			for (const cls of classes) {
				classIconFileMap.set(cls.id, getClassIconFileName(cls));
			}
			const runeMap = new Map(runes.map((r) => [r.id, r]));

			const csvRows: string[][] = [
				[
					'SpiritID',
					'VariantID',
					'ExportID',
					'Name',
					'Cost',
					'ClassName',
					'OriginName',
					'Tier',
					'OriginSubfolder',
					'ArtRawFile',
					'GamePrintFile',
					'ArtRawStoragePath',
					'ExistingGamePrintPath',
					'Icon1Type',
					'Icon1RefId',
					'Icon1File',
					'Icon2Type',
					'Icon2RefId',
					'Icon2File',
					'Icon3Type',
					'Icon3RefId',
					'Icon3File',
					'Icon4Type',
					'Icon4RefId',
					'Icon4File',
					'RuneCost_Count',
					'RuneCost_RuneIds',
					'RuneCost_Files',
					'SpecialClassName',
					'SpecialClassDesc',
					'AwakenType',
					'AwakenText'
				]
			];
			let missingCount = 0;
			for (const item of packItems) {
				const spirit = item.spirit;
				if (!isVariationPack && filterMissingGamePrints && spirit.game_print_image_path) {
					continue;
				}
				if (!item.artRawPath) {
					missingCount += 1;
					continue;
				}
				const artUrl = getPublicImage(item.artRawPath, item.artUpdatedAt);
				if (!artUrl || !artFolder) {
					missingCount += 1;
					continue;
				}
				const blob = await downloadImageAsBlob(artUrl);
				const buffer = await blob.arrayBuffer();
				const safeSlug =
					sanitizeFileName(
						`${spirit.name}_${originName(primaryOriginId(spirit))}_${className(primaryClassId(spirit))}`
					) || 'spirit';
				const artFileName = `${item.exportId}_${safeSlug}_art_raw.png`;
				const gamePrintFileName = `${item.exportId}_game_print.png`;
				artFolder.file(artFileName, buffer);
				const iconSlots = buildIconSlots(spirit);
				const flatIcons = flattenIconSlots(iconSlots, 4);

				const runeCostTokens = spirit.awaken_condition?.type === 'rune_cost' ? spirit.awaken_condition.rune_ids ?? [] : [];
				// Flatten all rune IDs for count; serialize tokens with + for OR groups and | between tokens
				const allRuneIds: string[] = [];
				const tokenSerials: string[] = [];
				const tokenFiles: string[] = [];
				for (const token of runeCostTokens) {
					if (typeof token === 'string') {
						allRuneIds.push(token);
						tokenSerials.push(token);
						const rune = runeMap.get(token);
						if (rune) {
							const runeType = rune.origin_id ? 'origin' : 'class';
							const safeRuneName = sanitizeFileName(rune.name ?? 'unknown');
							tokenFiles.push(`${runeType}_${safeRuneName}.png`);
						} else {
							tokenFiles.push('');
						}
					} else if (token && typeof token === 'object' && token.kind === 'or') {
						const ids = token.rune_ids ?? [];
						allRuneIds.push(...ids);
						tokenSerials.push(ids.join('+'));
						const files = ids.map((id) => {
							const rune = runeMap.get(id);
							if (!rune) return '';
							const runeType = rune.origin_id ? 'origin' : 'class';
							const safeRuneName = sanitizeFileName(rune.name ?? 'unknown');
							return `${runeType}_${safeRuneName}.png`;
						});
						tokenFiles.push(files.join('+'));
					}
				}
				const runeCostColumns = [
					String(allRuneIds.length),
					tokenSerials.join('|'),
					tokenFiles.join('|')
				];

				const tierInfo = getSpiritTierAndSubfolder(spirit);

				// Find the spirit's special class (if any) and its first breakpoint description.
				// Human Enclave and Royal Family spirits may not have an `is_special` class, but
				// still show the SPECIAL_CLASS overlay using their primary class as the headline.
				const spiritClassIds = spirit.traits?.class_ids ?? [];
				const spiritClasses = spiritClassIds
					.map((cid) => classes.find((c) => c.id === cid))
					.filter((c): c is NonNullable<typeof c> => !!c);
				const spiritOriginIds = spirit.traits?.origin_ids ?? [];
				const alwaysSpecial = spiritOriginIds.some((oid) => ALWAYS_SPECIAL_ORIGIN_IDS.has(oid));
				const specialCls = spiritClasses.find((c) => c.is_special)
					?? (alwaysSpecial ? spiritClasses[0] : undefined);
				let specialClassName = '';
				let specialClassDesc = '';
				if (specialCls) {
					specialClassName = specialCls.name.trim();
					const breakpoints = parseEffectSchema(specialCls.effect_schema);
					if (breakpoints.length > 0) {
						const bp = breakpoints[0];
						const parts = bp.effects.map((e) => formatEffectSummary(e));
						specialClassDesc = (bp.description
							? bp.description
							: parts.join(', ')).trim();
					}
				}

				// Map web tier names to PSD layer names for CSV export
				const psdTier = tierInfo?.tier === 'abyss_void_astral' ? 'abyss' : (tierInfo?.tier ?? '');

				const awakenType = spirit.awaken_condition?.type ?? 'none';
				const awakenText = spirit.awaken_condition?.type === 'text' ? (spirit.awaken_condition.text ?? '').trim() : '';

				csvRows.push([
					spirit.id,
					item.variantId,
					item.exportId,
					spirit.name,
					String(spirit.cost),
					className(primaryClassId(spirit)),
					originName(primaryOriginId(spirit)),
					psdTier,
					tierInfo?.subfolder ?? '',
					artFileName,
					gamePrintFileName,
					item.artRawPath ?? '',
					item.existingGamePrintPath ?? '',
					...flatIcons,
					...runeCostColumns,
					specialClassName,
					specialClassDesc,
					awakenType,
					awakenText
				]);
			}

			if (originFolder) {
				for (const origin of origins) {
					const iconInfo = getOriginIconUrl(origin.icon_png ?? null);
					try {
						let buffer: ArrayBuffer | null = null;
						if (iconInfo) {
							const iconBlob = await downloadImageAsBlob(iconInfo.url);
							const rawBuffer = await iconBlob.arrayBuffer();
							buffer = await normalizeImageBuffer(rawBuffer);
						} else if (origin.icon_emoji) {
							const emojiBlob = await renderEmojiToBlob(origin.icon_emoji);
							buffer = await emojiBlob.arrayBuffer();
						}
						if (buffer) {
							const iconFile = originIconFileMap.get(origin.id);
							if (iconFile) {
								originFolder.file(iconFile, buffer);
							}
						}
					} catch (iconErr) {
						console.warn('Failed to include origin icon', origin.name, iconErr);
					}
				}
			}
			if (classFolder) {
				for (const cls of classes) {
					const iconInfo = getClassIconUrl(cls.icon_png ?? null);
					try {
						let buffer: ArrayBuffer | null = null;
						if (iconInfo) {
							const classBlob = await downloadImageAsBlob(iconInfo.url);
							const rawBuffer = await classBlob.arrayBuffer();
							buffer = await normalizeImageBuffer(rawBuffer);
						} else if (cls.icon_emoji) {
							const emojiBlob = await renderEmojiToBlob(cls.icon_emoji);
							buffer = await emojiBlob.arrayBuffer();
						}
						if (buffer) {
							const classFile = classIconFileMap.get(cls.id);
							if (classFile) {
								classFolder.file(classFile, buffer);
							}
						}
					} catch (classErr) {
						console.warn('Failed to include class icon', cls.name, classErr);
					}
				}
			}

			const runesFolder = zip.folder('runes');
			if (runesFolder) {
				for (const rune of runes) {
					if (!rune.icon_path) continue;
					try {
						const iconPath = rune.icon_path.startsWith('runes/')
							? rune.icon_path
							: `runes/${rune.icon_path}`;
						const { data: urlData } = gameAssetsStorage.getPublicUrl(iconPath);
						if (!urlData?.publicUrl) continue;

						const runeBlob = await downloadImageAsBlob(urlData.publicUrl);
						const buffer = await runeBlob.arrayBuffer();

						const runeType = rune.origin_id ? 'origin' : 'class';
						const safeRuneName = sanitizeFileName(rune.name);
						const fileName = `${runeType}_${safeRuneName}.png`;

						runesFolder.file(fileName, buffer);
					} catch (runeErr) {
						console.warn('Failed to include rune icon', rune.name, runeErr);
					}
				}
			}

			const csvContent = csvRows.map((row) => row.map(csvEscape).join(',')).join('\n');
			zip.file('hex_spirits_art_raw.csv', csvContent);
			zip.file('scripts/hex-spirit-game-print.jsx', gamePrintScript);
			zip.file('scripts/update_photoshop_template_path.py', templateUpdaterScript);
			zip.file(
				'README.txt',
				`Export generated ${new Date().toISOString()}\n\nContents:\n- art_raw/: every spirit art asset used to generate game prints.\n- origin_icons/ & class_icons/: the latest icon files auto-downloaded from Supabase.\n- runes/: all rune icon PNGs (origin-based and class-based runes).\n- hex_spirits_art_raw.csv: metadata consumed by the Photoshop script.\n- scripts/: automation helpers (Photoshop JSX + Python updater).\n\nCSV columns:\n- SpiritID: matches PNG filename prefix for batch uploads.\n- ArtRawFile: fed into Photoshop script.\n- GamePrintFile: base filename used by the script to derive front/back output filenames.\n- ArtRawStoragePath / ExistingGamePrintPath: Supabase locations to help target missing renders.\n- Icon1..4 (Type/RefId/File): icon slots used for placeholder_icon layers in Photoshop.\n- RuneCost1/2 (RuneId/Quantity/File): rune requirements for the spirit. File references runes/ folder.\n\nIncluded scripts:\n- scripts/hex-spirit-game-print.jsx (already configured to read this export's CSV/art folders and the shared template).\n- scripts/update_photoshop_template_path.py (optional helper: run 'python scripts/update_photoshop_template_path.py --template /new/path/to/spirit_hex_grey.psd' if the template ever moves).\n\nWorkflow:\n1. Unzip this package anywhere. No manual path edits are required—the JSX script locates the CSV/art folders relative to itself.\n2. Open Photoshop -> File -> Scripts -> Browse... and select scripts/hex-spirit-game-print.jsx. Choose the export folder when prompted (if Photoshop asks).\n3. The script renders front and back cards into one /game_prints folder. Front files end in _front_game_print.png; back files end in _back_game_print.png.\n4. Back in the Hex Spirits admin, use the single Batch Upload Game Prints control and choose the /game_prints folder.\n\nTemplate expectations:\n- Root layer group named "Hex" exists and remains visible.\n- 'Hex/Art/IMAGE_PLACEHOLDER' is a smart object; the script swaps it with each art raw.\n- Rarity folders ('Common', 'Rare', 'Epic', 'Legendary', 'Prismatic') live under 'Hex/' and each contains an 'Info' group with 'Name', 'Cost', 'Role', 'Origin', etc.\n- Role variants ('Role', 'Role2', 'Role3') and origin variants ('Origin', 'Origin2') exist for Legendary/Prismatic cards.\n- All rarity folders are present even if hidden—the script toggles visibility per card.\n`
			);
			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
				anchor.download = `${isVariationPack ? 'hex_spirits_variation_art_pack' : 'hex_spirits_art_pack'}_${new Date().toISOString().slice(0, 10)}.zip`;
			anchor.click();
			URL.revokeObjectURL(url);
				const message = missingCount
					? `Export complete. ${missingCount} ${isVariationPack ? 'variation rows' : 'spirits'} had no art raw and were skipped.`
					: 'Export complete!';
				alert(message);
		} catch (err) {
			console.error(err);
			alert('Failed to build export pack.');
		} finally {
				if (isVariationPack) {
					exportingVariationArtPack = false;
				} else if (filterMissingGamePrints) {
					exportingMissingPrintsPack = false;
				} else {
				exportingArtPack = false;
			}
		}
	}

	const gridViewData = $derived.by(() => {
		const classSet = new Set<string | null>();
		const originSet = new Set<string | null>();

		filteredSpirits.forEach((spirit) => {
			const spiritOriginId = primaryOriginId(spirit);
			const spiritClassId = primaryClassId(spirit);
			classSet.add(spiritClassId);
			originSet.add(spiritOriginId);
		});

		const specialClass = classes.find((c) => c.name === 'Special');
		if (specialClass) {
			classSet.add(specialClass.id);
		}

		const classList = Array.from(classSet)
			.map((classId) => {
				const classSpirits = filteredSpirits.filter((s) => primaryClassId(s) === classId);
				const count = classSpirits.length;
				const combatPower = classSpirits.reduce((sum, s) => sum + getCombatPower(s.cost), 0);
				const cls = classId ? classes.find((c) => c.id === classId) : null;
				return {
					classId,
					className: className(classId),
					position: cls?.position ?? 9999,
					count,
					combatPower,
					powerRatio: count > 0 ? (combatPower / count).toFixed(2) : '0.00'
				};
			})
			.sort((a, b) => a.position - b.position);

		const originList = Array.from(originSet)
			.filter((originId) => selectedOriginsForGrid.has(originId))
			.map((originId) => {
				const originSpirits = filteredSpirits.filter((s) => primaryOriginId(s) === originId);
				const count = originSpirits.length;
				const combatPower = originSpirits.reduce((sum, s) => sum + getCombatPower(s.cost), 0);
				const origin = originId ? origins.find((o) => o.id === originId) : null;
				return {
					originId,
					originName: originName(originId),
					position: origin?.position ?? 9999,
					count,
					combatPower,
					powerRatio: count > 0 ? (combatPower / count).toFixed(2) : '0.00'
				};
			})
			.sort((a, b) => a.position - b.position);

		const grid: Map<string | null, Map<string | null, HexSpirit[]>> = new Map();

		classList.forEach(({ classId }) => {
			grid.set(classId, new Map());
			originList.forEach(({ originId }) => {
				grid.get(classId)!.set(originId, []);
			});
		});

		filteredSpirits.forEach((spirit) => {
			const spiritOriginId = primaryOriginId(spirit);
			const spiritClassId = primaryClassId(spirit);
			const classMap = grid.get(spiritClassId);
			if (classMap) {
				const cell = classMap.get(spiritOriginId);
				if (cell) {
					cell.push(spirit);
				}
			}
		});

		return {
			classList,
			originList,
			grid
		};
	});
</script>

<PageLayout
	title="Hex Spirits"
	subtitle="Manage spirit definitions, traits, costs, and images"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		<Button variant="primary" onclick={() => openSpiritForm()}>Create Hex Spirit</Button>
	{/snippet}

	{#snippet tabActions()}
		<div class="asset-view-toggle">
			<button
				type="button"
				class:active={assetViewMode === 'primary'}
				onclick={() => (assetViewMode = 'primary')}
			>
				Primary
			</button>
			<button
				type="button"
				class:active={assetViewMode === 'variation'}
				onclick={() => (assetViewMode = 'variation')}
			>
				Variation
			</button>
		</div>
		<span class="spirit-count">
			{assetViewMode === 'variation'
				? `${filteredVariationCandidates.length} variation rows`
				: `${filteredSpirits.length} spirits`}
		</span>
	{/snippet}

	<FilterBar
		bind:searchValue={filteredData.searchQuery}
		searchPlaceholder="Search spirits"
		filters={[
			{
				key: 'origin',
				label: 'Origin',
				options: origins.map((o) => ({ label: o.name, value: o.id })),
				value: originFilter
			},
			{
				key: 'class',
				label: 'Class',
				options: classes.map((c) => ({ label: c.name, value: c.id })),
				value: classFilter
			}
		]}
		onfilterchange={(key, value) => {
			if (key === 'origin') originFilter = value?.toString() ?? 'all';
			if (key === 'class') classFilter = value?.toString() ?? 'all';
		}}
	/>

	{#if loading}
		<div class="loading-state">Loading hex spirits...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'data' && assetViewMode === 'primary'}
		<HexSpiritsCombinedView
			spirits={filteredSpirits}
			{originLookup}
			{classLookup}
			{runes}
			onEdit={(spirit) => openSpiritForm(spirit)}
			onDelete={(spirit) => deleteSpirit(spirit)}
		/>
	{:else if activeTab === 'data' && assetViewMode === 'variation'}
		<div class="variation-table">
			{#if filteredVariationCandidates.length === 0}
				<div class="empty-state">No variation rows to display.</div>
			{:else}
				<table class="variation-data-table">
					<thead>
						<tr>
							<th>Raw</th>
							<th>Spirit</th>
							<th>Variation</th>
							<th>Origins</th>
							<th>Classes</th>
							<th>Outputs</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each filteredVariationCandidates as candidate (candidate.variant.id)}
							<tr class:selected={candidate.selectedForVariation}>
								<td>
									{#if candidate.rawArtUrl}
										<img class="thumb" src={candidate.rawArtUrl} alt="" loading="lazy" />
									{:else}
										<div class="thumb thumb--empty"></div>
									{/if}
								</td>
								<td>
									<strong>{candidate.spirit.name}</strong>
									<div class="muted">Cost {candidate.spirit.cost}</div>
								</td>
								<td>
									{candidate.variant.label}
									{#if candidate.selectedForVariation}
										<span class="selected-pill">TTS Variation</span>
									{/if}
									{#if candidate.variant.pipeline_error}
										<div class="name-error">{candidate.variant.pipeline_error}</div>
									{/if}
								</td>
								<td>{originName(primaryOriginId(candidate.spirit))}</td>
								<td>{className(primaryClassId(candidate.spirit))}</td>
								<td>
									<div class="output-pills">
										<span class:ready={Boolean(candidate.frontNoIconsUrl)}>Base Front</span>
										<span class:ready={Boolean(candidate.frontUrl)}>Final Front</span>
										<span class:ready={Boolean(candidate.backBaseUrl)}>Base Back</span>
										<span class:ready={Boolean(candidate.backUrl)}>Final Back</span>
										<span class:ready={Boolean(candidate.ttsCombinedUrl)}>TTS</span>
									</div>
								</td>
								<td>
									<Button
										variant={candidate.selectedForVariation ? 'secondary' : 'primary'}
										onclick={() => selectVariationCandidate(candidate)}
									>
										{candidate.selectedForVariation ? 'Selected' : 'Use for TTS'}
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{:else if activeTab === 'gallery'}
			<!-- Spirit Gallery Tab Content -->
		<div class="gallery-content">
			<div class="gallery-header">
				<div class="gallery-actions">
					{#if assetViewMode === 'variation'}
						<Button
							variant="secondary"
							onclick={() => exportArtRawPack(false, filteredVariationCandidates)}
							disabled={exportingVariationArtPack || loading}
						>
							{exportingVariationArtPack ? 'Preparing Export...' : 'Export Variation Art Raw Pack'}
						</Button>
						<Button
							variant="secondary"
							onclick={() => variationBatchUploadInput?.click()}
							disabled={variationBatchUploadInProgress}
						>
							{variationBatchUploadInProgress
								? `Uploading... (${variationBatchUploadProgress.processed}/${variationBatchUploadProgress.total})`
								: 'Batch Upload Variation Prints'}
						</Button>
						<Button
							variant="primary"
							onclick={generateVariationHexSpiritPipeline}
							disabled={pipelineInProgress || variationPipelineEligibleCount === 0}
						>
							{pipelineInProgress
								? `Generating... (${pipelineProgress.processed}/${pipelineProgress.total})`
								: `Run Variation Pipeline (${variationPipelineEligibleCount})`}
						</Button>
						<input
							type="file"
							accept="image/png,image/webp,image/jpeg"
							multiple
							webkitdirectory
							class="sr-only"
							bind:this={variationBatchUploadInput}
							onchange={handleVariationBatchUploadInput}
						/>
					{:else}
					<div class="image-side-toggle">
						<button
							type="button"
							class={`image-side-toggle__btn ${galleryImageSide === 'front' ? 'is-active' : ''}`}
							onclick={() => (galleryImageSide = 'front')}
						>
							Front
						</button>
						<button
							type="button"
							class={`image-side-toggle__btn ${galleryImageSide === 'back' ? 'is-active' : ''}`}
							onclick={() => (galleryImageSide = 'back')}
						>
							Back
						</button>
						<button
							type="button"
							class={`image-side-toggle__btn ${galleryImageSide === 'data' ? 'is-active' : ''}`}
							onclick={() => (galleryImageSide = 'data')}
						>
							Data
						</button>
					</div>
					<Button
						variant="secondary"
						onclick={exportGridAsPng}
						disabled={exportingGridImage}
					>
						{exportingGridImage ? 'Exporting…' : 'Export Grid as PNG'}
					</Button>
					<Button
						variant="secondary"
						onclick={() => exportArtRawPack(false)}
						disabled={exportingArtPack || loading}
					>
						{exportingArtPack ? 'Preparing Export…' : 'Export Art Raw Pack'}
					</Button>
					<Button
						variant="secondary"
						onclick={() => exportArtRawPack(true)}
						disabled={exportingMissingPrintsPack || loading}
					>
						{exportingMissingPrintsPack
							? 'Exporting Missing Game Prints…'
							: 'Export Missing Game Prints Pack'}
					</Button>
					<Button
						variant="secondary"
						onclick={() => batchUploadInput?.click()}
						disabled={batchUploadInProgress}
					>
						{batchUploadInProgress
							? `Uploading... (${batchUploadProgress.processed}/${batchUploadProgress.total})`
							: 'Batch Upload Game Prints'}
					</Button>
					<Button
						variant="primary"
						onclick={() => (pipelineModalOpen = true)}
						disabled={pipelineInProgress || loading}
					>
						{pipelineInProgress
							? `Generating Pipeline... (${pipelineProgress.processed}/${pipelineProgress.total})`
							: 'HexSpirit Pipeline'}
					</Button>
					<Button
						variant="secondary"
						onclick={exportTTSMemberImportPack}
						disabled={exportingTTSMemberPack || loading}
					>
						{exportingTTSMemberPack
							? `Exporting Member Images... (${ttsMemberPackProgress.processed}/${ttsMemberPackProgress.total})`
							: 'Export Member Images 825x750'}
					</Button>
					<input
						type="file"
						accept="image/png,image/webp,image/jpeg"
						multiple
						webkitdirectory
						class="sr-only"
						bind:this={batchUploadInput}
						onchange={handleBatchUploadInput}
					/>
					{/if}
				</div>
			</div>

			<p class="export-hint">
				{#if assetViewMode === 'variation'}
					Tip: variation filenames include <code>SpiritID__variant__VariantID</code>. Use the Photoshop script's
					<code>game_prints</code> folder directly with Batch Upload Variation Prints.
				{:else}
					Tip: Use the Photoshop script's <code>game_prints</code> folder directly. Filenames should keep the spirit ID
					and side marker, e.g. <code>123e4567-e89b-12d3-a456-426614174000_front_game_print.png</code> and
					<code>123e4567-e89b-12d3-a456-426614174000_back_game_print.png</code>.
				{/if}
			</p>

				{#if assetViewMode === 'variation'}
					<section class="variation-gallery-grid">
						{#if filteredVariationCandidates.length === 0}
							<div class="empty-state">No variation rows to display.</div>
						{:else}
							{#each filteredVariationCandidates as candidate (candidate.variant.id)}
								<article class="variation-card" class:selected={candidate.selectedForVariation}>
									<div class="variation-card__images">
										<div>
											<span>Raw</span>
											{#if candidate.rawArtUrl}
												<img src={candidate.rawArtUrl} alt="" loading="lazy" />
											{:else}
												<div class="variation-card__placeholder">Missing</div>
											{/if}
										</div>
										<div>
											<span>Front</span>
											{#if candidate.frontUrl || candidate.frontNoIconsUrl}
												<img src={candidate.frontUrl || candidate.frontNoIconsUrl || ''} alt="" loading="lazy" />
											{:else}
												<div class="variation-card__placeholder">Missing</div>
											{/if}
										</div>
										<div>
											<span>Back</span>
											{#if candidate.backUrl || candidate.backBaseUrl}
												<img src={candidate.backUrl || candidate.backBaseUrl || ''} alt="" loading="lazy" />
											{:else}
												<div class="variation-card__placeholder">Missing</div>
											{/if}
										</div>
									</div>
									<div class="variation-card__body">
										<div>
											<h3>{candidate.spirit.name}</h3>
											<p>{candidate.variant.label}</p>
										</div>
										<div class="output-pills">
											<span class:ready={Boolean(candidate.frontNoIconsUrl)}>Base Front</span>
											<span class:ready={Boolean(candidate.frontUrl)}>Final Front</span>
											<span class:ready={Boolean(candidate.backBaseUrl)}>Base Back</span>
											<span class:ready={Boolean(candidate.backUrl)}>Final Back</span>
											<span class:ready={Boolean(candidate.ttsCombinedUrl)}>TTS</span>
										</div>
										<Button
											variant={candidate.selectedForVariation ? 'secondary' : 'primary'}
											onclick={() => selectVariationCandidate(candidate)}
										>
											{candidate.selectedForVariation ? 'Selected for TTS' : 'Use for TTS Variation'}
										</Button>
									</div>
								</article>
							{/each}
						{/if}
					</section>
				{:else}
				<div class="grid-origin-selector">
				<h3>Select Origins to Display</h3>
				<div class="origin-checkboxes">
					<label class="origin-checkbox">
						<input
							type="checkbox"
							checked={selectedOriginsForGrid.has(null)}
							onchange={() => toggleOriginForGrid(null)}
						/>
						<span>Unassigned</span>
					</label>
					{#each origins as origin}
						<label class="origin-checkbox">
							<input
								type="checkbox"
								checked={selectedOriginsForGrid.has(origin.id)}
								onchange={() => toggleOriginForGrid(origin.id)}
							/>
							<span>{origin.name}</span>
						</label>
					{/each}
				</div>
			</div>

			<section class="class-origin-table">
				<table class="spirit-matrix">
					<thead>
						<tr>
							<th class="row-header">Class / Origin</th>
							{#each gridViewData.originList as origin (origin.originId ?? 'none')}
								<th class="column-header">
									{origin.originName} ({origin.count}, {origin.combatPower} power, {origin.powerRatio})
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each gridViewData.classList as classItem (classItem.classId ?? 'none')}
							<tr>
								<td class="row-header">
									{classItem.className} ({classItem.count}, {classItem.combatPower} power, {classItem.powerRatio})
								</td>
								{#each gridViewData.originList as origin (origin.originId ?? 'none')}
									{@const cellSpirits = gridViewData.grid.get(classItem.classId)?.get(origin.originId) ?? []}
									<td class="cell">
										{#if cellSpirits.length > 0}
											<div class="cell-prints">
												{#each cellSpirits as spirit (spirit.id)}
													{#if galleryImageSide === 'data'}
														<div
															class="cell-data-card cell-print--clickable"
															role="button"
															tabindex="0"
															onclick={() => openSpiritForm(spirit)}
															onkeydown={(e) => e.key === 'Enter' && openSpiritForm(spirit)}
														>
															<div class="data-card__name">{spirit.name}</div>
															<div class="data-card__cost">Cost: {spirit.cost}</div>
															{#if spirit.traits?.class_ids?.length}
																<div class="data-card__classes">
																	{#each Object.entries(spirit.traits.class_ids.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {} as Record<string, number>)) as [classId, count]}
																		{@const cls = classLookup.get(classId)}
																		{#if cls}
																			<span class="data-card__class-chip">
																				{#if cls.icon_emoji}{cls.icon_emoji}{/if}
																				{count > 1 ? `${count}× ` : ''}{cls.name}
																			</span>
																		{/if}
																	{/each}
																</div>
															{/if}
															{#if spirit.awaken_condition?.type === 'rune_cost'}
																<div class="data-card__runes">
																	{#each spirit.awaken_condition.rune_ids as token}
																		{#if typeof token === 'string'}
																			{@const rune = runes.find((r) => r.id === token)}
																			{#if rune}<span class="data-card__rune-chip">{rune.name}</span>{/if}
																		{:else if token.kind === 'or'}
																			<span class="data-card__rune-chip">
																				{token.rune_ids.map((id) => runes.find((r) => r.id === id)?.name ?? '?').join(' / ')}
																			</span>
																		{/if}
																	{/each}
																</div>
															{:else if spirit.awaken_condition?.type === 'text'}
																<div class="data-card__runes">
																	<span class="data-card__rune-chip">{spirit.awaken_condition.text}</span>
																</div>
															{/if}
														</div>
													{:else}
														{@const cardImageUrl = getGalleryImageUrl(spirit)}
														<div
															class="cell-print cell-print--clickable"
															role="button"
															tabindex="0"
															onclick={() => openSpiritForm(spirit)}
															onkeydown={(e) => e.key === 'Enter' && openSpiritForm(spirit)}
														>
															{#if cardImageUrl}
																<img
																	src={cardImageUrl}
																	alt={
																		galleryImageSide === 'front'
																			? `Front print for ${spirit.name}`
																			: `Back print for ${spirit.name}`
																	}
																	loading="lazy"
																/>
															{:else}
																<div class="cell-print__placeholder">
																	{galleryImageSide === 'front' ? 'No Front Print' : 'No Back Print'}
																</div>
															{/if}
														</div>
													{/if}
												{/each}
											</div>
										{:else}
											<div class="cell-empty">—</div>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
				</section>
				{/if}
			</div>

		<Modal bind:open={pipelineModalOpen} title="HexSpirit Generation Pipeline" size="lg" closeOnBackdrop={!pipelineInProgress} closeOnEscape={!pipelineInProgress}>
			<div class="pipeline-modal">
				<div class="pipeline-config-grid">
					<section class="pipeline-config-card">
						<div>
							<h3>Front Placement</h3>
							<p>Origin and class slots use <code>front_icon_placement_config</code>.</p>
						</div>
						<Button variant="secondary" onclick={() => (iconPlacerOpen = true)} disabled={pipelineInProgress}>
							Edit Front
						</Button>
					</section>
					<section class="pipeline-config-card">
						<div>
							<h3>Back Placement</h3>
							<p>Rune, text, and special class slots use <code>back_icon_placement_config</code>.</p>
						</div>
						<Button variant="secondary" onclick={() => (backIconPlacerOpen = true)} disabled={pipelineInProgress}>
							Edit Back
						</Button>
					</section>
				</div>

				<div class="pipeline-options">
					<label>
						<span>Concurrency</span>
						<input
							type="number"
							min="1"
							max="8"
							value={pipelineConcurrency}
							disabled={pipelineInProgress}
							onchange={(e) => (pipelineConcurrency = Math.max(1, Math.min(8, Math.floor(Number(e.currentTarget.value) || 1))))}
						/>
					</label>
					<div class="pipeline-eligibility">
						{pipelineEligibleCount} of {spirits.length} spirits have a front source and back base image.
					</div>
				</div>

				{#if pipelineInProgress || pipelineSummary}
					<div class="pipeline-progress">
						<div class="pipeline-progress__bar">
							<div
								class="pipeline-progress__fill"
								style={`width: ${pipelineProgress.total ? Math.round((pipelineProgress.processed / pipelineProgress.total) * 100) : 0}%`}
							></div>
						</div>
						<div class="pipeline-progress__meta">
							<span>{pipelineProgress.processed}/{pipelineProgress.total} processed</span>
							<span>{pipelineProgress.failed} failed</span>
							{#if pipelineProgress.current}
								<span>{pipelineProgress.current}: {pipelineStatusLabel(pipelineProgress.status)}</span>
							{/if}
						</div>
					</div>
				{/if}

				{#if pipelineSummary}
					<div class="pipeline-summary">
						<strong>Last run:</strong>
						{pipelineSummary.completed} complete, {pipelineSummary.failed} failed.
						{#if pipelineSummary.failed > 0}
							<ul>
								{#each pipelineSummary.results.filter((result) => !result.success).slice(0, 8) as result (result.spiritId)}
									<li>{result.spiritName}: {result.error}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>

			{#snippet footer()}
				<Button variant="primary" onclick={generateHexSpiritPipeline} disabled={pipelineInProgress || pipelineEligibleCount === 0}>
					{pipelineInProgress ? 'Generating...' : 'Generate Full Pipeline'}
				</Button>
				<Button onclick={() => (pipelineModalOpen = false)} disabled={pipelineInProgress}>
					Close
				</Button>
			{/snippet}
		</Modal>

		<IconPlacementConfigurator
			isOpen={iconPlacerOpen}
			sampleImageUrls={getSampleImageUrls()}
			sampleImageUrlOptions={getSampleImageUrlOptions()}
			onClose={() => (iconPlacerOpen = false)}
			onSave={() => {
				alert('Configuration saved!');
			}}
			onGenerateAll={generateAllWithIcons}
			onGenerateTier={generateTierWithIcons}
			showGenerateActions={false}
		/>

		<BackIconPlacementConfigurator
			isOpen={backIconPlacerOpen}
			sampleImageUrl={getBackSampleImageUrl()}
			sampleImageUrls={getBackSampleImageUrls()}
			onClose={() => (backIconPlacerOpen = false)}
			onSave={() => {
				alert('Configuration saved!');
			}}
			onGenerateAll={generateBackWithIconsPipeline}
			showGenerateActions={false}
		/>

		{:else if activeTab === 'tts'}
			<HexSpiritsTTSView
				spirits={filteredSpirits}
				{origins}
				{classes}
				{runes}
				variationBySpiritId={selectedVariationBySpiritId}
				bind:source={ttsExportSource}
			/>
		{/if}
	</PageLayout>

<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Hex Spirit' : 'Create Hex Spirit'} size="md">
	<form id="hex-spirit-editor-form" class="spirit-form" onsubmit={(e) => { e.preventDefault(); void saveSpirit(); }}>
		<label>
			Name
			<input type="text" bind:value={modal.formData.name} required />
		</label>
		<label class="span-full">
			Description
			<textarea
				bind:value={modal.formData.description}
				rows="3"
				placeholder="Personality, pose notes, lore, or art direction for this spirit"
			></textarea>
		</label>
		<div class="span-full translations-editor">
			<div class="translations-editor__header">
				<div class="translations-editor__title">Alternate Names (Languages)</div>
				<button type="button" class="translations-editor__add" onclick={addNameTranslationRow}>+ Add</button>
			</div>
			{#if (modal.formData.name_translations ?? []).length === 0}
				<div class="translations-editor__empty">No alternate names.</div>
			{:else}
				<div class="translations-editor__rows">
					{#each modal.formData.name_translations ?? [] as row, idx (idx)}
						<div class="translations-row">
							<input
								class="translations-row__lang"
								type="text"
								placeholder="lang (e.g. es, fr-CA)"
								value={row.lang}
								oninput={(e) => updateNameTranslationRow(idx, { lang: (e.currentTarget as HTMLInputElement).value })}
							/>
							<input
								class="translations-row__name"
								type="text"
								placeholder="translated name"
								value={row.name}
								oninput={(e) => updateNameTranslationRow(idx, { name: (e.currentTarget as HTMLInputElement).value })}
							/>
							<button
								type="button"
								class="translations-row__remove"
								onclick={() => removeNameTranslationRow(idx)}
								aria-label="Remove alternate name"
							>
								Remove
							</button>
						</div>
					{/each}
				</div>
			{/if}
			<small class="translations-editor__hint">Primary name stays in “Name” above; these are optional.</small>
		</div>
		<label>
			Cost
			<input type="number" min="0" bind:value={modal.formData.cost} />
		</label>
		<div class="trait-picker">
			<div class="trait-picker__header">Origins (multi)</div>
			<div class="trait-grid">
				{#each origins as origin}
					<div class="trait-card">
						<div class="trait-card__name">{origin.name}</div>
						<input
							type="number"
							min="0"
							value={countOccurrences(modal.formData.traits.origin_ids, origin.id)}
							oninput={(e) =>
								updateOriginQuantity(origin.id, Number((e.currentTarget as HTMLInputElement).value))}
						/>
					</div>
				{/each}
			</div>
		</div>
		<div class="trait-picker">
			<div class="trait-picker__header">Classes (multi)</div>
			<div class="trait-grid">
				{#each classes as cls}
					<div class="trait-card">
						<div class="trait-card__name">{cls.name}</div>
						<input
							type="number"
							min="0"
							value={countOccurrences(modal.formData.traits.class_ids, cls.id)}
							oninput={(e) =>
								updateClassQuantity(cls.id, Number((e.currentTarget as HTMLInputElement).value))}
						/>
					</div>
				{/each}
			</div>
		</div>
		<div class="trait-picker trait-picker--runes">
			<div class="trait-picker__header">Awaken Condition</div>
			<div class="awaken-type-selector">
				<select
					value={getAwakenConditionType()}
					onchange={(e) => setAwakenConditionType((e.currentTarget as HTMLSelectElement).value as 'none' | 'rune_cost' | 'text')}
				>
					<option value="none">None</option>
					<option value="rune_cost">Rune Cost</option>
					<option value="text">Text</option>
				</select>
			</div>

			{#if modal.formData.awaken_condition?.type === 'rune_cost'}
				{@const tokens = getAwakenRuneTokens()}
				{@const slotsUsed = awakenRuneTokensSlotsUsed(tokens)}
				<div class="awaken-slots-indicator">Slots: {slotsUsed} / 5</div>
				<div class="trait-grid">
					{#each runes as rune}
						<div class="trait-card trait-card--rune">
							<div class="trait-card__name">{rune.name}</div>
							<input
								type="number"
								min="0"
								value={countRuneOccurrences(rune.id)}
								oninput={(e) =>
									updateRuneCostQuantity(rune.id, Number((e.currentTarget as HTMLInputElement).value))}
							/>
						</div>
					{/each}
				</div>
				<div class="or-slots-section">
					<div class="or-slots-header">
						<span>OR Slots</span>
						<button
							class="btn btn--sm btn--outline"
							disabled={slotsUsed >= 5}
							onclick={() => addAwakenOrSlot()}
						>+ OR Slot</button>
					</div>
					{#each tokens as token, tokenIndex}
						{#if isAwakenOrRuneToken(token)}
							<div class="or-slot-card">
								<div class="or-slot-card__header">
									<span>OR Slot #{tokenIndex + 1}</span>
									<button
										class="btn btn--sm btn--danger"
										onclick={() => removeAwakenToken(tokenIndex)}
									>&times;</button>
								</div>
								<div class="or-slot-card__runes">
									{#each runes as rune}
										<label class="or-slot-rune-checkbox">
											<input
												type="checkbox"
												checked={token.rune_ids?.includes(rune.id) ?? false}
												onchange={(e) => updateOrSlotRune(tokenIndex, rune.id, (e.currentTarget as HTMLInputElement).checked)}
											/>
											{rune.name}
										</label>
									{/each}
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{:else if modal.formData.awaken_condition?.type === 'text'}
				<textarea
					class="awaken-text-input"
					value={modal.formData.awaken_condition.text}
					oninput={(e) => updateAwakenText((e.currentTarget as HTMLTextAreaElement).value)}
					placeholder="Enter awaken condition text..."
					rows="3"
				></textarea>
			{/if}
		</div>
		<label class="span-full">
			PSD folder override (optional)
			<input
				type="text"
				bind:value={modal.formData.psd_folder_override}
				placeholder="e.g. Prismatic_black, Prismatic_saturated"
			/>
			<small>
				Override the Photoshop folder used for export. If blank, defaults to rarity
				(Common/Rare/Epic/Legendary/Prismatic).
			</small>
		</label>

		{#if modal.isEditing}
			{@const editingSpirit = spirits.find(s => s.id === modal.editingId)}
			<div class="image-uploads">
				<div class="image-upload-section">
					<div class="upload-label">Art Raw</div>
					<ImageUploader
						bind:value={modal.formData.art_raw_image_path}
						folder={`hex_spirits/${modal.editingId}/art_raw`}
						maxSizeMB={50}
						aspectRatio="1 / 1"
						deletePreviousOnReplace={false}
						onupload={(path) => {
							modal.formData.art_raw_image_path = path;
						}}
						onerror={(err) => alert(`Upload failed: ${err}`)}
					/>
					<div class="art-raw-variations">
						<div class="art-raw-variations__header">
							<span>Variations</span>
							<button
								type="button"
								class="btn btn--sm btn--outline"
								disabled={!editingSpirit || artRawVariationUploading}
								onclick={() => editingSpirit && requestArtRawVariationUpload(editingSpirit)}
							>
								{artRawVariationUploading ? 'Uploading...' : '+ Upload Variation'}
							</button>
						</div>
						{#if editingSpirit && getArtRawVariants(editingSpirit.id).length > 0}
							<div class="art-raw-variations__grid">
								{#each getArtRawVariants(editingSpirit.id) as variant (variant.id)}
									{@const variantUrl = getArtRawVariantUrl(variant)}
									{@const isCurrent = isArtRawVariantCurrent(variant, modal.formData.art_raw_image_path)}
									<div class="art-raw-variant" class:is-current={isCurrent}>
										<div class="art-raw-variant__preview">
											{#if variantUrl}
												<img src={variantUrl} alt={`${variant.label} preview`} loading="lazy" />
											{:else}
												<span>No preview</span>
											{/if}
										</div>
										<div class="art-raw-variant__meta">
											<strong>{variant.label}</strong>
											<span>{variant.source}</span>
										</div>
										<div class="art-raw-variant__actions">
											<button
												type="button"
												class="btn btn--sm"
												disabled={isCurrent}
												onclick={() => useArtRawVariant(variant)}
											>
												{isCurrent ? 'Current' : 'Use'}
											</button>
											<button
												type="button"
												class="btn btn--sm btn--danger"
												disabled={isCurrent}
												onclick={() => removeArtRawVariant(variant)}
											>
												Remove
											</button>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<p class="image-note">No art raw variations yet.</p>
						{/if}
					</div>
				</div>
				<div class="image-upload-section">
					<div class="upload-label">Game Print (Base - No Icons)</div>
					<ImageUploader
						bind:value={modal.formData.game_print_no_icons_path}
						folder={`hex_spirits/${modal.editingId}/game_print`}
						maxSizeMB={50}
						aspectRatio="1 / 1"
						onupload={(path) => {
							modal.formData.game_print_no_icons_path = path;
						}}
						onerror={(err) => alert(`Upload failed: ${err}`)}
					/>
				</div>
				<div class="image-upload-section">
					<div class="upload-label">Game Print (Final - With Icons)</div>
					{#if modal.formData.manual_game_print}
						<ImageUploader
							bind:value={modal.formData.game_print_image_path}
							folder={`hex_spirits/${modal.editingId}/game_print`}
							maxSizeMB={50}
							aspectRatio="1 / 1"
							onupload={(path) => {
								modal.formData.game_print_image_path = path;
							}}
							onerror={(err) => alert(`Upload failed: ${err}`)}
						/>
						<p class="image-note">Manual upload (Front Icon Placer will skip)</p>
					{:else if editingSpirit?.game_print_image_url}
						<div class="image-preview">
							<img src={editingSpirit.game_print_image_url} alt="Game print with icons" />
						</div>
						<p class="image-note">Generated by Front Icon Placer</p>
					{:else}
						<div class="image-placeholder">
							<span>Not yet generated</span>
							<p class="image-note">Use Front Icon Placer to generate</p>
						</div>
					{/if}
					<label class="manual-toggle">
						<input type="checkbox" bind:checked={modal.formData.manual_game_print} />
						<span>Manual (skip Front Icon Placer)</span>
					</label>
				</div>
				<div class="image-upload-section">
					<div class="upload-label">Back Side (Base)</div>
					<ImageUploader
						bind:value={modal.formData.back_side_base}
						folder={`hex_spirits/${modal.editingId}/back_side`}
						maxSizeMB={50}
						aspectRatio="1 / 1"
						onupload={(path) => {
							modal.formData.back_side_base = path;
						}}
						onerror={(err) => alert(`Upload failed: ${err}`)}
					/>
				</div>
				<div class="image-upload-section">
					<div class="upload-label">Back Side (Exported)</div>
					<ImageUploader
						bind:value={modal.formData.back_side_export}
						folder={`hex_spirits/${modal.editingId}/back_side`}
						maxSizeMB={50}
						aspectRatio="1 / 1"
						onupload={(path) => {
							modal.formData.back_side_export = path;
						}}
						onerror={(err) => alert(`Upload failed: ${err}`)}
					/>
				</div>
			</div>
		{:else}
			<p class="upload-note">Save the spirit first to enable image uploads.</p>
		{/if}
	</form>
	<input
		type="file"
		accept="image/png,image/webp,image/jpeg"
		class="sr-only"
		bind:this={artRawVariationInput}
		onchange={handleArtRawVariationInput}
	/>

	{#snippet footer()}
		<div class="modal-footer-actions">
			<Button variant="primary" type="submit" onclick={() => void saveSpirit()}>Save</Button>
			<Button onclick={() => modal.close()}>Cancel</Button>
		</div>
	{/snippet}
</Modal>

<style>
	.spirit-count {
		font-size: 0.7rem;
		color: #64748b;
	}

	.loading-state,
	.error-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.error-state {
		color: #f87171;
	}

	.spirit-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.4rem;
	}

	.spirit-form .span-full {
		grid-column: 1 / -1;
	}

	.spirit-form label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.spirit-form small {
		color: #64748b;
		font-size: 0.65rem;
	}

	.spirit-form textarea {
		padding: 0.45rem 0.5rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #e2e8f0;
		font: inherit;
		font-size: 0.8rem;
		resize: vertical;
	}

	.translations-editor {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(15, 23, 42, 0.25);
	}

	.translations-editor__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.translations-editor__title {
		font-size: 0.75rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.translations-editor__add {
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.35);
		color: #e2e8f0;
		padding: 0.25rem 0.45rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.7rem;
	}

	.translations-editor__add:hover {
		background: rgba(99, 102, 241, 0.28);
	}

	.translations-editor__empty {
		color: #64748b;
		font-size: 0.75rem;
		padding: 0.1rem 0;
	}

	.translations-editor__rows {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.translations-row {
		display: grid;
		grid-template-columns: 110px 1fr auto;
		gap: 0.35rem;
		align-items: center;
	}

	.translations-row input {
		padding: 0.35rem 0.45rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: inherit;
		font-size: 0.8rem;
	}

	.translations-row__remove {
		background: rgba(248, 113, 113, 0.12);
		border: 1px solid rgba(248, 113, 113, 0.3);
		color: #fecaca;
		padding: 0.3rem 0.45rem;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.7rem;
		white-space: nowrap;
	}

	.translations-row__remove:hover {
		background: rgba(248, 113, 113, 0.18);
	}

	.translations-editor__hint {
		color: #64748b;
		font-size: 0.65rem;
	}

	.trait-picker {
		grid-column: 1 / -1;
		background: rgba(15, 23, 42, 0.3);
		padding: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.trait-picker__header {
		font-weight: 500;
		color: #94a3b8;
		margin-bottom: 0.3rem;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.trait-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.25rem;
	}

	.trait-card {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		background: rgba(30, 41, 59, 0.4);
		padding: 0.25rem 0.35rem;
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.trait-card__name {
		font-size: 0.7rem;
		color: #cbd5e1;
		flex: 1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.trait-card input {
		width: 40px;
		padding: 0.15rem 0.25rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		color: inherit;
		font-size: 0.75rem;
		text-align: center;
	}

	.trait-picker--runes {
		background: rgba(168, 85, 247, 0.08);
		border-color: rgba(168, 85, 247, 0.2);
	}

	.trait-picker--runes .trait-picker__header {
		color: #d8b4fe;
	}

	.trait-card--rune {
		background: rgba(168, 85, 247, 0.15);
		border-color: rgba(168, 85, 247, 0.25);
	}

	.trait-card--rune .trait-card__name {
		color: #e9d5ff;
	}

	.awaken-type-selector {
		margin-bottom: 0.35rem;
	}

	.awaken-type-selector select {
		padding: 0.35rem 0.5rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #e2e8f0;
		font-size: 0.8rem;
		border-radius: 6px;
	}

	.awaken-text-input {
		width: 100%;
		padding: 0.45rem 0.5rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(168, 85, 247, 0.25);
		color: #e2e8f0;
		font-size: 0.8rem;
		border-radius: 6px;
		resize: vertical;
		font-family: inherit;
	}

	.awaken-slots-indicator {
		font-size: 0.75rem;
		color: #c4b5fd;
		margin-bottom: 0.35rem;
	}

	.or-slots-section {
		margin-top: 0.5rem;
	}

	.or-slots-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.35rem;
		font-size: 0.8rem;
		color: #d8b4fe;
	}

	.or-slot-card {
		background: rgba(168, 85, 247, 0.1);
		border: 1px solid rgba(168, 85, 247, 0.2);
		border-radius: 6px;
		padding: 0.4rem;
		margin-bottom: 0.35rem;
	}

	.or-slot-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		color: #c4b5fd;
	}

	.or-slot-card__runes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 0.5rem;
	}

	.or-slot-rune-checkbox {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: #e2e8f0;
		cursor: pointer;
	}

	.or-slot-rune-checkbox input[type="checkbox"] {
		accent-color: #a855f7;
	}

	.modal-footer-actions {
		display: flex;
		gap: 0.4rem;
		justify-content: flex-end;
	}

	/* Gallery Tab Styles */
	.gallery-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.gallery-header {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.gallery-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.pipeline-modal {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.pipeline-config-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.pipeline-config-card {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.85rem;
		background: rgba(15, 23, 42, 0.52);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 8px;
	}

	.pipeline-config-card h3 {
		margin: 0 0 0.25rem;
		font-size: 0.9rem;
		color: #e2e8f0;
	}

	.pipeline-config-card p {
		margin: 0;
		color: #94a3b8;
		font-size: 0.76rem;
		line-height: 1.35;
	}

	.pipeline-config-card code {
		font-size: 0.7rem;
		color: #bfdbfe;
	}

	.pipeline-options {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
	}

	.pipeline-options label {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		color: #cbd5e1;
		font-size: 0.78rem;
	}

	.pipeline-options input {
		width: 72px;
		padding: 0.4rem 0.5rem;
		background: rgba(15, 23, 42, 0.72);
		border: 1px solid rgba(148, 163, 184, 0.22);
		border-radius: 6px;
		color: #f8fafc;
	}

	.pipeline-eligibility {
		color: #94a3b8;
		font-size: 0.78rem;
	}

	.pipeline-progress {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.pipeline-progress__bar {
		height: 8px;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 999px;
		overflow: hidden;
	}

	.pipeline-progress__fill {
		height: 100%;
		background: linear-gradient(90deg, #38bdf8, #22c55e);
		transition: width 0.2s ease;
	}

	.pipeline-progress__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		color: #cbd5e1;
		font-size: 0.76rem;
	}

	.pipeline-summary {
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 8px;
		color: #cbd5e1;
		font-size: 0.78rem;
	}

	.pipeline-summary ul {
		margin: 0.45rem 0 0;
		padding-left: 1rem;
		color: #fecaca;
	}

	.image-side-toggle {
		display: inline-flex;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		overflow: hidden;
	}

	.image-side-toggle__btn {
		border: none;
		background: rgba(15, 23, 42, 0.6);
		color: #e2e8f0;
		padding: 0.45rem 0.8rem;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 600;
		transition: all 0.15s ease;
	}

	.image-side-toggle__btn:hover {
		background: rgba(15, 23, 42, 0.85);
	}

	.image-side-toggle__btn.is-active {
		background: rgba(99, 102, 241, 0.3);
		color: #f8fafc;
	}

	.export-hint {
		margin: 0;
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.export-hint code {
		background: rgba(15, 23, 42, 0.6);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}

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

	.grid-origin-selector {
		padding: 1rem;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.grid-origin-selector h3 {
		margin: 0 0 0.75rem 0;
		color: #f8fafc;
		font-size: 1rem;
		font-weight: 600;
	}

	.origin-checkboxes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.origin-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		user-select: none;
		color: #e2e8f0;
		font-size: 0.9rem;
		padding: 0.4rem 0.75rem;
		background: rgba(15, 23, 42, 0.6);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		transition: all 0.2s ease;
	}

	.origin-checkbox:hover {
		background: rgba(15, 23, 42, 0.8);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.origin-checkbox input[type='checkbox'] {
		cursor: pointer;
		width: 18px;
		height: 18px;
		accent-color: rgba(99, 102, 241, 0.8);
	}

	.origin-checkbox:has(input:checked) {
		background: rgba(99, 102, 241, 0.2);
		border-color: rgba(99, 102, 241, 0.5);
		color: #f8fafc;
	}

	.class-origin-table {
		overflow-x: auto;
		position: relative;
		width: 100%;
	}

	.spirit-matrix {
		width: 100%;
		border-collapse: collapse;
		background: rgba(15, 23, 42, 0.4);
		border-radius: 8px;
		overflow: hidden;
	}

	.spirit-matrix th,
	.spirit-matrix td {
		padding: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		vertical-align: top;
	}

	.row-header {
		background: rgba(30, 41, 59, 0.8);
		font-weight: 700;
		color: #f8fafc;
		text-align: left;
		position: sticky;
		left: 0;
		z-index: 10;
		min-width: 150px;
		max-width: 200px;
	}

	.column-header {
		background: rgba(30, 41, 59, 0.8);
		font-weight: 700;
		color: #f8fafc;
		text-align: center;
		position: sticky;
		top: 0;
		z-index: 10;
		min-width: 200px;
	}

	.spirit-matrix th.row-header {
		position: sticky;
		left: 0;
		top: 0;
		z-index: 20;
	}

	.cell {
		background: rgba(15, 23, 42, 0.65);
		min-width: 200px;
		min-height: 100px;
	}

	.cell-empty {
		color: #94a3b8;
		text-align: center;
		font-style: italic;
		padding: 1rem;
	}

	.cell-prints {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 0.5rem;
	}

	.cell-print {
		background: rgba(30, 41, 59, 0.6);
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		padding: 0.35rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.cell-print img,
	.cell-print__placeholder {
		width: 100%;
		aspect-ratio: 1.1 / 1;
		border-radius: 6px;
		object-fit: cover;
		background: rgba(15, 23, 42, 0.6);
	}

	.cell-print__placeholder {
		display: grid;
		place-items: center;
		color: #94a3b8;
		font-size: 0.7rem;
		text-transform: uppercase;
	}

	.cell-print--clickable {
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cell-print--clickable:hover {
		transform: scale(1.03);
		border-color: rgba(99, 102, 241, 0.5);
		box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
	}

	.cell-print--clickable:focus {
		outline: 2px solid rgba(99, 102, 241, 0.6);
		outline-offset: 2px;
	}

	.cell-data-card {
		background: rgba(30, 41, 59, 0.6);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		padding: 0.35rem 0.4rem;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.data-card__name {
		color: #f8fafc;
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.data-card__cost {
		color: #fbbf24;
		font-size: 0.6rem;
		font-weight: 600;
	}

	.data-card__classes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
	}

	.data-card__class-chip {
		font-size: 0.55rem;
		font-weight: 500;
		padding: 0.05rem 0.2rem;
		border-radius: 2px;
		background: rgba(59, 130, 246, 0.2);
		color: #93c5fd;
		border: 1px solid rgba(59, 130, 246, 0.3);
	}

	.data-card__runes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.15rem;
	}

	.data-card__rune-chip {
		font-size: 0.55rem;
		font-weight: 500;
		padding: 0.05rem 0.2rem;
		border-radius: 2px;
		background: rgba(168, 85, 247, 0.2);
		color: #d8b4fe;
		border: 1px solid rgba(168, 85, 247, 0.3);
	}

	/* Image upload styles */
	.image-uploads {
		grid-column: 1 / -1;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		margin-top: 0.5rem;
	}

	.image-upload-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.upload-label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.upload-note {
		grid-column: 1 / -1;
		font-size: 0.85rem;
		color: #94a3b8;
		font-style: italic;
		padding: 1rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		text-align: center;
		margin: 0.5rem 0 0;
	}

	.image-preview {
		border-radius: 6px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(15, 23, 42, 0.5);
	}

	.image-preview img {
		width: 100%;
		height: auto;
		display: block;
	}

	.image-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		color: #64748b;
		text-align: center;
		min-height: 120px;
	}

	.image-placeholder span {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.image-note {
		font-size: 0.75rem;
		color: #64748b;
		margin: 0.25rem 0 0;
		font-style: italic;
	}

	.art-raw-variations {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(15, 23, 42, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.14);
		border-radius: 6px;
	}

	.art-raw-variations__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		color: #cbd5e1;
		font-size: 0.78rem;
		font-weight: 600;
	}

	.art-raw-variations__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
		gap: 0.45rem;
	}

	.art-raw-variant {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.4rem;
		background: rgba(30, 41, 59, 0.48);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 6px;
	}

	.art-raw-variant.is-current {
		border-color: rgba(34, 197, 94, 0.75);
		box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.25);
	}

	.art-raw-variant__preview {
		display: grid;
		place-items: center;
		aspect-ratio: 1 / 1;
		overflow: hidden;
		background: rgba(15, 23, 42, 0.7);
		border-radius: 4px;
		color: #64748b;
		font-size: 0.7rem;
	}

	.art-raw-variant__preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.art-raw-variant__meta {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
	}

	.art-raw-variant__meta strong {
		color: #e2e8f0;
		font-size: 0.72rem;
		line-height: 1.2;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.art-raw-variant__meta span {
		color: #94a3b8;
		font-size: 0.62rem;
		text-transform: capitalize;
	}

	.art-raw-variant__actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.25rem;
	}

	.btn--sm {
		padding: 0.25rem 0.4rem;
		font-size: 0.68rem;
	}

	.btn--outline {
		background: transparent;
		border-color: rgba(148, 163, 184, 0.28);
	}

	.btn--danger {
		color: #fecaca;
		border-color: rgba(248, 113, 113, 0.35);
		background: rgba(248, 113, 113, 0.1);
	}

	.manual-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding: 0.5rem 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.manual-toggle:hover {
		background: rgba(30, 41, 59, 0.7);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.manual-toggle:has(input:checked) {
		background: rgba(251, 191, 36, 0.15);
		border-color: rgba(251, 191, 36, 0.4);
	}

	.manual-toggle input[type='checkbox'] {
		cursor: pointer;
		width: 16px;
		height: 16px;
		accent-color: #fbbf24;
	}

	.manual-toggle span {
		font-size: 0.8rem;
		color: #e2e8f0;
	}

	.asset-view-toggle {
		display: inline-flex;
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 6px;
		overflow: hidden;
	}

	.asset-view-toggle button {
		border: 0;
		background: rgba(15, 23, 42, 0.6);
		color: #cbd5e1;
		padding: 0.35rem 0.65rem;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.asset-view-toggle button.active {
		background: rgba(59, 130, 246, 0.32);
		color: #f8fafc;
	}

	.variation-table,
	.variation-data-table {
		width: 100%;
	}

	.variation-data-table {
		border-collapse: collapse;
		background: rgba(15, 23, 42, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 6px;
		overflow: hidden;
	}

	.variation-data-table th,
	.variation-data-table td {
		padding: 0.6rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.12);
		color: #cbd5e1;
		font-size: 0.78rem;
		vertical-align: middle;
	}

	.variation-data-table th {
		color: #94a3b8;
		text-align: left;
		font-weight: 600;
		background: rgba(15, 23, 42, 0.6);
	}

	.variation-data-table tr.selected {
		background: rgba(34, 197, 94, 0.08);
	}

	.selected-pill {
		display: inline-flex;
		margin-left: 0.4rem;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: rgba(34, 197, 94, 0.16);
		color: #86efac;
		font-size: 0.68rem;
	}

	.output-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.output-pills span {
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #64748b;
		font-size: 0.68rem;
	}

	.output-pills span.ready {
		color: #bfdbfe;
		border-color: rgba(59, 130, 246, 0.35);
		background: rgba(59, 130, 246, 0.12);
	}

	.variation-gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 0.75rem;
	}

	.variation-card {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.65rem;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 6px;
	}

	.variation-card.selected {
		border-color: rgba(34, 197, 94, 0.65);
		box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.18);
	}

	.variation-card__images {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.45rem;
	}

	.variation-card__images > div {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		color: #94a3b8;
		font-size: 0.68rem;
	}

	.variation-card__images img,
	.variation-card__placeholder {
		width: 100%;
		aspect-ratio: 1 / 1.15;
		object-fit: contain;
		border-radius: 4px;
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.14);
	}

	.variation-card__placeholder {
		display: grid;
		place-items: center;
		color: #64748b;
	}

	.variation-card__body {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.variation-card__body h3,
	.variation-card__body p {
		margin: 0;
	}

	.variation-card__body h3 {
		color: #f8fafc;
		font-size: 0.9rem;
	}

	.variation-card__body p {
		color: #94a3b8;
		font-size: 0.78rem;
	}

</style>
