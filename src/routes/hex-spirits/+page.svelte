<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import html2canvas from 'html2canvas';
	import JSZip from 'jszip';
	import type { ClassRow, HexSpiritRow, OriginRow, RuneRow } from '$lib/types/gameData';
	import {
		deleteHexSpiritRecord,
		emptyHexSpiritForm,
		fetchHexSpiritRecords,
		hexSpiritRowToForm,
		saveHexSpiritRecord,
		type HexSpiritFormData
	} from '$lib/features/hex-spirits/hexSpirits';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchClassRecords } from '$lib/features/classes/classes';
	import { useFormModal, useFilteredData, useLookup } from '$lib/composables';
	import { getErrorMessage } from '$lib/utils';
	import { Button } from '$lib/components/ui';
	import { FilterBar, NumberControl, ImageUploader } from '$lib/components/shared';
	import { Modal, PageLayout, type Tab } from '$lib/components/layout';
	import {
		HexSpiritsListView,
		HexSpiritsTableView,
		HexSpiritsGridView,
		HexSpiritsTTSView
	} from '$lib/components/hex-spirits';
	import { cropEmptySpace } from '$lib/utils/imageCrop';
	import { downloadImageAsBlob } from '$lib/utils/sinkinApi';
	import { processAndUploadImage } from '$lib/utils/storage';
	import IconPlacementConfigurator from '$lib/components/spirits/IconPlacementConfigurator.svelte';
	import {
		FOLDER_TYPES,
		type FolderType,
		type IconPlacementConfig,
		getFolderFromCost,
		loadIconPlacementConfig,
		generateSpiritWithIcons,
		type SpiritIconData,
		type RuneIconData
	} from '$lib/generators/spirits/spiritIconPlacer';

	import gamePrintScript from '../../../scripts/hex-spirit-game-print.jsx?raw';
	import templateUpdaterScript from '../../../scripts/update_photoshop_template_path.py?raw';

	type HexSpirit = HexSpiritRow & {
		game_print_image_url: string | null;
		game_print_no_icons_url: string | null;
		art_raw_image_url: string | null;
	};

	type OriginOption = Pick<OriginRow, 'id' | 'name' | 'position' | 'icon_emoji' | 'icon_png'>;
	type ClassOption = Pick<ClassRow, 'id' | 'name' | 'position' | 'icon_emoji' | 'icon_png'>;

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
	let origins: OriginOption[] = $state([]);
	let classes: ClassOption[] = $state([]);
	let runes: RuneRow[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);

	// Tab state
	const tabs: Tab[] = [
		{ id: 'list', label: 'Data: List', icon: '📋' },
		{ id: 'table', label: 'Data: Table', icon: '📊' },
		{ id: 'grid', label: 'Game Print: Grid', icon: '🖼️' },
		{ id: 'gallery', label: 'Spirit Gallery', icon: '🎨' },
		{ id: 'tts', label: 'TTS JSON', icon: '🎮' }
	];
	let activeTab = $state('list');

	// Filter state
	let originFilter = $state('all');
	let classFilter = $state('all');

	// Gallery state
	let selectedOriginsForGrid: Set<string | null> = $state(new Set());
	let exportingArtPack = $state(false);
	let exportingMissingPrintsPack = $state(false);
	let batchUploadInProgress = $state(false);
	let batchUploadProgress = $state({ processed: 0, total: 0 });
	let exportingGridImage = $state(false);
	let batchUploadInput: HTMLInputElement | null = $state(null);
	let iconPlacerOpen = $state(false);
	let generatingWithIcons = $state(false);
	let generatingProgress = $state({ processed: 0, total: 0, current: '' });

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

	function getPublicImage(path: string | null, updatedAt?: string | null): string | null {
		if (!path) return null;
		const fullPath = path.startsWith('hex_spirits/') ? path : `hex_spirits/${path}`;
		const { data } = gameAssetsStorage.getPublicUrl(fullPath);
		if (!data?.publicUrl) return null;

		const cacheBuster = updatedAt ? new Date(updatedAt).getTime() : Date.now();
		const separator = data.publicUrl.includes('?') ? '&' : '?';
		return `${data.publicUrl}${separator}v=${cacheBuster}`;
	}

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
			classes = records.map(({ id, name, position, icon_emoji, icon_png }) => ({
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

	async function loadRunes() {
		try {
			const { data, error: fetchError } = await supabase
				.from('runes')
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
			const data = await fetchHexSpiritRecords();
			spirits = data.map((spirit) => ({
				...spirit,
				game_print_image_url: getPublicImage(spirit.game_print_image_path, spirit.updated_at),
				game_print_no_icons_url: getPublicImage(spirit.game_print_no_icons, spirit.updated_at),
				art_raw_image_url: getPublicImage(spirit.art_raw_image_path, spirit.updated_at)
			}));
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
				game_print_no_icons: modal.formData.game_print_no_icons ?? null,
				art_raw_image_path: modal.formData.art_raw_image_path ?? null
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

	function updateRuneCostQuantity(runeId: string, quantity: number) {
		const qty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
		const filtered = (modal.formData.rune_cost ?? []).filter((id) => id !== runeId);
		const expanded = filtered.concat(Array(qty).fill(runeId));
		modal.formData = {
			...modal.formData,
			rune_cost: expanded
		};
	}

	function countRuneOccurrences(runeId: string): number {
		return (modal.formData.rune_cost ?? []).filter((id) => id === runeId).length;
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	// Gallery helper functions
	type ImageVariant = 'game_print' | 'art_raw';

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

	function getSampleImageUrls(): Record<FolderType, string | null> {
		const samples: Record<FolderType, string | null> = {
			Human: null,
			Minor: null,
			Minor2: null,
			Greater: null,
			Exalted: null,
			Ancient: null
		};

		for (const spirit of spirits) {
			// Prefer game_print_no_icons_url for icon placer preview (shows base image without icons)
			const sampleUrl = spirit.game_print_no_icons_url || spirit.game_print_image_url;
			if (!sampleUrl) continue;
			const folder = getFolderFromCost(spirit.cost);
			if (folder && !samples[folder]) {
				samples[folder] = sampleUrl;
			}
		}

		return samples;
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
			const existingPath =
				variant === 'game_print' ? spirit.game_print_no_icons : spirit.art_raw_image_path;
			if (existingPath) {
				await gameAssetsStorage.remove([normalizeHexSpiritPath(existingPath)]);
			}

			const sanitizedName = sanitizeFileName(spirit.name);
			const variantFolder = variant === 'game_print' ? 'game_print' : 'art_raw';
			const fileName = variant === 'game_print'
				? `hex_${sanitizedName}_game_print_no_icons`
				: `hex_${sanitizedName}_${variant}`;
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
				game_print_no_icons?: string | null;
				art_raw_image_path?: string | null;
				updated_at: string;
			} = {
				updated_at: new Date().toISOString()
			};
			if (variant === 'game_print') {
				updateData.game_print_no_icons = fullPath;
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
			alert('Failed to upload image. Please try again.');
		}
	}

	async function batchUploadGamePrints(files: File[]) {
		if (!files || files.length === 0) return;
		batchUploadInProgress = true;
		batchUploadProgress = { processed: 0, total: files.length };
		const errors: string[] = [];
		for (const file of files) {
			const match = file.name.match(
				/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
			);
			if (!match) {
				errors.push(`${file.name}: missing SpiritID prefix.`);
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
				await handleImageUpload(spirit, file, 'game_print', { reloadAfterUpload: false });
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				errors.push(`${file.name}: ${message}`);
			}
			batchUploadProgress.processed += 1;
		}
		await loadSpirits();
		batchUploadInProgress = false;
		if (errors.length > 0) {
			alert(`Uploaded with ${errors.length} issue(s).\n` + errors.slice(0, 5).join('\n'));
		} else {
			alert('Batch upload complete.');
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

	async function generateAllWithIcons() {
		// Filter to spirits that have a base image AND are not manually set
		const spiritsWithGamePrint = spirits.filter(
			(s) => (s.game_print_no_icons_url || s.game_print_image_url) && !s.manual_game_print
		);
		const skippedManual = spirits.filter((s) => s.manual_game_print).length;

		if (spiritsWithGamePrint.length === 0) {
			const msg = skippedManual > 0
				? `No spirits to generate. ${skippedManual} spirit(s) are marked as manual and were skipped.`
				: 'No spirits with game prints found.';
			alert(msg);
			return;
		}

		generatingWithIcons = true;
		generatingProgress = { processed: 0, total: spiritsWithGamePrint.length, current: '' };

		const config = loadIconPlacementConfig();
		const zip = new JSZip();
		const errors: string[] = [];

		for (const spirit of spiritsWithGamePrint) {
			generatingProgress.current = spirit.name;

			try {
				const folderType = getFolderFromCost(spirit.cost);

				// Skip spirits with unmatched costs
				if (folderType === null) {
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

				const runeSlots: RuneIconData[] = [];
				const runeCostIds = spirit.rune_cost ?? [];
				for (const runeId of runeCostIds) {
					const rune = runes.find((r) => r.id === runeId);
					if (rune?.icon_path) {
						const iconPath = rune.icon_path.startsWith('runes/')
							? rune.icon_path
							: `runes/${rune.icon_path}`;
						const { data: urlData } = gameAssetsStorage.getPublicUrl(iconPath);
						if (urlData?.publicUrl) {
							runeSlots.push({ iconUrl: urlData.publicUrl });
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
					runeSlots,
					config,
					folderType
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
			anchor.download = `game_prints_with_icons_${new Date().toISOString().slice(0, 10)}.zip`;
			anchor.click();
			URL.revokeObjectURL(url);

			if (errors.length > 0) {
				alert(
					`Generated ${spiritsWithGamePrint.length - errors.length} images with ${errors.length} error(s).` +
						(skippedManual > 0 ? ` (${skippedManual} manual spirits skipped)` : '') +
						'\n' + errors.slice(0, 5).join('\n')
				);
			} else {
				const skippedMsg = skippedManual > 0 ? ` (${skippedManual} manual spirits skipped)` : '';
				alert(`Successfully generated ${spiritsWithGamePrint.length} game prints with icons!${skippedMsg}`);
			}
		} catch (err) {
			console.error(err);
			alert('Failed to create ZIP file.');
		}

		generatingWithIcons = false;
		iconPlacerOpen = false;
	}

	async function exportArtRawPack(filterMissingGamePrints = false) {
		if (!spirits || spirits.length === 0) {
			alert('Load spirits before exporting.');
			return;
		}
		if (filterMissingGamePrints) {
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
					'Name',
					'Cost',
					'ClassName',
					'OriginName',
					'RarityFolder',
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
					'RuneCost_Files'
				]
			];
			let missingCount = 0;
			for (const spirit of spirits) {
				if (filterMissingGamePrints && spirit.game_print_image_path) {
					continue;
				}
				if (!spirit.art_raw_image_path) {
					missingCount += 1;
					continue;
				}
				const artUrl = getPublicImage(spirit.art_raw_image_path, spirit.updated_at);
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
				const artFileName = `${spirit.id}_${safeSlug}_art_raw.png`;
				const gamePrintFileName = `${spirit.id}_game_print.png`;
				artFolder.file(artFileName, buffer);
				const iconSlots = buildIconSlots(spirit);
				const flatIcons = flattenIconSlots(iconSlots, 4);

				const runeCostIds = spirit.rune_cost ?? [];
				const runeCostFiles = runeCostIds.map((runeId) => {
					const rune = runeMap.get(runeId);
					if (!rune) return '';
					const runeType = rune.origin_id ? 'origin' : 'class';
					const safeRuneName = sanitizeFileName(rune.name ?? 'unknown');
					return `${runeType}_${safeRuneName}.png`;
				});
				const runeCostColumns = [
					String(runeCostIds.length),
					runeCostIds.join('|'),
					runeCostFiles.join('|')
				];

				csvRows.push([
					spirit.id,
					spirit.name,
					String(spirit.cost),
					className(primaryClassId(spirit)),
					originName(primaryOriginId(spirit)),
					spirit.psd_folder_override ?? getRarityFromCost(spirit.cost),
					artFileName,
					gamePrintFileName,
					spirit.art_raw_image_path ?? '',
					spirit.game_print_image_path ?? '',
					...flatIcons,
					...runeCostColumns
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
				`Export generated ${new Date().toISOString()}\n\nContents:\n- art_raw/: every spirit art asset used to generate game prints.\n- origin_icons/ & class_icons/: the latest icon files auto-downloaded from Supabase.\n- runes/: all rune icon PNGs (origin-based and class-based runes).\n- hex_spirits_art_raw.csv: metadata consumed by the Photoshop script.\n- scripts/: automation helpers (Photoshop JSX + Python updater).\n\nCSV columns:\n- SpiritID: matches PNG filename prefix for batch uploads.\n- ArtRawFile: fed into Photoshop script.\n- GamePrintFile: filename you must keep when exporting finals.\n- ArtRawStoragePath / ExistingGamePrintPath: Supabase locations to help target missing renders.\n- Icon1..4 (Type/RefId/File): icon slots used for placeholder_icon layers in Photoshop.\n- RuneCost1/2 (RuneId/Quantity/File): rune requirements for the spirit. File references runes/ folder.\n\nIncluded scripts:\n- scripts/hex-spirit-game-print.jsx (already configured to read this export's CSV/art folders and the shared template).\n- scripts/update_photoshop_template_path.py (optional helper: run 'python scripts/update_photoshop_template_path.py --template /new/path/to/spirit_hex_grey.psd' if the template ever moves).\n\nWorkflow:\n1. Unzip this package anywhere. No manual path edits are required—the JSX script locates the CSV/art folders relative to itself.\n2. Open Photoshop → File → Scripts → Browse… and select scripts/hex-spirit-game-print.jsx. Choose the export folder when prompted (if Photoshop asks).\n3. The script renders all cards into /game_prints while preserving the SpiritID-prefixed filenames.\n4. Back in the Hex Spirits admin, use the Batch Upload Game Prints control to upload every generated PNG at once.\n\nTemplate expectations:\n- Root layer group named "Hex" exists and remains visible.\n- 'Hex/Art/IMAGE_PLACEHOLDER' is a smart object; the script swaps it with each art raw.\n- Rarity folders ('Common', 'Rare', 'Epic', 'Legendary', 'Prismatic') live under 'Hex/' and each contains an 'Info' group with 'Name', 'Cost', 'Role', 'Origin', etc.\n- Role variants ('Role', 'Role2', 'Role3') and origin variants ('Origin', 'Origin2') exist for Legendary/Prismatic cards.\n- All rarity folders are present even if hidden—the script toggles visibility per card.\n`
			);
			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `hex_spirits_art_pack_${new Date().toISOString().slice(0, 10)}.zip`;
			anchor.click();
			URL.revokeObjectURL(url);
			const message = missingCount
				? `Export complete. ${missingCount} spirits had no art raw and were skipped.`
				: 'Export complete!';
			alert(message);
		} catch (err) {
			console.error(err);
			alert('Failed to build export pack.');
		} finally {
			if (filterMissingGamePrints) {
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
		<span class="spirit-count">{filteredSpirits.length} spirits</span>
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
	{:else if activeTab === 'list'}
		<HexSpiritsListView
			spirits={filteredSpirits}
			{originLookup}
			{classLookup}
			{runes}
			onEdit={(spirit) => openSpiritForm(spirit)}
			onDelete={(spirit) => deleteSpirit(spirit)}
		/>
	{:else if activeTab === 'table'}
		<HexSpiritsTableView
			spirits={filteredSpirits}
			{originLookup}
			{classLookup}
			{runes}
			onEdit={(spirit) => openSpiritForm(spirit)}
		/>
	{:else if activeTab === 'grid'}
		<HexSpiritsGridView spirits={filteredSpirits} {originLookup} {classLookup} />
	{:else if activeTab === 'gallery'}
		<!-- Spirit Gallery Tab Content -->
		<div class="gallery-content">
			<div class="gallery-header">
				<div class="gallery-actions">
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
						onclick={() => (iconPlacerOpen = true)}
						disabled={generatingWithIcons || loading}
					>
						{generatingWithIcons
							? `Generating... (${generatingProgress.processed}/${generatingProgress.total})`
							: 'Icon Placer'}
					</Button>
					<input
						type="file"
						accept="image/png,image/webp,image/jpeg"
						multiple
						class="sr-only"
						bind:this={batchUploadInput}
						onchange={handleBatchUploadInput}
					/>
				</div>
			</div>

			<p class="export-hint">
				Tip: Keep the filenames generated by the export (they start with each spirit's ID, e.g.,
				<code>123e4567-e89b-12d3-a456-426614174000_game_print.png</code>) so batch upload can match
				records automatically.
			</p>

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
													<div
														class="cell-print cell-print--clickable"
														role="button"
														tabindex="0"
														onclick={() => openSpiritForm(spirit)}
														onkeydown={(e) => e.key === 'Enter' && openSpiritForm(spirit)}
													>
														{#if spirit.game_print_image_url}
															<img
																src={spirit.game_print_image_url}
																alt={`Game print for ${spirit.name}`}
																loading="lazy"
															/>
														{:else}
															<div class="cell-print__placeholder">No Game Print</div>
														{/if}
													</div>
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
		</div>

		<IconPlacementConfigurator
			isOpen={iconPlacerOpen}
			sampleImageUrls={getSampleImageUrls()}
			onClose={() => (iconPlacerOpen = false)}
			onSave={() => {
				alert('Configuration saved!');
			}}
			onGenerateAll={generateAllWithIcons}
		/>
	{:else if activeTab === 'tts'}
		<HexSpiritsTTSView spirits={filteredSpirits} {origins} {classes} {runes} />
	{/if}
</PageLayout>

<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Hex Spirit' : 'Create Hex Spirit'} size="md">
	<form id="hex-spirit-editor-form" class="spirit-form" onsubmit={(e) => { e.preventDefault(); void saveSpirit(); }}>
		<label>
			Name
			<input type="text" bind:value={modal.formData.name} required />
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
			<div class="trait-picker__header">Rune Cost (duplicates = multiple required)</div>
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
					<label class="upload-label">Art Raw</label>
					<ImageUploader
						bind:value={modal.formData.art_raw_image_path}
						folder={`hex_spirits/${modal.editingId}/art_raw`}
						maxSizeMB={50}
						aspectRatio="1 / 1"
						onupload={(path) => {
							modal.formData.art_raw_image_path = path;
						}}
						onerror={(err) => alert(`Upload failed: ${err}`)}
					/>
				</div>
				<div class="image-upload-section">
					<label class="upload-label">Game Print (Base - No Icons)</label>
					<ImageUploader
						bind:value={modal.formData.game_print_no_icons}
						folder={`hex_spirits/${modal.editingId}/game_print`}
						maxSizeMB={50}
						aspectRatio="1 / 1"
						onupload={(path) => {
							modal.formData.game_print_no_icons = path;
						}}
						onerror={(err) => alert(`Upload failed: ${err}`)}
					/>
				</div>
				<div class="image-upload-section">
					<label class="upload-label">Game Print (Final - With Icons)</label>
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
						<p class="image-note">Manual upload (Icon Placer will skip)</p>
					{:else if editingSpirit?.game_print_image_url}
						<div class="image-preview">
							<img src={editingSpirit.game_print_image_url} alt="Game print with icons" />
						</div>
						<p class="image-note">Generated by Icon Placer</p>
					{:else}
						<div class="image-placeholder">
							<span>Not yet generated</span>
							<p class="image-note">Use Icon Placer to generate</p>
						</div>
					{/if}
					<label class="manual-toggle">
						<input type="checkbox" bind:checked={modal.formData.manual_game_print} />
						<span>Manual (skip Icon Placer)</span>
					</label>
				</div>
			</div>
		{:else}
			<p class="upload-note">Save the spirit first to enable image uploads.</p>
		{/if}
	</form>

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
</style>
