<script lang="ts">
// @ts-nocheck
	import { onMount } from 'svelte';
	import html2canvas from 'html2canvas';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/api/supabaseClient';
	import JSZip from 'jszip';

function countOccurrences(arr: string[], id: string): number {
  return arr.reduce((sum, val) => (val === id ? sum + 1 : sum), 0);
}

function getTraitCounts(spirit: HexSpirit): { origins: number; classes: number } {
  const origins = spirit.traits?.origin_ids?.length ?? 0;
  const classes = spirit.traits?.class_ids?.length ?? 0;
  return { origins, classes };
}

function updateOriginQuantity(originId: string, quantity: number) {
  if (!formData) return;
  const qty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  const filtered = formData.traits.origin_ids.filter((id) => id !== originId);
  const expanded = filtered.concat(Array(qty).fill(originId));
  formData = {
    ...formData,
    traits: { ...formData.traits, origin_ids: expanded },
    origin_id: expanded[0] ?? null
  };
}

function updateClassQuantity(classId: string, quantity: number) {
  if (!formData) return;
  const qty = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  const filtered = formData.traits.class_ids.filter((id) => id !== classId);
  const expanded = filtered.concat(Array(qty).fill(classId));
  formData = {
    ...formData,
    traits: { ...formData.traits, class_ids: expanded },
    class_id: expanded[0] ?? null
  };
}

function addNameTranslationRow() {
  const current = formData.name_translations ?? [];
  formData = {
    ...formData,
    name_translations: [...current, { lang: '', name: '' }]
  };
}

function updateNameTranslationRow(index: number, patch: Partial<{ lang: string; name: string }>) {
  const current = formData.name_translations ?? [];
  if (index < 0 || index >= current.length) return;
  const next = current.map((row, idx) => (idx === index ? { ...row, ...patch } : row));
  formData = { ...formData, name_translations: next };
}

function removeNameTranslationRow(index: number) {
  const current = formData.name_translations ?? [];
  if (index < 0 || index >= current.length) return;
  const next = current.filter((_, idx) => idx !== index);
  formData = { ...formData, name_translations: next };
}

	import gamePrintScript from '../../../../scripts/hex-spirit-game-print.jsx?raw';
	import templateUpdaterScript from '../../../../scripts/update_photoshop_template_path.py?raw';
	import type { PageData } from './$types';
import type { ClassRow, HexSpiritRow, OriginRow, RuneRow } from '$lib/types/gameData';
	import { EditorModal } from '$lib';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import { ImageUploader } from '$lib/components/shared';
	import { cropEmptySpace } from '$lib/utils/imageCrop';
	import { processAndUploadImage } from '$lib/utils/storage';
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
	import { generateImages, downloadImageAsBlob, generateSpiritPrompt } from '$lib/utils/sinkinApi';
	import {
		generateReplicateImages,
		generateSpiritPromptForReplicate
	} from '$lib/utils/replicateApi';

const originIconFileMap = new Map<string, string>();
const classIconFileMap = new Map<string, string>();

function primaryOriginId(spirit: HexSpiritRow): string | null {
  return spirit.traits?.origin_ids?.[0] ?? null;
}
function primaryClassId(spirit: HexSpiritRow): string | null {
  return spirit.traits?.class_ids?.[0] ?? null;
}
type ViewMode = 'cards' | 'grid' | 'prints';
type HexSpirit = HexSpiritRow & {
		game_print_image_url: string | null;
		game_print_no_icons_url: string | null;
		art_raw_image_url: string | null;
	};
	type OriginOption = Pick<OriginRow, 'id' | 'name' | 'position' | 'icon_emoji' | 'icon_png'>;
		type ClassOption = Pick<ClassRow, 'id' | 'name' | 'position' | 'icon_emoji' | 'icon_png'>;
	type ImageVariant = 'game_print' | 'art_raw';
	type ImageDisplayMode = 'both' | ImageVariant;
	const VALID_IMAGE_MODES: Set<ImageDisplayMode> = new Set(['both', 'game_print', 'art_raw']);

export let data: PageData;
let viewMode: ViewMode = data.viewMode;
	$: viewMode = data.viewMode;

	function parseFiltersFromSearch(searchString: string) {
		const raw = searchString.startsWith('?') ? searchString.slice(1) : searchString;
		const params = new URLSearchParams(raw);
		const imageParam = params.get('image');
		return {
			search: params.get('q') ?? '',
			origin: params.get('origin') ?? 'all',
			classId: params.get('class') ?? 'all',
			image: (imageParam && VALID_IMAGE_MODES.has(imageParam as ImageDisplayMode)
				? (imageParam as ImageDisplayMode)
				: 'both') as ImageDisplayMode
		};
	}

	const initialFilters = parseFiltersFromSearch(data.initialSearch ?? '');

	let spirits: HexSpirit[] = [];
	let origins: OriginOption[] = [];
	let classes: ClassOption[] = [];
	let runes: RuneRow[] = [];
	let loading = true;
	let error: string | null = null;

	let search = initialFilters.search;
	let originFilter = initialFilters.origin;
	let classFilter = initialFilters.classId;
	let imageDisplayMode: ImageDisplayMode = initialFilters.image;
	let selectedOriginsForGrid: Set<string | null> = new Set();
let lastKnownSearch = data.initialSearch ?? '';
let applyingFiltersFromUrl = false;
let suppressNextUrlSync = false;
let filtersInitialized = false;
let filterSyncRequested = false;
let exportingArtPack = false;
let exportingMissingPrintsPack = false;
let batchUploadInProgress = false;
let batchUploadProgress = { processed: 0, total: 0 };
let exportingGridImage = false;

let showSpiritForm = false;
let editingSpirit: HexSpirit | null = null;
let formData: HexSpiritFormData = emptyHexSpiritForm();
let batchUploadInput: HTMLInputElement | null = null;

	let uploadingState: { id: string; variant: ImageVariant } | null = null;
	let removingState: { id: string; variant: ImageVariant } | null = null;
	let generatingId: string | null = null;
	let generatingWithReplicate = false;
	let generatingForAll = false;
	let generationProgress = { current: 0, total: 0 };
	let showPromptEditor = false;
	let promptToEdit = '';
	let pendingGeneration: { spirit: HexSpirit; useReplicate: boolean } | null = null;
	let promptEditorResolve: ((value: { confirmed: boolean; prompt?: string }) => void) | null = null;

	const gameAssetsStorage = supabase.storage.from('game_assets');

	function isUploadingVariant(spiritId: string, variant: ImageVariant) {
		return uploadingState?.id === spiritId && uploadingState.variant === variant;
	}

	function isRemovingVariant(spiritId: string, variant: ImageVariant) {
		return removingState?.id === spiritId && removingState.variant === variant;
	}

onMount(async () => {
	await Promise.all([loadOrigins(), loadClasses(), loadRunes()]);
	selectedOriginsForGrid = new Set([...origins.map((o) => o.id), null]);
	await loadSpirits();
	filtersInitialized = true;
	filterSyncRequested = true;
});

	$: {
		const currentSearch = $page.url.search;
		if (currentSearch !== lastKnownSearch) {
			lastKnownSearch = currentSearch;
			if (suppressNextUrlSync) {
				suppressNextUrlSync = false;
			} else {
				applyFiltersFromSearch(currentSearch);
			}
		}
	}

	$: if (filtersInitialized && filterSyncRequested && !applyingFiltersFromUrl) {
		filterSyncRequested = false;
		const desiredSearch = buildQueryString();
		if (desiredSearch !== $page.url.search) {
			suppressNextUrlSync = true;
			void goto(`/hex-spirits/${viewMode}${desiredSearch}`, {
				replaceState: true,
				keepFocus: true,
				noScroll: true
			});
		}
	}

// Reload spirits when filters change is handled by loadSpirits directly; editions removed.

	function getPublicImage(path: string | null, updatedAt?: string | null): string | null {
		if (!path) return null;
		const fullPath = path.startsWith('hex_spirits/') ? path : `hex_spirits/${path}`;
		const { data } = gameAssetsStorage.getPublicUrl(fullPath);
		if (!data?.publicUrl) return null;
		
		// Add cache-busting parameter using updated_at timestamp or current time
		const cacheBuster = updatedAt 
			? new Date(updatedAt).getTime() 
			: Date.now();
		const separator = data.publicUrl.includes('?') ? '&' : '?';
		return `${data.publicUrl}${separator}v=${cacheBuster}`;
	}

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

function buildIconSlots(spirit: HexSpirit): { type: 'origin' | 'class'; refId: string; file: string | null }[] {
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
				// Explicitly request alpha channel for transparency
				const ctx = canvas.getContext('2d', { alpha: true });
				if (!ctx) {
					reject(new Error('Unable to obtain 2D context'));
					return;
				}
				// Ensure fully transparent background (no fill, just clear)
				ctx.clearRect(0, 0, size, size);
				// Draw emoji text only - no background
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = `${size * 0.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
				ctx.fillText(emoji, size / 2, size / 2);
				canvas.toBlob((blob) => {
					if (!blob) {
						reject(new Error('Failed to render emoji blob'));
					} else {
						resolve(blob);
					}
				}, 'image/png');
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
			canvas.toBlob((blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('Failed to convert canvas to blob'));
				}
			}, type);
		});
	}

	function getIconSlotEntity(slot: SpiritIconSlot) {
		return slot.type === 'origin'
			? origins.find((origin) => origin.id === slot.ref_id)
			: classes.find((cls) => cls.id === slot.ref_id);
	}

	function getIconSlotLabel(slot: SpiritIconSlot) {
		const entity = getIconSlotEntity(slot);
		const name = entity?.name ?? 'Unassigned';
		return `${slot.type === 'origin' ? 'Origin' : 'Class'}: ${name}`;
	}

	function getIconSlotEmoji(slot: SpiritIconSlot): string | null {
		if (slot.type === 'origin') {
			const origin = origins.find((o) => o.id === slot.ref_id);
			return origin?.icon_emoji ?? null;
		}
		const cls = classes.find((c) => c.id === slot.ref_id);
		return cls?.icon_emoji ?? null;
	}

	function getIconSlotImageUrl(slot: SpiritIconSlot): string | null {
		if (slot.type === 'origin') {
			const entity = origins.find((origin) => origin.id === slot.ref_id);
			if (!entity?.icon_png) return null;
			return getOriginIconUrl(entity.icon_png)?.url ?? null;
		}
		const cls = classes.find((c) => c.id === slot.ref_id);
		if (!cls?.icon_png) return null;
		return getClassIconUrl(cls.icon_png)?.url ?? null;
	}

	function buildQueryString(): string {
		const params = new URLSearchParams();
		const trimmedSearch = search.trim();
		if (trimmedSearch) params.set('q', trimmedSearch);
		if (originFilter !== 'all') params.set('origin', originFilter);
		if (classFilter !== 'all') params.set('class', classFilter);
		if (imageDisplayMode !== 'both') params.set('image', imageDisplayMode);
		const query = params.toString();
		return query ? `?${query}` : '';
	}

	function applyFiltersFromSearch(searchString: string) {
		applyingFiltersFromUrl = true;
		const parsed = parseFiltersFromSearch(searchString);
		search = parsed.search;
		originFilter = parsed.origin;
		classFilter = parsed.classId;
		imageDisplayMode = parsed.image;
		applyingFiltersFromUrl = false;
	}

	function requestFilterSync() {
		if (!filtersInitialized) return;
		filterSyncRequested = true;
	}

function navigateToView(target: ViewMode) {
	if (target === viewMode) return;
	const query = buildQueryString();
	suppressNextUrlSync = true;
	void goto(`/hex-spirits/${target}${query}`, {
		keepFocus: true,
		noScroll: true
	});
}

function getRarityFromCost(cost: number): 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Prismatic' {
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
		// Build rune lookup map for rune_cost resolution
		const runeMap = new Map(runes.map(r => [r.id, r]));

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
			const safeSlug = sanitizeFileName(`${spirit.name}_${originName(primaryOriginId(spirit))}_${className(primaryClassId(spirit))}`) || 'spirit';
			const artFileName = `${spirit.id}_${safeSlug}_art_raw.png`;
			const gamePrintFileName = `${spirit.id}_game_print.png`;
			artFolder.file(artFileName, buffer);
			const iconSlots = buildIconSlots(spirit);
			const flatIcons = flattenIconSlots(iconSlots, 4);

			// Build rune cost columns - simple array of rune IDs
			const runeCostIds = spirit.rune_cost ?? [];
			const runeCostFiles = runeCostIds.map(runeId => {
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

		// Export rune icons
		const runesFolder = zip.folder('runes');
		if (runesFolder) {
			for (const rune of runes) {
				if (!rune.icon_path) continue;
				try {
					const iconPath = rune.icon_path.startsWith('runes/') ? rune.icon_path : `runes/${rune.icon_path}`;
					const { data: urlData } = gameAssetsStorage.getPublicUrl(iconPath);
					if (!urlData?.publicUrl) continue;

					const runeBlob = await downloadImageAsBlob(urlData.publicUrl);
					const buffer = await runeBlob.arrayBuffer();

					// Filename: {type}_{runeName}.png
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

	async function batchUploadGamePrints(files: File[]) {
		if (!files || files.length === 0) return;
		batchUploadInProgress = true;
		batchUploadProgress = { processed: 0, total: files.length };
		const errors: string[] = [];
		for (const file of files) {
		const match = file.name.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
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

	async function loadOrigins() {
		try {
			const records = await fetchOriginRecords();
			origins = records.map(({ id, name, position, icon_emoji, icon_png }) => ({ id, name, position, icon_emoji, icon_png }));
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
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
		link.download = `hex_spirits_${viewMode}_grid_${new Date().toISOString().slice(0, 10)}.png`;
		link.click();
	} catch (err) {
		console.error(err);
		alert('Failed to export grid as PNG.');
	} finally {
		exportingGridImage = false;
	}
}

	async function loadClasses() {
		try {
			const records = await fetchClassRecords();
			classes = records.map(({ id, name, position, icon_emoji, icon_png }) => ({ id, name, position, icon_emoji, icon_png }));
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
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
			origin_id: primaryOriginId(spirit),
			class_id: primaryClassId(spirit),
			game_print_image_url: getPublicImage(spirit.game_print_image_path, spirit.updated_at),
			game_print_no_icons_url: getPublicImage(spirit.game_print_no_icons, spirit.updated_at),
			art_raw_image_url: getPublicImage(spirit.art_raw_image_path, spirit.updated_at)
		}));
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
	} finally {
		loading = false;
	}
}

function openSpiritForm(spirit?: HexSpirit) {
	if (spirit) {
		editingSpirit = spirit;
		formData = hexSpiritRowToForm(spirit);
		formData.origin_id = spirit.traits?.origin_ids?.[0] ?? null;
		formData.class_id = spirit.traits?.class_ids?.[0] ?? null;
	} else {
		editingSpirit = null;
		const defaults = emptyHexSpiritForm();
		// Start with empty traits - user can add any origins/classes they want
		defaults.origin_id = null;
		defaults.class_id = null;
		defaults.traits.origin_ids = [];
		defaults.traits.class_ids = [];
		formData = defaults;
	}
	showSpiritForm = true;
}

function closeSpiritForm() {
	showSpiritForm = false;
}

function submitSpiritForm(event: Event) {
	event.preventDefault();
	void saveSpirit();
}

async function saveSpirit() {
	if (!formData.name.trim()) {
		alert('Spirit name is required.');
		return;
	}
	const originIds = formData.traits.origin_ids ?? [];
	const classIds = formData.traits.class_ids ?? [];

	try {
		const payload: HexSpiritFormData = {
			...formData,
			traits: {
				origin_ids: originIds,
				class_ids: classIds
			},
			game_print_image_path: formData.game_print_image_path ?? null,
			art_raw_image_path: formData.art_raw_image_path ?? null
		};
		if (editingSpirit) {
			payload.id = editingSpirit.id;
		}
		await saveHexSpiritRecord(payload);
		await loadSpirits();
		closeSpiritForm();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to save spirit: ${message}`);
	}
}

async function deleteSpirit(spirit: HexSpirit) {
	if (!confirm(`Delete hex spirit "${spirit.name}"?`)) return;
	try {
		await deleteHexSpiritRecord(spirit.id);
		await loadSpirits();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		alert(`Failed to delete spirit: ${message}`);
	}
}

	const originName = (originId: string | null) =>
		origins.find((origin) => origin.id === originId)?.name ?? 'Unassigned';

	const className = (classId: string | null) =>
		classes.find((cls) => cls.id === classId)?.name ?? 'None';

	function getCombatPower(cost: number): number {
		if (cost >= 1 && cost <= 3) return 1;
		if (cost >= 4 && cost <= 5) 1;
		if (cost === 7) return 2;
		if (cost === 9) return 3;
		// Default for other costs (6, 8, 10+)
		if (cost === 6) return 2;
		if (cost === 8) return 3;
		return 3; // 10+ costs
	}

	function sanitizeFileName(name: string): string {
		// Convert to lowercase, replace spaces and special chars with underscores
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50); // Limit length
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

		uploadingState = { id: spirit.id, variant };
		try {
			const existingPath =
				variant === 'game_print' ? spirit.game_print_image_path : spirit.art_raw_image_path;
			if (existingPath) {
				await gameAssetsStorage.remove([normalizeHexSpiritPath(existingPath)]);
			}

			// Use unified upload with transparent area cropping
			const sanitizedName = sanitizeFileName(spirit.name);
			const variantFolder = variant === 'game_print' ? 'game_print' : 'art_raw';
			const fileName = `hex_${sanitizedName}_${variant}`;
			const folder = `hex_spirits/${spirit.id}/${variantFolder}`;

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
				game_print_image_path?: string | null;
				art_raw_image_path?: string | null;
				updated_at: string;
			} = {
				updated_at: new Date().toISOString()
			};
			if (variant === 'game_print') {
				updateData.game_print_image_path = fullPath;
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
		} finally {
			uploadingState = null;
		}
	}

	async function removeImage(spirit: HexSpirit, variant: ImageVariant) {
		const existingPath =
			variant === 'game_print' ? spirit.game_print_image_path : spirit.art_raw_image_path;
		if (!existingPath) return;
		removingState = { id: spirit.id, variant };
		try {
			await gameAssetsStorage.remove([normalizeHexSpiritPath(existingPath)]);
			const updateData: {
				game_print_image_path?: string | null;
				art_raw_image_path?: string | null;
				updated_at: string;
			} = {
				updated_at: new Date().toISOString()
			};
			if (variant === 'game_print') {
				updateData.game_print_image_path = null;
			} else {
				updateData.art_raw_image_path = null;
			}
			const { error: updateError } = await supabase
				.from('hex_spirits')
				.update(updateData)
				.eq('id', spirit.id);
			if (updateError) {
				throw updateError;
			}
			await loadSpirits();
		} catch (err) {
			console.error(err);
			alert('Failed to remove image.');
		} finally {
			removingState = null;
		}
	}

	function handleFileChange(spirit: HexSpirit, event: Event, variant: ImageVariant) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (file) {
			handleImageUpload(spirit, file, variant);
		}
	}

	async function generateAIImage(spirit: HexSpirit, useReplicate = false) {
		// Generate the initial prompt
		let initialPrompt: string;
		if (useReplicate) {
			initialPrompt = generateSpiritPromptForReplicate(
				spirit.name,
				originName(primaryOriginId(spirit)),
				className(primaryClassId(spirit))
			);
		} else {
			initialPrompt = generateSpiritPrompt(
				spirit.name,
				originName(primaryOriginId(spirit)),
				className(primaryClassId(spirit))
			);
		}

		// Show prompt editor
		promptToEdit = initialPrompt;
		pendingGeneration = { spirit, useReplicate };
		showPromptEditor = true;
	}

	async function confirmPromptAndGenerate() {
		if (!pendingGeneration || !promptToEdit.trim()) {
			return;
		}

		const { spirit, useReplicate } = pendingGeneration;
		const finalPrompt = promptToEdit.trim();

		// Close the editor and resolve the promise
		showPromptEditor = false;
		const spiritToGenerate = spirit;
		const useReplicateFlag = useReplicate;
		const savedPrompt = finalPrompt;
		pendingGeneration = null;
		
		if (promptEditorResolve) {
			promptEditorResolve({ confirmed: true, prompt: savedPrompt });
			promptEditorResolve = null;
		}

		// Set generating state
		generatingId = spiritToGenerate.id;
		generatingWithReplicate = useReplicateFlag;

		try {
			let imageUrl: string;

			if (useReplicateFlag) {
				const images = await generateReplicateImages({
					prompt: savedPrompt,
					aspectRatio: '1:1'
				});

				// Automatically use the first (and only) generated image
				if (images.length === 0) {
					throw new Error('No images were generated');
				}
				imageUrl = images[0].url;
			} else {
				const images = await generateImages(savedPrompt, {
					numImages: 1,
					width: 512,
					height: 512
				});

				// Automatically use the first (and only) generated image
				if (images.length === 0) {
					throw new Error('No images were generated');
				}
				imageUrl = images[0].url;
			}

			// Automatically download and upload the generated image
			await selectGeneratedImage(imageUrl, spiritToGenerate);
		} catch (err) {
			console.error(err);
			alert(err instanceof Error ? err.message : 'Failed to generate images. Please try again.');
		} finally {
			generatingId = null;
			generatingWithReplicate = false;
		}
	}

	function cancelPromptEditor() {
		showPromptEditor = false;
		promptToEdit = '';
		if (promptEditorResolve) {
			promptEditorResolve({ confirmed: false });
			promptEditorResolve = null;
		}
		pendingGeneration = null;
	}

	async function selectGeneratedImage(imageUrl: string, spirit: HexSpirit) {
		try {
			// Download the image as a blob
			const blob = await downloadImageAsBlob(imageUrl);

			// Verify blob is an image
			if (!blob.type.startsWith('image/')) {
				// If blob doesn't have proper MIME type, set it explicitly
				const imageBlob = new Blob([blob], { type: 'image/png' });
				const file = new File([imageBlob], `${spirit.name}_ai.png`, {
					type: 'image/png'
				});
				await handleImageUpload(spirit, file, 'art_raw');
			} else {
				// Create a File object from the blob with the detected MIME type
				const file = new File([blob], `${spirit.name}_ai.png`, {
					type: blob.type || 'image/png'
				});
				await handleImageUpload(spirit, file, 'art_raw');
			}
		} catch (err) {
			console.error(err);
			alert(err instanceof Error ? err.message : 'Failed to download and upload image. Please try again.');
		}
	}

	async function generateImagesForAllSpirits(useReplicate = false) {
		// Find all spirits without images
	const spiritsWithoutImages = spirits.filter((spirit) => !spirit.art_raw_image_path);

		if (spiritsWithoutImages.length === 0) {
			alert('All spirits already have art raw images!');
			return;
		}

		if (
			!confirm(
				`Generate art raw images for ${spiritsWithoutImages.length} spirits without art raw assets? This may take a while. You will be prompted to edit the prompt for each spirit.`
			)
		) {
			return;
		}

		generatingForAll = true;
		generationProgress = { current: 0, total: spiritsWithoutImages.length };

		try {
			for (let i = 0; i < spiritsWithoutImages.length; i++) {
				const spirit = spiritsWithoutImages[i];
				generationProgress = { current: i + 1, total: spiritsWithoutImages.length };
				generatingId = spirit.id;
				generatingWithReplicate = useReplicate;

				try {
					// Generate prompt and show editor
					let initialPrompt: string;
					if (useReplicate) {
						initialPrompt = generateSpiritPromptForReplicate(
							spirit.name,
							originName(primaryOriginId(spirit)),
							className(primaryClassId(spirit))
						);
					} else {
						initialPrompt = generateSpiritPrompt(
							spirit.name,
							originName(primaryOriginId(spirit)),
							className(primaryClassId(spirit))
						);
					}

					// Show prompt editor and wait for user confirmation
					promptToEdit = initialPrompt;
					pendingGeneration = { spirit, useReplicate };
					showPromptEditor = true;

					// Wait for user to confirm or cancel
					const result = await new Promise<{ confirmed: boolean; prompt?: string }>((resolve) => {
						promptEditorResolve = resolve;
					});

					// If user cancelled, skip this spirit
					if (!result.confirmed || !result.prompt) {
						continue;
					}

					// Generate with the edited prompt
					const finalPrompt = result.prompt;
					let imageUrl: string;

					if (useReplicate) {
						const images = await generateReplicateImages({
							prompt: finalPrompt,
							aspectRatio: '1:1'
						});
						if (images.length === 0) {
							throw new Error('No images were generated');
						}
						imageUrl = images[0].url;
					} else {
						const images = await generateImages(finalPrompt, {
							numImages: 1,
							width: 512,
							height: 512
						});
						if (images.length === 0) {
							throw new Error('No images were generated');
						}
						imageUrl = images[0].url;
					}

					await selectGeneratedImage(imageUrl, spirit);

					// Small delay between generations to avoid rate limiting
					if (i < spiritsWithoutImages.length - 1) {
						await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
					}
				} catch (err) {
					console.error(`Failed to generate image for ${spirit.name}:`, err);
					// Continue with next spirit even if one fails
				}
			}

			alert(`Finished generating art raw images for ${spiritsWithoutImages.length} spirits.`);
		} catch (err) {
			console.error(err);
			alert('An error occurred during batch generation. Some images may have been generated.');
		} finally {
			generatingForAll = false;
			generationProgress = { current: 0, total: 0 };
			generatingId = null;
			generatingWithReplicate = false;
			showPromptEditor = false;
			pendingGeneration = null;
			await loadSpirits(); // Refresh the list
		}
	}

	$: filteredSpirits = spirits.filter((spirit) => {
		if (originFilter !== 'all' && spirit.origin_id !== originFilter) return false;
		if (classFilter !== 'all' && spirit.class_id !== classFilter) return false;
		if (search.trim()) {
			const term = search.trim().toLowerCase();
			if (
				!spirit.name.toLowerCase().includes(term) &&
				!originName(primaryOriginId(spirit)).toLowerCase().includes(term) &&
				!className(primaryClassId(spirit)).toLowerCase().includes(term)
			) {
				return false;
			}
		}
		return true;
	});

	// Create table data: rows = classes, columns = origins
	$: gridViewData = (() => {
		// Get all unique classes and origins from filtered spirits
		const classSet = new Set<string | null>();
		const originSet = new Set<string | null>();

		filteredSpirits.forEach((spirit) => {
			classSet.add(spirit.class_id);
			originSet.add(spirit.origin_id);
		});

		// Always include Special class in the grid
		const specialClass = classes.find((c) => c.name === 'Special');
		if (specialClass) {
			classSet.add(specialClass.id);
		}

		const classList = Array.from(classSet)
			.map((classId) => {
				const classSpirits = filteredSpirits.filter((s) => s.class_id === classId);
				const count = classSpirits.length;
				const combatPower = classSpirits.reduce((sum, s) => sum + getCombatPower(s.cost), 0);
				const cls = classId ? classes.find((c) => c.id === classId) : null;
				return {
					classId,
					className: className(classId),
					position: cls?.position ?? 9999, // Unassigned classes go last
					count,
					combatPower,
					powerRatio: count > 0 ? (combatPower / count).toFixed(2) : '0.00'
				};
			})
			.sort((a, b) => a.position - b.position);

		const originList = Array.from(originSet)
			.filter((originId) => selectedOriginsForGrid.has(originId))
			.map((originId) => {
				const originSpirits = filteredSpirits.filter((s) => s.origin_id === originId);
				const count = originSpirits.length;
				const combatPower = originSpirits.reduce((sum, s) => sum + getCombatPower(s.cost), 0);
				const origin = originId ? origins.find((o) => o.id === originId) : null;
				return {
					originId,
					originName: originName(originId),
					position: origin?.position ?? 9999, // Unassigned origins go last
					count,
					combatPower,
					powerRatio: count > 0 ? (combatPower / count).toFixed(2) : '0.00'
				};
			})
			.sort((a, b) => a.position - b.position);

		// Create 2D grid: [class][origin] = spirits matching both
		const grid: Map<string | null, Map<string | null, HexSpirit[]>> = new Map();

		classList.forEach(({ classId }) => {
			grid.set(classId, new Map());
			originList.forEach(({ originId }) => {
				grid.get(classId)!.set(originId, []);
			});
		});

		// Populate grid with spirits
		filteredSpirits.forEach((spirit) => {
			const classMap = grid.get(spirit.class_id);
			if (classMap) {
				const cell = classMap.get(spirit.origin_id);
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
	})();
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Hex Spirits</h1>
			<p>Manage the roster of spirits, their classes, origins, and imagery.</p>
		</div>
		<div class="actions">
			<button
				class="btn"
				class:active={viewMode === 'cards'}
				onclick={() => navigateToView('cards')}
			>
				Cards
			</button>
			<button
				class="btn"
				class:active={viewMode === 'grid'}
				onclick={() => navigateToView('grid')}
			>
				Grid
			</button>
			<button
				class="btn"
				class:active={viewMode === 'prints'}
				onclick={() => navigateToView('prints')}
			>
				Game Prints
			</button>
			{#if viewMode === 'grid' || viewMode === 'prints'}
				<button
					class="btn btn--secondary"
					type="button"
					onclick={exportGridAsPng}
					disabled={exportingGridImage}
				>
					{exportingGridImage ? 'Exporting…' : 'Export Grid as PNG'}
				</button>
			{/if}
			<button class="btn" onclick={() => openSpiritForm()}>Create Hex Spirit</button>
			<button
				class="btn btn--secondary"
				type="button"
				onclick={() => exportArtRawPack(false)}
				disabled={exportingArtPack || loading}
			>
				{exportingArtPack ? 'Preparing Export…' : 'Export Art Raw Pack'}
			</button>
			<button
				class="btn btn--secondary"
				type="button"
				onclick={() => exportArtRawPack(true)}
				disabled={exportingMissingPrintsPack || loading}
			>
				{exportingMissingPrintsPack
					? 'Exporting Missing Game Prints…'
					: 'Export Missing Game Prints Pack'}
			</button>
			<button
				class="btn btn--secondary"
				type="button"
				onclick={() => batchUploadInput?.click()}
				disabled={batchUploadInProgress}
			>
				{batchUploadInProgress
					? `Uploading... (${batchUploadProgress.processed}/${batchUploadProgress.total})`
					: 'Batch Upload Game Prints'}
			</button>
			<input
				type="file"
				accept="image/png,image/webp,image/jpeg"
				multiple
				class="sr-only"
				bind:this={batchUploadInput}
				onchange={handleBatchUploadInput}
			/>
		<button
			class="btn btn--secondary"
			onclick={() => generateImagesForAllSpirits(false)}
			disabled={generatingForAll || loading}
		>
			{generatingForAll
				? `Generating... (${generationProgress.current}/${generationProgress.total})`
				: 'Generate Art (Raw) for All (SinkIn)'}
		</button>
		<button
			class="btn btn--secondary"
			onclick={() => generateImagesForAllSpirits(true)}
			disabled={generatingForAll || loading}
		>
			{generatingForAll
				? `Generating... (${generationProgress.current}/${generationProgress.total})`
				: 'Generate Art (Raw) for All (Replicate)'}
		</button>
		</div>
	</header>
	<p class="export-hint">
		Tip: Keep the filenames generated by the export (they start with each spirit's ID, e.g.,
		<code>123e4567-e89b-12d3-a456-426614174000_game_print.png</code>) so batch upload can match
		records automatically.
	</p>

	<section class="filters">
	<label>
		Search
		<input
			type="search"
			placeholder="Search spirits"
			bind:value={search}
			oninput={requestFilterSync}
		/>
	</label>
	<label>
		Origin
		<select bind:value={originFilter} onchange={requestFilterSync}>
				<option value="all">All origins</option>
				{#each origins as origin}
					<option value={origin.id}>{origin.name}</option>
				{/each}
			</select>
		</label>
	<label>
		Class
		<select bind:value={classFilter} onchange={requestFilterSync}>
				<option value="all">All classes</option>
				{#each classes as cls}
					<option value={cls.id}>{cls.name}</option>
				{/each}
			</select>
		</label>
	<label>
		Images
		<select bind:value={imageDisplayMode} onchange={requestFilterSync}>
				<option value="both">Game print + art</option>
				<option value="game_print">Game print only</option>
				<option value="art_raw">Art (raw) only</option>
			</select>
		</label>
	</section>

	{#if loading}
		<div class="card">Loading hex spirits…</div>
	{:else if error}
		<div class="card error">Error: {error}</div>
	{:else if viewMode === 'cards'}
		<section class="card-grid">
			{#each filteredSpirits as spirit (spirit.id)}
				<article class="card spirit-card">
					<header>
						<div>
							<h2>{spirit.name}</h2>
							<small>
								Origin: {originName(primaryOriginId(spirit))} • Class: {className(primaryClassId(spirit))} • Cost:
								{spirit.cost}
							</small>
						</div>
						<CardActionMenu
							onEdit={() => openSpiritForm(spirit)}
							onDelete={() => deleteSpirit(spirit)}
						/>
					</header>
				<div class="spirit-card__body">
					{#if imageDisplayMode !== 'art_raw'}
					<div class="spirit-image-block">
						<h3>Game Print</h3>
						<div class="spirit-card__image-wrapper">
							{#if spirit.game_print_image_url}
								<img
									class="spirit-card__image"
									src={spirit.game_print_image_url}
									alt={`Game print image of ${spirit.name}`}
									loading="lazy"
								/>
							{:else}
								<div class="spirit-card__placeholder">No Game Print</div>
							{/if}
						</div>
					<div class="spirit-card__actions">
							<label class="upload-button">
								<input
									type="file"
									accept="image/*"
									onchange={(event) => handleFileChange(spirit, event, 'game_print')}
									aria-label={`Upload game print for ${spirit.name}`}
									disabled={generatingId === spirit.id}
								/>
								<span>
									{isUploadingVariant(spirit.id, 'game_print') ? 'Uploading…' : 'Upload Game Print'}
								</span>
							</label>
							<button
								class="btn danger"
								type="button"
								onclick={() => removeImage(spirit, 'game_print')}
								disabled={
									isRemovingVariant(spirit.id, 'game_print') ||
									!spirit.game_print_image_path ||
									generatingId === spirit.id
								}
							>
								{isRemovingVariant(spirit.id, 'game_print') ? 'Removing…' : 'Remove Game Print'}
							</button>
					</div>
					<p class="spirit-card__meta">
						Expected Photoshop output: <code>{spirit.id}_game_print.png</code>
					</p>
				</div>
					{/if}
					{#if imageDisplayMode !== 'game_print'}
					<div class="spirit-image-block">
						<h3>Art (Raw)</h3>
						<div class="spirit-card__image-wrapper">
							{#if spirit.art_raw_image_url}
								<img
									class="spirit-card__image"
									src={spirit.art_raw_image_url}
									alt={`Art (raw) image of ${spirit.name}`}
									loading="lazy"
								/>
							{:else}
								<div class="spirit-card__placeholder">No Art (Raw)</div>
							{/if}
						</div>
						<div class="spirit-card__actions spirit-card__actions--stacked">
							<button
								class="btn btn--primary"
								type="button"
								onclick={() => generateAIImage(spirit, false)}
								disabled={
									generatingId === spirit.id || isUploadingVariant(spirit.id, 'art_raw')
								}
							>
								{generatingId === spirit.id && !generatingWithReplicate
									? 'Generating…'
									: 'Generate (SinkIn)'}
							</button>
							<button
								class="btn btn--secondary"
								type="button"
								onclick={() => generateAIImage(spirit, true)}
								disabled={
									generatingId === spirit.id || isUploadingVariant(spirit.id, 'art_raw')
								}
							>
								{generatingId === spirit.id && generatingWithReplicate
									? 'Generating…'
									: 'Generate (Replicate)'}
							</button>
							<label class="upload-button">
								<input
									type="file"
									accept="image/*"
									onchange={(event) => handleFileChange(spirit, event, 'art_raw')}
									aria-label={`Upload art raw image for ${spirit.name}`}
									disabled={generatingId === spirit.id}
								/>
								<span>
									{isUploadingVariant(spirit.id, 'art_raw') ? 'Uploading…' : 'Upload Art (Raw)'}
								</span>
							</label>
							<button
								class="btn danger"
								type="button"
								onclick={() => removeImage(spirit, 'art_raw')}
								disabled={
									isRemovingVariant(spirit.id, 'art_raw') ||
									!spirit.art_raw_image_path ||
									generatingId === spirit.id
								}
							>
								{isRemovingVariant(spirit.id, 'art_raw') ? 'Removing…' : 'Remove Art (Raw)'}
							</button>
					</div>
					<div class="icon-slot-summary">
						<h3>Icon Slots</h3>
						<div class="icon-slot-list">
</div></div></div>
					{/if}
				</div>
				</article>
			{:else}
				<div class="card empty">No hex spirits match the current filters.</div>
			{/each}
		</section>
	{:else}
		{#if viewMode === 'grid' || viewMode === 'prints'}
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
		{/if}
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
								{@const spirits = gridViewData.grid.get(classItem.classId)?.get(origin.originId) ?? []}
								<td class="cell">
							{#if spirits.length > 0}
								{#if viewMode === 'prints'}
									<div class="cell-prints">
										{#each spirits as spirit (spirit.id)}
										<div class="cell-print" role="button" tabindex="0" onclick={() => openSpiritForm(spirit)} onkeydown={(event) => (event.key === 'Enter' ? openSpiritForm(spirit) : null)}>
											{#if spirit.game_print_image_url}
												<img src={spirit.game_print_image_url} alt={`Game print for ${spirit.name}`} loading="lazy" />
											{:else}
												<div class="cell-print__placeholder">No Game Print</div>
											{/if}
										</div>
										{/each}
									</div>
										{:else}
											<div class="cell-spirits">
												{#each spirits as spirit (spirit.id)}
													{@const traitCounts = getTraitCounts(spirit)}
													<div class="cell-spirit">
														<div class="cell-spirit__info">
															<span class="cell-spirit__name">{spirit.name}</span>
															<span class="cell-spirit__meta">Cost: {spirit.cost}</span>
															<span class="cell-spirit__traits">
																<span class="trait-badge trait-badge--origin">{traitCounts.origins}O</span>
																<span class="trait-badge trait-badge--class">{traitCounts.classes}C</span>
															</span>
														</div>
														<CardActionMenu
															onEdit={() => openSpiritForm(spirit)}
															onDelete={() => deleteSpirit(spirit)}
														/>
													</div>
												{/each}
											</div>
										{/if}
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

	{#if showSpiritForm}
		<EditorModal
			title={editingSpirit ? 'Edit Hex Spirit' : 'Create Hex Spirit'}
			description="Manage core stats and metadata before uploading imagery."
			size="md"
			on:close={closeSpiritForm}
		>
			<form id="hex-spirit-editor-form" class="spirit-form" onsubmit={submitSpiritForm}>
				<label>
					Name
					<input type="text" bind:value={formData.name} required />
				</label>
				<div class="span-full translations-editor">
					<div class="translations-editor__header">
						<div class="translations-editor__title">Alternate Names (Languages)</div>
						<button type="button" class="btn translations-editor__add" onclick={addNameTranslationRow}>+ Add</button>
					</div>
					{#if (formData.name_translations ?? []).length === 0}
						<div class="translations-editor__empty">No alternate names.</div>
					{:else}
						<div class="translations-editor__rows">
							{#each formData.name_translations ?? [] as row, idx (idx)}
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
										class="btn translations-row__remove"
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
			<input type="number" min="0" bind:value={formData.cost} />
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
						value={countOccurrences(formData.traits.origin_ids, origin.id)}
						oninput={(e) => updateOriginQuantity(origin.id, Number((e.currentTarget as HTMLInputElement).value))}
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
							value={countOccurrences(formData.traits.class_ids, cls.id)}
							oninput={(e) => updateClassQuantity(cls.id, Number((e.currentTarget as HTMLInputElement).value))}
						/>
					</div>
				{/each}
			</div>
		</div>
			{#if editingSpirit}
			<div class="span-full image-upload-section">
				<label class="upload-label">Game Print Image</label>
				<ImageUploader
					bind:value={formData.game_print_image_path}
					folder={`hex_spirits/${editingSpirit.id}/game_print`}
					maxSizeMB={50}
					aspectRatio="1 / 1"
					onupload={(path) => {
						formData.game_print_image_path = path;
					}}
					onerror={(err) => alert(`Upload failed: ${err}`)}
				/>
			</div>
			<div class="span-full image-upload-section">
				<label class="upload-label">Art Raw Image</label>
				<ImageUploader
					bind:value={formData.art_raw_image_path}
					folder={`hex_spirits/${editingSpirit.id}/art_raw`}
					maxSizeMB={50}
					aspectRatio="1 / 1"
					onupload={(path) => {
						formData.art_raw_image_path = path;
					}}
					onerror={(err) => alert(`Upload failed: ${err}`)}
				/>
			</div>
		{:else}
			<p class="span-full upload-note">Save the spirit first to enable image uploads.</p>
		{/if}
		<label class="span-full">
			PSD folder override (optional)
			<input
				type="text"
				bind:value={formData.psd_folder_override}
				placeholder="e.g. Prismatic_black, Prismatic_saturated"
			/>
			<small style="color: var(--color-muted); font-size: 0.75rem;">
				Override the Photoshop folder used for export. If blank, defaults to rarity (Common/Rare/Epic/Legendary/Prismatic).
			</small>
		</label>
		</form>

			<div slot="footer" class="modal-footer-actions">
				<button class="btn btn--primary" type="submit" form="hex-spirit-editor-form">Save</button>
				<button class="btn" type="button" onclick={closeSpiritForm}>Cancel</button>
			</div>
		</EditorModal>
	{/if}

	{#if showPromptEditor && pendingGeneration}
		<EditorModal
			title="Edit Prompt"
			description="Review and edit the prompt for {pendingGeneration.spirit.name}"
			size="md"
			on:close={cancelPromptEditor}
		>
			<label class="span-full">
				Prompt
				<textarea
					bind:value={promptToEdit}
					rows="6"
					placeholder="Enter your prompt here..."
					style="width: 100%; padding: 0.5rem; border-radius: 4px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(148, 163, 184, 0.25); color: inherit; font-family: inherit;"
				></textarea>
			</label>
			<div slot="footer" class="modal-footer-actions">
				<button class="btn" type="button" onclick={cancelPromptEditor}>Cancel</button>
				<button
					class="btn btn--primary"
					type="button"
					onclick={confirmPromptAndGenerate}
					disabled={!promptToEdit.trim()}
				>
					Generate Image
				</button>
			</div>
		</EditorModal>
	{/if}

</section>

<style>
	.spirit-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.65rem;
	}

	.spirit-form .span-full {
		grid-column: 1 / -1;
	}

	.spirit-form .image-upload-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.spirit-form .upload-label {
		font-size: 0.85rem;
		font-weight: 500;
		color: #cbd5e1;
	}

	.spirit-form .upload-note {
		font-size: 0.8rem;
		color: #94a3b8;
		font-style: italic;
		padding: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px dashed rgba(148, 163, 184, 0.3);
		text-align: center;
		margin: 0;
	}

	.translations-editor {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.14);
		background: rgba(15, 23, 42, 0.25);
		border-radius: 6px;
	}

	.translations-editor__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.translations-editor__title {
		font-size: 0.8rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.translations-editor__add {
		font-size: 0.75rem;
		padding: 0.25rem 0.45rem;
	}

	.translations-editor__empty {
		color: #94a3b8;
		font-size: 0.8rem;
		padding: 0.1rem 0;
	}

	.translations-editor__rows {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.translations-row {
		display: grid;
		grid-template-columns: 120px 1fr auto;
		gap: 0.45rem;
		align-items: center;
	}

	.translations-row input {
		width: 100%;
		padding: 0.45rem 0.55rem;
		border-radius: 6px;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: inherit;
	}

	.translations-row__remove {
		font-size: 0.75rem;
		padding: 0.35rem 0.55rem;
		background: rgba(248, 113, 113, 0.12);
		border: 1px solid rgba(248, 113, 113, 0.28);
		color: #fecaca;
	}

	.translations-editor__hint {
		color: #94a3b8;
		font-size: 0.75rem;
		margin: 0;
	}

	.spirit-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.spirit-card header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.6rem;
	}

	.spirit-card h2 {
		margin: 0;
	}

	.spirit-card small {
		display: block;
		color: #a5b4fc;
		margin-top: 0.15rem;
	}

	.spirit-card__body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
		align-items: stretch;
	}

	.spirit-image-block {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		background: rgba(15, 23, 42, 0.65);
		border-radius: 12px;
		padding: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.spirit-image-block h3 {
		margin: 0;
		font-size: 0.95rem;
		color: #c7d2fe;
	}

	.spirit-card__image-wrapper {
		width: 100%;
		aspect-ratio: 1 / 1;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.6);
	}

	.spirit-card__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.spirit-card__placeholder {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: #94a3b8;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.spirit-card__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-start;
	}

	.spirit-card__actions--stacked {
		flex-direction: column;
		align-items: stretch;
	}

	.icon-slot-summary {
		margin-top: 0.5rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 10px;
		padding: 0.6rem;
	}

	.icon-slot-summary h3 {
		margin: 0 0 0.4rem;
		font-size: 0.9rem;
		color: #cbd5f5;
	}

	.icon-slot-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.upload-button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.upload-button input[type='file'] {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.upload-button span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.7);
		color: inherit;
		min-width: 120px;
	}

	.card-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	}

	.error {
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	.actions .btn.active {
		background: rgba(99, 102, 241, 0.3);
		border-color: rgba(99, 102, 241, 0.5);
	}



	.class-origin-table {
		overflow-x: auto;
		position: relative;
		width: 100vw;
		left: 50%;
		margin-left: -50vw;
		margin-right: -50vw;
		padding: 0 1rem;
	}

	@media (min-width: 960px) {
		.class-origin-table {
			width: calc(100vw - 200px);
			left: calc(200px - 50vw + 50%);
			margin-left: 0;
			margin-right: 0;
		}
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


	.cell-spirits {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.cell-spirit {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.5);
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.cell-spirit__info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.cell-spirit__name {
		font-weight: 600;
		color: #f8fafc;
		font-size: 0.875rem;
		line-height: 1.2;
	}

	.cell-spirit__meta {
		font-size: 0.75rem;
		color: #a5b4fc;
	}

	.cell-spirit__traits {
		display: flex;
		gap: 4px;
		margin-top: 2px;
	}

	.trait-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.65rem;
		font-weight: 600;
		padding: 1px 5px;
		border-radius: 3px;
		letter-spacing: 0.02em;
	}

	.trait-badge--origin {
		background: rgba(236, 72, 153, 0.25);
		color: #f9a8d4;
		border: 1px solid rgba(236, 72, 153, 0.4);
	}

	.trait-badge--class {
		background: rgba(59, 130, 246, 0.25);
		color: #93c5fd;
		border: 1px solid rgba(59, 130, 246, 0.4);
	}

	.grid-origin-selector {
		margin-bottom: 1.5rem;
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

	.export-hint {
		margin: 0.5rem 0 1rem;
		color: #94a3b8;
		font-size: 0.85rem;
	}

	.export-hint code {
		background: rgba(15, 23, 42, 0.6);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}

	.spirit-card__meta {
		font-size: 0.75rem;
		color: #cbd5f5;
		margin: -0.25rem 0 0.25rem;
		word-break: break-all;
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
</style>
