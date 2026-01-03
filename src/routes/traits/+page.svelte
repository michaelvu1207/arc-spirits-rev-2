<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { OriginRow, ClassRow, RuneRow, SpecialCategoryRow, CallingOrbImageRow, HexSpiritRow, IconPoolRow } from '$lib/types/gameData';
	import type {
		BackupTrimEffect,
		BenefitEffect,
		DiceEffect,
		Effect,
		EffectBreakpoint,
		FlatStatEffect,
		MultiplierEffect
	} from '$lib/types/effects';
	import { Button, FormField, Input, Textarea, Select } from '$lib/components/ui';
	import { FilterBar, ImageUploader } from '$lib/components/shared';
	import { Modal, PageLayout, type Tab } from '$lib/components/layout';
	import { EditorModal } from '$lib';
	import { OriginsListView, OriginsTableView, CallingCardEditor, CallingOrbTemplate, CallingOrbGenerated } from '$lib/components/origins';
	import { ClassesListView, ClassesTableView, ClassesPdfView } from '$lib/components/classes';
	import { RunesListView, RunesTableView, RunesGalleryView, RunesJsonView } from '$lib/components/runes';

	// Import composables and utilities
	import { useFormModal, useFilteredData, useFileUpload, useLookup } from '$lib/composables';
	import { getErrorMessage, publicAssetUrl, sanitizeFilename } from '$lib/utils';
	import { emojiToPngBlob } from '$lib/utils/emojiToPng';
	import { generateRuneIcon } from '$lib/utils/runeIconGenerator';
	import { processAndUploadImage } from '$lib/utils/storage';
	import { loadAllIcons, clearIconPoolCache } from '$lib/utils/iconPool';

	// Import feature modules
	import {
		deleteOriginRecord,
		emptyOriginForm,
		fetchOriginRecords,
		originRowToForm,
		saveOriginRecord,
		type OriginFormData
	} from '$lib/features/origins/origins';

	import {
		classRowToForm,
		createEffect,
		deleteClassRecord,
		effectTypes,
		emptyClassForm,
		fetchClassRecords,
		formatEffectSummary,
		saveClassRecord,
		EMPTY_PRISMATIC,
		type ClassFormData,
		type PrismaticForm
	} from '$lib/features/classes/classes';

	import {
		fetchSpecialCategoryRecords,
		saveSpecialCategoryRecord,
		deleteSpecialCategoryRecord,
		emptySpecialCategoryForm,
		specialCategoryRowToForm,
		type SpecialCategoryFormData
	} from '$lib/features/special-categories/specialCategories';

	import { fetchDiceRecords } from '$lib/features/dice/dice';

	// State
	let origins = $state<OriginRow[]>([]);
	let classes = $state<ClassRow[]>([]);
	let runes = $state<RuneRow[]>([]);
	let specialCategories = $state<SpecialCategoryRow[]>([]);
	let callingOrbImages = $state<CallingOrbImageRow[]>([]);
	let hexSpirits = $state<HexSpiritRow[]>([]);
	let iconPool = $state<IconPoolRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let backfillingIcons = $state(false);

	// Main tabs: Origins, Classes, Runes
	const mainTabs: Tab[] = [
		{ id: 'origins', label: 'Origins', icon: '🌊' },
		{ id: 'classes', label: 'Classes', icon: '⚔️' },
		{ id: 'runes', label: 'Runes', icon: '✨' }
	];
	let activeMainTab = $state('origins');

	// Sub-tabs for each main tab
	const originSubTabs: Tab[] = [
		{ id: 'list', label: 'List', icon: '📋' },
		{ id: 'table', label: 'Table', icon: '📊' },
		{ id: 'calling-orb-template', label: 'Calling Orb Template', icon: '🎨' },
		{ id: 'calling-orb-generated', label: 'Calling Orb Generated', icon: '🖼️' }
	];
	const classSubTabs: Tab[] = [
		{ id: 'list', label: 'List', icon: '📋' },
		{ id: 'table', label: 'Table', icon: '📊' },
		{ id: 'pdf', label: 'PDF Export', icon: '📄' }
	];
	const runeSubTabs: Tab[] = [
		{ id: 'gallery', label: 'Rune Gallery', icon: '🖼️' },
		{ id: 'list', label: 'Data: List', icon: '📋' },
		{ id: 'table', label: 'Data: Table', icon: '📊' },
		{ id: 'json', label: 'TTS JSON', icon: '📦' }
	];

	let activeOriginSubTab = $state('list');
	let activeClassSubTab = $state('list');
	let activeRuneSubTab = $state('gallery');

	// Origins state
	const originModal = useFormModal<OriginFormData>(emptyOriginForm());
	const originFiltered = useFilteredData(
		() => origins,
		{ searchFields: ['name', 'description'] }
	);
	const iconUpload = useFileUpload('game_assets', 'origin_icons');

	// Classes state
	let showClassForm = $state(false);
	let editingClass = $state<ClassRow | null>(null);
	let classFormData = $state<ClassFormData>(emptyClassForm());
	let tagsInput = $state('');
	let prismaticEnabled = $state(false);
	let prismaticCache = $state<PrismaticForm>({ ...EMPTY_PRISMATIC });
	let classSearch = $state('');

	let diceOptions = $state<{ id: string; name: string }[]>([]);
	let diceNameById = $state(new Map<string, string>());

	let uploadingIconId = $state<string | null>(null);
	let removingIconId = $state<string | null>(null);
	const gameAssetsStorage = supabase.storage.from('game_assets');

	// Public URL helper for runes
	const publicUrl = (path: string) => gameAssetsStorage.getPublicUrl(path).data.publicUrl;

	// Special category state
	let showSpecialCategoryForm = $state(false);
	let editingSpecialCategory = $state<SpecialCategoryRow | null>(null);
	let specialCategoryFormData = $state<SpecialCategoryFormData>(emptySpecialCategoryForm());

	// Runes state
	let runeOriginFilter = $state('all');
	let runeClassFilter = $state('all');

	const runeModal = useFormModal<Partial<RuneRow> & { runeType: 'origin' | 'class' }>({
		name: '',
		origin_id: null,
		class_id: null,
		runeType: 'origin'
	});

	let savingRune = $state(false);
	let runeIconNeedsRegeneration = $state(false);
	let runeIconStatus = $state<string | null>(null);
	let runeBaseline = $state<{
		runeType: 'origin' | 'class';
		origin_id: string | null;
		class_id: string | null;
		icon_background_path: string | null;
	} | null>(null);

	const originLookup = useLookup(() => origins, 'name');
	const classLookup = useLookup(() => classes, 'name');

	const runeFiltered = useFilteredData(
		() => runes,
		{
			searchFields: ['name'],
			filters: [
				{
					key: 'origin_id',
					value: () => (runeOriginFilter === 'all' ? null : runeOriginFilter)
				},
				{
					key: 'class_id',
					value: () => (runeClassFilter === 'all' ? null : runeClassFilter)
				}
			]
		}
	);

	// Derived state
	const formIconPreview = $derived(
		publicAssetUrl(originModal.formData.icon_png, { updatedAt: Date.now() })
	);

	const sorcererName = 'sorcerer';

	const resolveDiceLabel = (id: string | null | undefined, fallback?: string) => {
		if (id && diceNameById.has(id)) return diceNameById.get(id) ?? fallback ?? 'Custom Dice';
		return fallback ?? (id ?? 'Custom Dice');
	};

	const summarizeEffectBase = (effect: Effect) => formatEffectSummary(effect, resolveDiceLabel);

	const specialCategoryClassIds = $derived(
		new Set(
			specialCategories.flatMap((cat) => [
				...cat.slot_1_class_ids,
				...cat.slot_2_class_ids,
				...cat.slot_3_class_ids
			])
		)
	);

	// Search-filtered classes (includes special category classes for lookup)
	const searchFilteredClasses = $derived(
		classes.filter((entry) => {
			if (!classSearch.trim()) return true;
			const term = classSearch.trim().toLowerCase();
			return (
				entry.name.toLowerCase().includes(term) ||
				(entry.description ?? '').toLowerCase().includes(term) ||
				(entry.footer ?? '').toLowerCase().includes(term)
			);
		})
	);

	// Count of regular classes (excluding special category classes)
	const filteredClassCount = $derived(
		searchFilteredClasses.filter((c) => !specialCategoryClassIds.has(c.id)).length
	);

	onMount(async () => {
		await loadDiceOptions();
		await loadAllData();
	});

	async function loadAllData() {
		try {
			loading = true;
			error = null;
			// Clear icon pool cache to get fresh data
			clearIconPoolCache();
			const [originsData, classesData, runesData, categoriesData, callingOrbImagesData, hexSpiritsData, iconPoolData] = await Promise.all([
				fetchOriginRecords(),
				fetchClassRecords(),
				loadRunesData(),
				fetchSpecialCategoryRecords(),
				fetchCallingOrbImages(),
				loadHexSpirits(),
				loadAllIcons()
			]);
			origins = originsData;
			classes = classesData;
			runes = runesData;
			specialCategories = categoriesData;
			callingOrbImages = callingOrbImagesData;
			hexSpirits = hexSpiritsData;
			iconPool = iconPoolData;
			void backfillMissingIcons();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadRunesData(): Promise<RuneRow[]> {
		const { data, error: fetchError } = await supabase
			.from('runes')
			.select('*')
			.order('created_at', { ascending: true });
		if (fetchError) throw fetchError;
		return data ?? [];
	}

	async function fetchCallingOrbImages(): Promise<CallingOrbImageRow[]> {
		const { data, error: fetchError } = await supabase
			.from('calling_orb_images')
			.select('*')
			.order('created_at', { ascending: false });
		if (fetchError) throw fetchError;
		return data ?? [];
	}

	async function loadHexSpirits(): Promise<HexSpiritRow[]> {
		const { data, error: fetchError } = await supabase
			.from('hex_spirits')
			.select('*')
			.order('cost', { ascending: true })
			.order('name', { ascending: true });
		if (fetchError) throw fetchError;
		return data ?? [];
	}

	async function loadDiceOptions() {
		try {
			const records = await fetchDiceRecords();
			diceOptions = records.map(({ id, name }) => ({
				id,
				name: name?.trim() || `Dice ${id.slice(0, 6)}`
			}));
			diceNameById = new Map(diceOptions.map((option) => [option.id, option.name]));
			if (showClassForm) {
				classFormData = {
					...classFormData,
					effect_schema: resolveDiceIdsInSchema(classFormData.effect_schema)
				};
			}
		} catch (err) {
			console.error('Failed to load dice options', err);
		}
	}

	// Origins handlers
	async function backfillMissingIcons(force = false) {
		if (backfillingIcons) return;

		// Backfill origins
		const originTargets = origins.filter((o) => (force || !o.icon_png) && o.icon_emoji);
		if (originTargets.length > 0) {
			backfillingIcons = true;
			for (const origin of originTargets) {
				try {
					const blob = await emojiToPngBlob(origin.icon_emoji ?? '', 512);
					if (!blob) continue;

					const sanitizedName = sanitizeFilename(origin.name);
					const filename = `${origin.id}/origin_${sanitizedName}_icon.png`;
					const path = await iconUpload.upload(blob, filename);

					if (path) {
						const { error: updateError } = await supabase
							.from('origins')
							.update({
								icon_png: path,
								icon_token_png: path,
								updated_at: new Date().toISOString()
							})
							.eq('id', origin.id);

						if (updateError) throw updateError;
					}
				} catch (err) {
					console.warn('Backfill origin icon failed for', origin.name, err);
				}
			}
		}

		// Backfill classes
		const classTargets = classes.filter((c) => (force || !c.icon_png) && c.icon_emoji);
		if (classTargets.length > 0) {
			backfillingIcons = true;
			for (const cls of classTargets) {
				try {
					const blob = await emojiToPngBlob(cls.icon_emoji ?? '', 512);
					if (!blob) continue;
					const { data, error: uploadError } = await processAndUploadImage(blob, {
						folder: `class_icons/${cls.id}`,
						filename: 'icon',
						cropTransparent: true,
						upsert: true
					});
					if (uploadError) throw uploadError;
					if (!data?.path) throw new Error('Upload failed');
					const { error: updateError } = await supabase
						.from('classes')
						.update({ icon_png: data.path, updated_at: new Date().toISOString() })
						.eq('id', cls.id);
					if (updateError) throw updateError;
				} catch (err) {
					console.warn('Backfill class icon failed for', cls.name, err);
				}
			}
		}

		backfillingIcons = false;
		if (originTargets.length > 0 || classTargets.length > 0) {
			await loadAllData();
		}
	}

	async function handleOriginIconUpload(originId: string, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be smaller than 5MB.');
			return;
		}

		const origin = origins.find((o) => o.id === originId);
		if (!origin) return;

		try {
			if (origin.icon_png) {
				await iconUpload.remove(origin.icon_png);
			}

			const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
			const sanitizedName = sanitizeFilename(origin.name);
			const filename = `${origin.id}/origin_${sanitizedName}_icon.${extension}`;
			const path = await iconUpload.upload(file, filename);

			if (path) {
				const { error: updateError } = await supabase
					.from('origins')
					.update({ icon_png: path, updated_at: new Date().toISOString() })
					.eq('id', origin.id);

				if (updateError) throw updateError;
				await loadAllData();
			} else if (iconUpload.error) {
				alert(`Failed to upload icon: ${iconUpload.error}`);
			}
		} catch (err) {
			alert(`Failed to upload icon: ${getErrorMessage(err)}`);
		}
	}

	async function removeOriginIcon(originId: string) {
		const origin = origins.find((o) => o.id === originId);
		if (!origin?.icon_png) return;

		try {
			const success = await iconUpload.remove(origin.icon_png);
			if (success) {
				const { error: updateError } = await supabase
					.from('origins')
					.update({ icon_png: null, updated_at: new Date().toISOString() })
					.eq('id', origin.id);

				if (updateError) throw updateError;
				await loadAllData();
			} else if (iconUpload.error) {
				alert(`Failed to remove icon: ${iconUpload.error}`);
			}
		} catch (err) {
			alert(`Failed to remove icon: ${getErrorMessage(err)}`);
		}
	}

	function openOriginForm(origin?: OriginRow) {
		if (origin) {
			originModal.open({ ...originRowToForm(origin), id: origin.id });
		} else {
			const nextPosition = (origins.at(-1)?.position ?? origins.length) + 1;
			originModal.open(emptyOriginForm(nextPosition));
		}
	}

	async function saveOrigin() {
		if (!originModal.formData.name.trim()) {
			alert('Origin name is required.');
			return;
		}

		try {
			await saveOriginRecord(originModal.formData);
			await loadAllData();
			originModal.close();
		} catch (err) {
			alert(`Failed to save origin: ${getErrorMessage(err)}`);
		}
	}

	async function deleteOrigin(origin: OriginRow) {
		if (!confirm(`Delete origin "${origin.name}"? This cannot be undone.`)) return;
		try {
			await deleteOriginRecord(origin.id);
			await loadAllData();
		} catch (err) {
			alert(`Failed to delete origin: ${getErrorMessage(err)}`);
		}
	}

	async function deleteOrigins(ids: string[]) {
		if (ids.length === 0) return;
		if (!confirm(`Delete ${ids.length} origin${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
		try {
			const { error: deleteError } = await supabase
				.from('origins')
				.delete()
				.in('id', ids);
			if (deleteError) throw deleteError;
			await loadAllData();
		} catch (err) {
			alert(`Failed to delete origins: ${getErrorMessage(err)}`);
		}
	}

	function submitOriginForm(event: Event) {
		event.preventDefault();
		void saveOrigin();
	}

	function handleOriginIconFileChange(originId: string, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (file) {
			handleOriginIconUpload(originId, file);
		}
	}

	// Calling orb handlers
	async function handleCallingOrbGenerate(originId: string, imageBlob: Blob) {
		try {
			// Find origin for filename
			const origin = origins.find(o => o.id === originId);
			const fileName = `calling_orb_${sanitizeFilename(origin?.name ?? originId)}`;

			// Upload to storage with transparent area cropping
			const { data, error: uploadError } = await processAndUploadImage(imageBlob, {
				folder: `calling_orbs/${originId}`,
				filename: fileName,
				cropTransparent: true,
				upsert: true
			});

			if (uploadError) throw uploadError;
			if (!data?.path) throw new Error('Upload failed');

			// Save to database (upsert to replace existing)
			const { error: dbError } = await supabase
				.from('calling_orb_images')
				.upsert({
					origin_id: originId,
					image_path: data.path,
					template_data: null,
					updated_at: new Date().toISOString()
				}, {
					onConflict: 'origin_id'
				});

			if (dbError) throw dbError;

			// Reload images
			callingOrbImages = await fetchCallingOrbImages();
		} catch (err) {
			console.error('Failed to generate calling orb:', err);
			throw err;
		}
	}

	async function handleCallingOrbDelete(imageId: string) {
		try {
			const image = callingOrbImages.find(img => img.id === imageId);
			if (!image) return;

			// Delete from storage
			if (image.image_path) {
				await supabase.storage
					.from('game_assets')
					.remove([image.image_path]);
			}

			// Delete from database
			const { error } = await supabase
				.from('calling_orb_images')
				.delete()
				.eq('id', imageId);

			if (error) throw error;

			// Reload images
			callingOrbImages = await fetchCallingOrbImages();
		} catch (err) {
			alert(`Failed to delete calling orb: ${getErrorMessage(err)}`);
		}
	}

	async function handleCallingOrbRefresh() {
		callingOrbImages = await fetchCallingOrbImages();
	}

	// Classes handlers
	function getIconUrl(iconPng: string | null | undefined): string | null {
		if (!iconPng) return null;
		const path = iconPng.startsWith('class_icons/') ? iconPng : `class_icons/${iconPng}`;
		const { data } = gameAssetsStorage.getPublicUrl(path);
		return data?.publicUrl ?? null;
	}

	function isIconImage(iconPng: string | null | undefined): boolean {
		return !!iconPng;
	}

	function sanitizeFileName(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50);
	}

	async function handleClassIconUpload(classEntry: ClassRow, file: File) {
		if (!file.type.startsWith('image/')) {
			alert('Please select an image file.');
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			alert('Image must be smaller than 5MB.');
			return;
		}

		uploadingIconId = classEntry.id;
		try {
			if (isIconImage(classEntry.icon_png)) {
				const oldPath = classEntry.icon_png!.startsWith('class_icons/')
					? classEntry.icon_png!
					: `class_icons/${classEntry.icon_png!}`;
				await gameAssetsStorage.remove([oldPath]);
			}

			const sanitizedName = sanitizeFileName(classEntry.name);
			const fileName = `class_${sanitizedName}_icon`;
			const folder = `class_icons/${classEntry.id}`;

			const { data, error: uploadError } = await processAndUploadImage(file, {
				folder,
				filename: fileName,
				cropTransparent: true,
				upsert: true
			});
			if (uploadError) {
				throw uploadError;
			}

			const { error: updateError } = await supabase
				.from('classes')
				.update({ icon_png: data?.path, updated_at: new Date().toISOString() })
				.eq('id', classEntry.id);
			if (updateError) {
				throw updateError;
			}

			await loadAllData();
		} catch (err) {
			console.error(err);
			alert('Failed to upload icon. Please try again.');
		} finally {
			uploadingIconId = null;
		}
	}

	async function removeClassIcon(classEntry: ClassRow) {
		if (!isIconImage(classEntry.icon_png)) return;
		removingIconId = classEntry.id;
		try {
			const path = classEntry.icon_png!.startsWith('class_icons/')
				? classEntry.icon_png!
				: `class_icons/${classEntry.icon_png!}`;
			await gameAssetsStorage.remove([path]);
			const { error: updateError } = await supabase
				.from('classes')
				.update({ icon_png: null, updated_at: new Date().toISOString() })
				.eq('id', classEntry.id);
			if (updateError) {
				throw updateError;
			}
			await loadAllData();
		} catch (err) {
			console.error(err);
			alert('Failed to remove icon.');
		} finally {
			removingIconId = null;
		}
	}

	function handleClassIconFileChange(classEntry: ClassRow, event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (file) {
			handleClassIconUpload(classEntry, file);
		}
	}

	function resolveDiceIdsInSchema(schema: EffectBreakpoint[]): EffectBreakpoint[] {
		return schema.map((bp) => {
			const updatedEffects = bp.effects.map((effect) => {
				if (effect.type !== 'dice') return effect;
				const typed = effect as DiceEffect;
				if (typed.dice_id && diceNameById.has(typed.dice_id)) {
					return { ...typed, dice_name: diceNameById.get(typed.dice_id) ?? typed.dice_name };
				}
				if (typed.dice_name) {
					const normalized = typed.dice_name.toLowerCase();
					const match = diceOptions.find((option) => option.name.toLowerCase() === normalized);
					if (match) {
						return { ...typed, dice_id: match.id, dice_name: match.name };
					}
				}
				return typed;
			});
			return { ...bp, effects: updatedEffects };
		});
	}

	function summarizeEffectWithScaling(className: string, effect: Effect): string {
		if (effect.type !== 'dice') {
			return summarizeEffectBase(effect);
		}

		const diceEffect = effect as DiceEffect;
		const diceLabelRaw = resolveDiceLabel(diceEffect.dice_id, diceEffect.dice_name);
		const diceLabel = (diceLabelRaw ?? diceEffect.dice_name ?? diceEffect.dice_id ?? 'Custom Dice')
			.replace(/\s+/g, ' ')
			.trim();
		const quantityValue = Number(diceEffect.quantity ?? 0);
		const quantityDisplay = Number.isFinite(quantityValue) ? Math.max(0, Math.floor(quantityValue)) : 0;
		const fallbackSummary = `${quantityDisplay}× ${diceLabel}`;

		const isSorcerer = className?.trim().toLowerCase() === sorcererName;
		if (isSorcerer) {
			return `${quantityDisplay}× ${diceLabel} × Runes`;
		}

		const baseSummary = summarizeEffectBase(effect);
		return baseSummary && baseSummary.trim().length ? baseSummary : fallbackSummary;
	}

	function openClassForm(entry?: ClassRow) {
		if (entry) {
			editingClass = entry;
			classFormData = classRowToForm(entry);
			classFormData = {
				...classFormData,
				effect_schema: resolveDiceIdsInSchema(classFormData.effect_schema)
			};
			prismaticEnabled = Boolean(classFormData.prismatic);
			prismaticCache = classFormData.prismatic
				? { ...classFormData.prismatic }
				: { ...EMPTY_PRISMATIC };
			tagsInput = classFormData.tags.join(', ');
		} else {
			editingClass = null;
			const nextPosition = (classes.at(-1)?.position ?? classes.length) + 1;
			classFormData = emptyClassForm(nextPosition);
			prismaticEnabled = false;
			prismaticCache = { ...EMPTY_PRISMATIC };
			tagsInput = '';
		}
		showClassForm = true;
	}

	function closeClassForm() {
		showClassForm = false;
	}

	function handleTagsInput(value: string) {
		tagsInput = value;
		const parsed = value
			.split(',')
			.map((tag) => tag.trim())
			.filter(Boolean);
		classFormData = { ...classFormData, tags: parsed };
	}

	function togglePrismatic(enabled: boolean) {
		prismaticEnabled = enabled;
		if (enabled) {
			const next = classFormData.prismatic ?? prismaticCache ?? { ...EMPTY_PRISMATIC };
			prismaticCache = { ...next };
			classFormData = { ...classFormData, prismatic: { ...next } };
		} else {
			prismaticCache = classFormData.prismatic ? { ...classFormData.prismatic } : prismaticCache;
			classFormData = { ...classFormData, prismatic: null };
		}
	}

	function addBreakpoint() {
		const lastCount = classFormData.effect_schema.at(-1)?.count ?? 2;
		const nextCount =
			typeof lastCount === 'number'
				? lastCount + 1
				: Number.parseInt(String(lastCount), 10) + 1 || classFormData.effect_schema.length + 2;
		const nextBreakpoint: EffectBreakpoint = {
			count: nextCount,
			color: undefined,
			description: '',
			effects: [createEffect('dice')]
		};
		classFormData = {
			...classFormData,
			effect_schema: [...classFormData.effect_schema, nextBreakpoint]
		};
	}

	function removeBreakpoint(index: number) {
		const updated = classFormData.effect_schema.filter((_, idx) => idx !== index);
		classFormData = { ...classFormData, effect_schema: updated };
	}

	function updateBreakpointCount(index: number, value: string) {
		const updated = classFormData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, count: value } : bp
		);
		classFormData = { ...classFormData, effect_schema: updated };
	}

	function updateBreakpointColor(index: number, color: EffectBreakpoint['color'] | undefined) {
		const updated = classFormData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, color: color || undefined } : bp
		);
		classFormData = { ...classFormData, effect_schema: updated };
	}

	function updateBreakpointDescription(index: number, value: string) {
		const updated = classFormData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, description: value } : bp
		);
		classFormData = { ...classFormData, effect_schema: updated };
	}

	function addEffectToBreakpoint(index: number, type: Effect['type'] = 'dice') {
		const newEffect = createEffect(type);
		const updated = classFormData.effect_schema.map((bp, idx) =>
			idx === index ? { ...bp, effects: [...bp.effects, newEffect] } : bp
		);
		classFormData = { ...classFormData, effect_schema: updated };
	}

	function removeEffectFromBreakpoint(index: number, effectIndex: number) {
		const updated = classFormData.effect_schema.map((bp, idx) => {
			if (idx !== index) return bp;
			return {
				...bp,
				effects: bp.effects.filter((_, effIdx) => effIdx !== effectIndex)
			};
		});
		classFormData = { ...classFormData, effect_schema: updated };
	}

	function updateEffectAt(
		breakpointIndex: number,
		effectIndex: number,
		transformer: (effect: Effect) => Effect
	) {
		const updated = classFormData.effect_schema.map((bp, idx) => {
			if (idx !== breakpointIndex) return bp;
			return {
				...bp,
				effects: bp.effects.map((effect, effIdx) =>
					effIdx === effectIndex ? transformer(effect) : effect
				)
			};
		});
		classFormData = { ...classFormData, effect_schema: updated };
	}

	function setEffectType(breakpointIndex: number, effectIndex: number, type: Effect['type']) {
		updateEffectAt(breakpointIndex, effectIndex, () => createEffect(type));
	}

	function updateDiceEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: DiceEffect) => DiceEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'dice' ? updater(effect) : effect
		);
	}

	function updateFlatStatEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: FlatStatEffect) => FlatStatEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'flat_stat' ? updater(effect) : effect
		);
	}

	function updateMultiplierEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: MultiplierEffect) => MultiplierEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'multiplier' ? updater(effect) : effect
		);
	}

	function updateBenefitEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: BenefitEffect) => BenefitEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'benefit' ? updater(effect) : effect
		);
	}

	function updateBackupTrimEffect(
		breakpointIndex: number,
		effectIndex: number,
		updater: (effect: BackupTrimEffect) => BackupTrimEffect
	) {
		updateEffectAt(breakpointIndex, effectIndex, (effect) =>
			effect.type === 'backup_trim' ? updater(effect) : effect
		);
	}

	async function saveClass() {
		if (!classFormData.name.trim()) {
			alert('Class name is required.');
			return;
		}

		const payload: ClassFormData = {
			...classFormData,
			tags: [...classFormData.tags],
			prismatic: prismaticEnabled ? classFormData.prismatic ?? { ...prismaticCache } : null
		};

		try {
			const saved = await saveClassRecord(payload);
			await loadAllData();
			editingClass = saved;
			closeClassForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save class: ${message}`);
		}
	}

	async function deleteClass(entry: ClassRow) {
			const categoriesUsingClass = specialCategories.filter((cat) =>
				cat.slot_1_class_ids.includes(entry.id) ||
				cat.slot_2_class_ids.includes(entry.id) ||
				cat.slot_3_class_ids.includes(entry.id)
			);

			const confirmMessage = categoriesUsingClass.length
				? `Delete class "${entry.name}"?\n\nIt will also be removed from: ${categoriesUsingClass.map((c) => c.name).join(', ')}`
				: `Delete class "${entry.name}"? Units referencing it will be orphaned.`;
			if (!confirm(confirmMessage)) return;
			try {
				if (categoriesUsingClass.length) {
					const now = new Date().toISOString();
					for (const cat of categoriesUsingClass) {
						const { error: updateError } = await supabase
							.from('special_categories')
							.update({
								slot_1_class_ids: cat.slot_1_class_ids.filter((id) => id !== entry.id),
								slot_2_class_ids: cat.slot_2_class_ids.filter((id) => id !== entry.id),
								slot_3_class_ids: cat.slot_3_class_ids.filter((id) => id !== entry.id),
								updated_at: now
							})
							.eq('id', cat.id);
						if (updateError) throw updateError;
					}
				}

				await deleteClassRecord(entry.id);
				await loadAllData();
			} catch (err) {
				alert(`Failed to delete class: ${getErrorMessage(err)}`);
			}
		}

		async function deleteClasses(ids: string[]) {
			if (ids.length === 0) return;
			const idSet = new Set(ids);
			const categoriesToUpdate = specialCategories.filter((cat) =>
				cat.slot_1_class_ids.some((id) => idSet.has(id)) ||
				cat.slot_2_class_ids.some((id) => idSet.has(id)) ||
				cat.slot_3_class_ids.some((id) => idSet.has(id))
			);

			const confirmMessage = categoriesToUpdate.length
				? `Delete ${ids.length} class${ids.length === 1 ? '' : 'es'}?\n\nThey will also be removed from: ${categoriesToUpdate.map((c) => c.name).join(', ')}`
				: `Delete ${ids.length} class${ids.length === 1 ? '' : 'es'}? Units referencing them will be orphaned.`;
			if (!confirm(confirmMessage)) return;
			try {
				if (categoriesToUpdate.length) {
					const now = new Date().toISOString();
					for (const cat of categoriesToUpdate) {
						const { error: updateError } = await supabase
							.from('special_categories')
							.update({
								slot_1_class_ids: cat.slot_1_class_ids.filter((id) => !idSet.has(id)),
								slot_2_class_ids: cat.slot_2_class_ids.filter((id) => !idSet.has(id)),
								slot_3_class_ids: cat.slot_3_class_ids.filter((id) => !idSet.has(id)),
								updated_at: now
							})
							.eq('id', cat.id);
						if (updateError) throw updateError;
					}
				}

				const { error: deleteError } = await supabase
					.from('classes')
					.delete()
					.in('id', ids);
			if (deleteError) throw deleteError;
			await loadAllData();
		} catch (err) {
			alert(`Failed to delete classes: ${getErrorMessage(err)}`);
		}
	}

	function submitClassForm(event: Event) {
		event.preventDefault();
		void saveClass();
	}

	// Special category handlers
	function openSpecialCategoryForm(category?: SpecialCategoryRow) {
		if (category) {
			editingSpecialCategory = category;
			specialCategoryFormData = specialCategoryRowToForm(category);
		} else {
			editingSpecialCategory = null;
			const nextPosition = (specialCategories.at(-1)?.position ?? specialCategories.length) + 1;
			specialCategoryFormData = emptySpecialCategoryForm(nextPosition);
		}
		showSpecialCategoryForm = true;
	}

	function closeSpecialCategoryForm() {
		showSpecialCategoryForm = false;
	}

	async function saveSpecialCategory() {
		if (!specialCategoryFormData.name.trim()) {
			alert('Special category name is required.');
			return;
		}
		try {
			await saveSpecialCategoryRecord(specialCategoryFormData);
			await loadAllData();
			closeSpecialCategoryForm();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to save special category: ${message}`);
		}
	}

	async function deleteSpecialCategory(category: SpecialCategoryRow) {
		if (!confirm(`Delete special category "${category.name}"?`)) return;
		try {
			await deleteSpecialCategoryRecord(category.id);
			await loadAllData();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			alert(`Failed to delete special category: ${message}`);
		}
	}

	function submitSpecialCategoryForm(event: Event) {
		event.preventDefault();
		void saveSpecialCategory();
	}

	function toggleClassInSlot(
		slotKey: 'slot_1_class_ids' | 'slot_2_class_ids' | 'slot_3_class_ids',
		classId: string
	) {
		const currentIds = specialCategoryFormData[slotKey];
		if (currentIds.includes(classId)) {
			specialCategoryFormData[slotKey] = currentIds.filter((id) => id !== classId);
		} else {
			specialCategoryFormData[slotKey] = [...currentIds, classId];
		}
	}

	// Runes handlers
	function openRuneForm(rune?: RuneRow) {
		if (rune) {
			const runeType: 'origin' | 'class' = rune.class_id ? 'class' : 'origin';
			runeBaseline = {
				runeType,
				origin_id: rune.origin_id ?? null,
				class_id: rune.class_id ?? null,
				icon_background_path: rune.icon_background_path ?? null
			};
			runeIconNeedsRegeneration = false;
			runeIconStatus = null;
			runeModal.open({
				...rune,
				runeType
			});
		} else {
			const originId = origins[0]?.id ?? null;
			runeBaseline = { runeType: 'origin', origin_id: originId, class_id: null, icon_background_path: null };
			runeIconNeedsRegeneration = true;
			runeIconStatus = null;
			runeModal.open({
				name: '',
				origin_id: originId,
				class_id: null,
				icon_path: null,
				icon_background_path: null,
				runeType: 'origin'
			});
			// Assign an ID for storage paths without switching into "edit" mode.
			runeModal.formData = { ...runeModal.formData, id: crypto.randomUUID() };
		}
	}

	$effect(() => {
		if (!runeModal.isOpen) return;
		if (!runeBaseline) return;

		const runeType = runeModal.formData.runeType ?? 'origin';
		const effectiveOriginId = runeType === 'origin' ? runeModal.formData.origin_id ?? null : null;
		const effectiveClassId = runeType === 'class' ? runeModal.formData.class_id ?? null : null;
		const effectiveBackgroundPath = runeModal.formData.icon_background_path ?? null;

		const baselineOriginId = runeBaseline.runeType === 'origin' ? runeBaseline.origin_id ?? null : null;
		const baselineClassId = runeBaseline.runeType === 'class' ? runeBaseline.class_id ?? null : null;
		const baselineBackgroundPath = runeBaseline.icon_background_path ?? null;

		if (
			runeType !== runeBaseline.runeType ||
			effectiveOriginId !== baselineOriginId ||
			effectiveClassId !== baselineClassId ||
			effectiveBackgroundPath !== baselineBackgroundPath
		) {
			runeIconNeedsRegeneration = true;
		}
	});

	async function handleRuneSubmit(event: Event) {
		event.preventDefault();
		await saveRune();
	}

	function dataUrlToBlob(dataUrl: string): Blob {
		const [meta, base64] = dataUrl.split(',');
		const mimeMatch = meta?.match(/data:(.*?);base64/);
		const mime = mimeMatch?.[1] ?? 'application/octet-stream';
		const bytes = Uint8Array.from(atob(base64 ?? ''), (c) => c.charCodeAt(0));
		return new Blob([bytes], { type: mime });
	}

	function resolveIconSource(input: { icon_png?: string | null; icon_emoji?: string | null } | null | undefined): {
		iconUrl: string | null;
		iconEmoji: string | null;
	} {
		if (!input) return { iconUrl: null, iconEmoji: null };

		const iconPng = input.icon_png ?? null;
		const iconEmoji = input.icon_emoji ?? null;

		// Prefer a stored PNG path if it looks like a storage path.
		if (iconPng && iconPng.includes('/')) {
			return { iconUrl: publicAssetUrl(iconPng, { updatedAt: Date.now() }), iconEmoji: null };
		}

		// Fallbacks: explicit emoji column, or legacy emoji stored in icon_png.
		if (iconEmoji && iconEmoji.trim()) return { iconUrl: null, iconEmoji: iconEmoji.trim() };
		if (iconPng && iconPng.trim()) return { iconUrl: null, iconEmoji: iconPng.trim() };

		return { iconUrl: null, iconEmoji: null };
	}

		async function saveRune() {
			const name = runeModal.formData.name?.trim() ?? '';
			if (!name) {
				alert('Rune name is required.');
				return;
			}
		if (runeModal.formData.runeType === 'origin' && !runeModal.formData.origin_id) {
			alert('Select an origin for the rune.');
			return;
		}
		if (runeModal.formData.runeType === 'class' && !runeModal.formData.class_id) {
			alert('Select a class for the rune.');
			return;
		}

		if (savingRune) return;
		savingRune = true;
		runeIconStatus = null;

		const now = new Date().toISOString();
		const runeId = runeModal.isEditing
			? runeModal.editingId!
			: (runeModal.formData.id ?? crypto.randomUUID());
			if (!runeModal.formData.id) {
				runeModal.formData = { ...runeModal.formData, id: runeId };
			}

			const payload = {
				name,
				origin_id: runeModal.formData.runeType === 'origin' ? runeModal.formData.origin_id : null,
				class_id: runeModal.formData.runeType === 'class' ? runeModal.formData.class_id : null,
				icon_background_path: runeModal.formData.icon_background_path ?? null
			};

		try {
			let saveError: string | null = null;
			if (runeModal.isEditing) {
				const { error: updateError } = await supabase
					.from('runes')
					.update({ ...payload, updated_at: now })
					.eq('id', runeId);
				saveError = updateError ? getErrorMessage(updateError) : null;
			} else {
				const { error: insertError } = await supabase.from('runes').insert({ id: runeId, ...payload });
				saveError = insertError ? getErrorMessage(insertError) : null;
			}

			if (saveError) {
				alert(`Failed to save rune: ${saveError}`);
				return;
			}

			if (runeIconNeedsRegeneration) {
				runeIconStatus = 'Generating rune icon...';

				const backgroundUrl =
					publicAssetUrl(payload.icon_background_path, { updatedAt: Date.now() }) ??
					publicAssetUrl('rune_backgrounds/background.png', { updatedAt: Date.now() });

				const source =
					runeModal.formData.runeType === 'origin'
						? resolveIconSource(origins.find((o) => o.id === payload.origin_id))
						: resolveIconSource(classes.find((c) => c.id === payload.class_id));

				const iconDataUrl = await generateRuneIcon({
					originIconUrl: source.iconUrl,
					originIconEmoji: source.iconEmoji,
					backgroundUrl,
					size: 800
				});

				const iconBlob = dataUrlToBlob(iconDataUrl);
				const { data, error: uploadError } = await processAndUploadImage(iconBlob, {
					folder: `runes/${runeId}`,
					filename: 'icon',
					cropTransparent: false,
					upsert: true
				});
				if (uploadError || !data?.path) {
					throw uploadError ?? new Error('Failed to upload rune icon.');
				}

				const { error: updateIconError } = await supabase
					.from('runes')
					.update({
						icon_path: data.path,
						icon_background_path: payload.icon_background_path,
						updated_at: now
					})
					.eq('id', runeId);
				if (updateIconError) {
					throw updateIconError;
				}

				runeIconNeedsRegeneration = false;
				runeIconStatus = '✓ Rune icon exported';
			}

			runeModal.close();
			await loadAllData();
		} catch (err) {
			alert(`Failed to export rune icon: ${getErrorMessage(err)}`);
		} finally {
			savingRune = false;
			runeIconStatus = null;
		}
	}

	async function deleteRune(rune: RuneRow) {
		if (!confirm(`Delete rune "${rune.name}"? Artifacts referencing it will break.`)) return;
		const { error: deleteError } = await supabase.from('runes').delete().eq('id', rune.id);
		if (deleteError) {
			alert(`Failed to delete rune: ${getErrorMessage(deleteError)}`);
			return;
		}
		await loadAllData();
	}

	async function deleteRunes(runesToDelete: RuneRow[]) {
		if (runesToDelete.length === 0) return;
		if (!confirm(`Delete ${runesToDelete.length} rune${runesToDelete.length === 1 ? '' : 's'}?`)) return;
		const ids = runesToDelete.map((r) => r.id);
		const { error: deleteError } = await supabase.from('runes').delete().in('id', ids);
		if (deleteError) {
			alert(`Failed to delete runes: ${getErrorMessage(deleteError)}`);
			return;
		}
		await loadAllData();
	}

	// Tab handlers
	function handleMainTabChange(tabId: string) {
		activeMainTab = tabId;
	}

	function handleOriginSubTabChange(tabId: string) {
		activeOriginSubTab = tabId;
	}

	function handleClassSubTabChange(tabId: string) {
		activeClassSubTab = tabId;
	}

	function handleRuneSubTabChange(tabId: string) {
		activeRuneSubTab = tabId;
	}

	// Get current sub-tabs based on active main tab
	const currentSubTabs = $derived(
		activeMainTab === 'origins'
			? originSubTabs
			: activeMainTab === 'classes'
				? classSubTabs
				: runeSubTabs
	);

	const currentSubTab = $derived(
		activeMainTab === 'origins'
			? activeOriginSubTab
			: activeMainTab === 'classes'
				? activeClassSubTab
				: activeRuneSubTab
	);

	function handleSubTabChange(tabId: string) {
		if (activeMainTab === 'origins') {
			handleOriginSubTabChange(tabId);
		} else if (activeMainTab === 'classes') {
			handleClassSubTabChange(tabId);
		} else {
			handleRuneSubTabChange(tabId);
		}
	}
</script>

<PageLayout
	title="Traits"
	subtitle="Origins, classes, and runes that define guardian attributes"
	tabs={mainTabs}
	activeTab={activeMainTab}
	onTabChange={handleMainTabChange}
>
	{#snippet headerActions()}
		{#if activeMainTab === 'origins'}
			<Button onclick={() => backfillMissingIcons(true)} loading={backfillingIcons}>
				{backfillingIcons ? 'Resetting PNGs…' : 'Reset PNGs'}
			</Button>
			<Button variant="primary" onclick={() => openOriginForm()}>Create Origin</Button>
		{:else if activeMainTab === 'classes'}
			<Button variant="secondary" onclick={() => backfillMissingIcons(true)} disabled={backfillingIcons}>
				{backfillingIcons ? 'Resetting PNGs…' : 'Reset PNGs'}
			</Button>
			<Button variant="secondary" onclick={() => openSpecialCategoryForm()}>Create Special</Button>
			<Button variant="primary" onclick={() => openClassForm()}>Create Class</Button>
		{:else if activeMainTab === 'runes'}
			<Button variant="primary" onclick={() => openRuneForm()}>Create Rune</Button>
		{/if}
	{/snippet}

	{#snippet tabActions()}
		{#if activeMainTab === 'origins'}
			<span class="item-count">{originFiltered.filtered.length} origins</span>
		{:else if activeMainTab === 'classes'}
			<span class="item-count">{filteredClassCount} classes, {specialCategories.length} special</span>
		{:else if activeMainTab === 'runes'}
			<span class="item-count">{runeFiltered.filtered.length} runes</span>
		{/if}
	{/snippet}

	<!-- Sub-tabs for current section -->
	<div class="sub-tabs">
		<div class="sub-tabs__bar">
			{#each currentSubTabs as tab (tab.id)}
				<button
					type="button"
					class="sub-tab"
					class:is-active={currentSubTab === tab.id}
					onclick={() => handleSubTabChange(tab.id)}
				>
					{#if tab.icon}
						<span class="sub-tab__icon">{tab.icon}</span>
					{/if}
					<span class="sub-tab__label">{tab.label}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if activeMainTab === 'origins'}
		<FilterBar
			bind:searchValue={originFiltered.searchQuery}
			searchPlaceholder="Search origins"
			filters={[]}
		/>

		{#if loading}
			<div class="loading-state">Loading origins...</div>
		{:else if error}
			<div class="error-state">Error: {error}</div>
		{:else if activeOriginSubTab === 'list'}
			<OriginsListView
				origins={originFiltered.filtered}
				onEdit={(origin) => openOriginForm(origin)}
				onDelete={(origin) => deleteOrigin(origin)}
				onDeleteMultiple={deleteOrigins}
			/>
		{:else if activeOriginSubTab === 'table'}
			<OriginsTableView
				origins={originFiltered.filtered}
				onEdit={(origin) => openOriginForm(origin)}
			/>
		{:else if activeOriginSubTab === 'calling-orb-template'}
			<CallingOrbTemplate
				{origins}
				{iconPool}
			onGenerate={handleCallingOrbGenerate}
			/>
		{:else if activeOriginSubTab === 'calling-orb-generated'}
			<CallingOrbGenerated
				{origins}
				orbImages={callingOrbImages}
				onDelete={handleCallingOrbDelete}
				onRefresh={handleCallingOrbRefresh}
			/>
		{/if}
	{:else if activeMainTab === 'classes'}
		<FilterBar
			bind:searchValue={classSearch}
			searchPlaceholder="Search classes"
			filters={[]}
			onfilterchange={() => {}}
		/>

		{#if loading}
			<div class="loading-state">Loading classes…</div>
		{:else if error}
			<div class="error-state">Error: {error}</div>
		{:else if activeClassSubTab === 'list'}
			<ClassesListView
				classes={searchFilteredClasses}
				{specialCategories}
				{diceNameById}
				onEdit={(cls) => openClassForm(cls)}
				onDelete={deleteClass}
				onDeleteMultiple={deleteClasses}
				onEditSpecial={(cat) => openSpecialCategoryForm(cat)}
				onDeleteSpecial={deleteSpecialCategory}
			/>
		{:else if activeClassSubTab === 'table'}
			<ClassesTableView
				classes={searchFilteredClasses}
				{diceNameById}
				onEdit={(cls) => openClassForm(cls)}
			/>
		{:else if activeClassSubTab === 'pdf'}
			<ClassesPdfView
				classes={classes}
				{specialCategories}
				{diceNameById}
			/>
		{/if}
	{:else if activeMainTab === 'runes'}
		<FilterBar
			bind:searchValue={runeFiltered.searchQuery}
			searchPlaceholder="Search runes"
			filters={[
				{
					key: 'origin',
					label: 'Origin',
					options: origins.map((o) => ({ value: o.id, label: o.name })),
					value: runeOriginFilter
				},
				{
					key: 'class',
					label: 'Class',
					options: classes.map((c) => ({ value: c.id, label: c.name })),
					value: runeClassFilter
				}
			]}
			onfilterchange={(key, value) => {
				if (key === 'origin') runeOriginFilter = value?.toString() ?? 'all';
				if (key === 'class') runeClassFilter = value?.toString() ?? 'all';
			}}
		/>

		{#if loading}
			<div class="loading-state">Loading runes...</div>
		{:else if error}
			<div class="error-state">Error: {error}</div>
		{:else if activeRuneSubTab === 'gallery'}
			<RunesGalleryView
				runes={runeFiltered.filtered}
				{originLookup}
				{classLookup}
				{publicUrl}
				onEdit={(rune) => openRuneForm(rune)}
				onDelete={(rune) => deleteRune(rune)}
			/>
		{:else if activeRuneSubTab === 'list'}
			<RunesListView
				runes={runeFiltered.filtered}
				{originLookup}
				{classLookup}
				onEdit={(rune) => openRuneForm(rune)}
				onDelete={(rune) => deleteRune(rune)}
				onDeleteMultiple={deleteRunes}
			/>
		{:else if activeRuneSubTab === 'table'}
			<RunesTableView
				runes={runeFiltered.filtered}
				{originLookup}
				{classLookup}
				onEdit={(rune) => openRuneForm(rune)}
			/>
		{:else if activeRuneSubTab === 'json'}
			<RunesJsonView
				runes={runeFiltered.filtered}
				{originLookup}
				{classLookup}
				{publicUrl}
			/>
		{/if}
	{/if}
</PageLayout>

<!-- Origins Modal -->
<Modal bind:open={originModal.isOpen} title={originModal.isEditing ? 'Edit Origin' : 'Create Origin'} size="md">
	<form id="origin-editor-form" class="origin-form" onsubmit={submitOriginForm}>
		<FormField label="Name" required>
			<Input type="text" bind:value={originModal.formData.name} required />
		</FormField>

		<FormField label="Position">
			<Input type="number" bind:value={originModal.formData.position} />
		</FormField>

		<FormField label="Icon Emoji">
			<Input type="text" bind:value={originModal.formData.icon_emoji} placeholder="e.g. 🌊" />
		</FormField>

		<FormField label="Icon PNG" helperText="Upload icon to storage">
			<div class="icon-preview-row">
				{#if formIconPreview}
					<img class="origin-form__icon-image" src={formIconPreview} alt="Origin icon preview" />
				{:else if originModal.formData.icon_emoji}
					<span class="origin-form__icon-emoji">{originModal.formData.icon_emoji}</span>
				{:else}
					<span class="origin-form__icon-placeholder">No icon yet</span>
				{/if}
			</div>
			<div class="icon-actions-row">
				<label class="upload-button">
					<input
						type="file"
						accept="image/*"
						onchange={(event) => {
							const id = originModal.formData.id ?? crypto.randomUUID();
							handleOriginIconFileChange(id, event);
						}}
					/>
					<span>{iconUpload.isUploading ? 'Uploading…' : 'Upload Icon'}</span>
				</label>
				{#if originModal.formData.icon_png && originModal.formData.id}
					<Button
						variant="danger"
						size="sm"
						onclick={() => {
							if (originModal.formData.id) {
								removeOriginIcon(originModal.formData.id);
							}
						}}
					>
						Remove Icon
					</Button>
				{/if}
			</div>
			{#if originModal.formData.icon_png}
				<small class="path-display">Path: {originModal.formData.icon_png}</small>
			{/if}
		</FormField>

		<FormField label="Color">
			<Input type="color" bind:value={originModal.formData.color} />
		</FormField>

		<FormField label="Description">
			<Textarea rows={3} bind:value={originModal.formData.description} />
		</FormField>

		<FormField label="Calling Card">
			<CallingCardEditor
			bind:callingCard={originModal.formData.calling_card}
			{hexSpirits}
			{iconPool}
		/>
		</FormField>
	</form>

	{#snippet footer()}
		<Button variant="primary" type="submit" form="origin-editor-form">Save</Button>
		<Button onclick={originModal.close}>Cancel</Button>
	{/snippet}
</Modal>

<!-- Classes Modal (large form with EditorModal) -->
{#if showClassForm}
	<EditorModal
		title={editingClass ? 'Edit Class' : 'Create Class'}
		description="Update core class info, tags, prismatic bonus, and breakpoint effects."
		size="lg"
		on:close={closeClassForm}
	>
		<form id="class-editor-form" class="class-form" onsubmit={submitClassForm}>
			<section class="class-form__grid">
				<label>
					Name
					<input type="text" bind:value={classFormData.name} required />
				</label>
				<label>
					Position
					<input type="number" min="1" bind:value={classFormData.position} />
				</label>
				<label>
					Icon Emoji
					<input type="text" bind:value={classFormData.icon_emoji} placeholder="e.g. 🛡️" />
				</label>
				<label>
					Color
					<input type="color" bind:value={classFormData.color} />
				</label>
			</section>

			<section class="icon-manager">
				<h3>Class Icon</h3>
				<div class="icon-preview">
					{#if getIconUrl(classFormData.icon_png)}
						<img
							class="icon-preview__image"
							src={getIconUrl(classFormData.icon_png)}
							alt={`${classFormData.name} icon`}
						/>
					{:else if classFormData.icon_emoji}
						<span class="icon-preview__emoji">{classFormData.icon_emoji}</span>
					{:else}
						<span class="icon-preview__placeholder">No icon yet</span>
					{/if}
				</div>
				{#if classFormData.icon_png}
					<small class="icon-path">Current path: {classFormData.icon_png}</small>
				{/if}
				<div class="icon-actions">
					<label class="upload-button">
						<input
							type="file"
							accept="image/*"
							onchange={(event) =>
								handleClassIconFileChange(
									(editingClass as any) ?? {
										id: (classFormData as any).id ?? crypto.randomUUID(),
										...(classFormData as any)
									},
									event
								)}
							aria-label={`Upload icon for ${classFormData.name}`}
						/>
						<span>{uploadingIconId ? 'Uploading…' : 'Upload Icon'}</span>
					</label>
					<button
						class="btn danger"
						type="button"
						onclick={() =>
							removeClassIcon(
								(editingClass as any) ?? {
									id: (classFormData as any).id ?? crypto.randomUUID(),
									...(classFormData as any)
								}
							)}
						disabled={removingIconId !== null || !isIconImage(classFormData.icon_png)}
					>
						{removingIconId ? 'Removing…' : 'Remove Icon'}
					</button>
				</div>
			</section>

			<label class="span-full">
				Description
				<textarea rows="3" bind:value={classFormData.description}></textarea>
			</label>

			<label class="span-full">
				Footer
				<textarea rows="2" bind:value={classFormData.footer}></textarea>
			</label>

			<label class="span-full">
				Tags
				<input
					type="text"
					placeholder="comma separated tags"
					bind:value={tagsInput}
					oninput={(event) => handleTagsInput(event.currentTarget.value)}
				/>
			</label>

			<section class="prismatic-editor">
				<header>
					<h3>Prismatic Bonus</h3>
					<label class="switch">
						<input
							type="checkbox"
							checked={prismaticEnabled}
							onchange={(event) => togglePrismatic(event.currentTarget.checked)}
						/>
						<span>Enable</span>
					</label>
				</header>

				{#if prismaticEnabled}
					<div class="prismatic-fields">
						<label>
							Name
							<input
								type="text"
								value={classFormData.prismatic?.name ?? ''}
								oninput={(event) => {
									const next = classFormData.prismatic ?? { ...EMPTY_PRISMATIC };
									next.name = event.currentTarget.value;
									prismaticCache = { ...next };
									classFormData = { ...classFormData, prismatic: { ...next } };
								}}
							/>
						</label>
						<label>
							Count
							<input
								type="text"
								value={classFormData.prismatic?.count ?? ''}
								oninput={(event) => {
									const next = classFormData.prismatic ?? { ...EMPTY_PRISMATIC };
									next.count = event.currentTarget.value;
									prismaticCache = { ...next };
									classFormData = { ...classFormData, prismatic: { ...next } };
								}}
							/>
						</label>
						<label class="prismatic-description">
							Description
							<textarea
								rows="3"
								value={classFormData.prismatic?.description ?? ''}
								oninput={(event) => {
									const next = classFormData.prismatic ?? { ...EMPTY_PRISMATIC };
									next.description = event.currentTarget.value;
									prismaticCache = { ...next };
									classFormData = { ...classFormData, prismatic: { ...next } };
								}}
							></textarea>
						</label>
					</div>
				{:else}
					<p class="prismatic-disabled">Enable to configure prismatic bonuses.</p>
				{/if}
			</section>

			<section class="breakpoint-editor">
				<header class="breakpoint-editor__header">
					<h3>Breakpoints</h3>
					<button class="btn" type="button" onclick={addBreakpoint}>Add Breakpoint</button>
				</header>

				{#if classFormData.effect_schema.length === 0}
					<p class="muted">No breakpoints defined yet.</p>
				{:else}
					{#each classFormData.effect_schema as breakpoint, index (index)}
						<article class="breakpoint-card">
							<header class="breakpoint-card__header">
								<label>
									Count
									<input
										type="text"
										value={breakpoint.count}
										oninput={(event) => updateBreakpointCount(index, event.currentTarget.value)}
									/>
								</label>
								<label>
									Color
									<select
										value={breakpoint.color ?? ''}
										onchange={(event) =>
											updateBreakpointColor(
												index,
												(event.currentTarget.value || undefined) as EffectBreakpoint['color']
											)}
									>
										<option value="">Default</option>
										<option value="bronze">Bronze</option>
										<option value="silver">Silver</option>
										<option value="gold">Gold</option>
										<option value="prismatic">Prismatic</option>
									</select>
								</label>
								<button class="icon-btn danger" type="button" onclick={() => removeBreakpoint(index)}>
									🗑️
								</button>
							</header>

							<label>
								Description
								<textarea
									rows="2"
									value={breakpoint.description ?? ''}
									oninput={(event) => updateBreakpointDescription(index, event.currentTarget.value)}
								></textarea>
							</label>

							<section class="effects">
								<header class="effects__header">
									<h4>Effects</h4>
									<div class="effect-buttons">
										{#each effectTypes as type (type)}
											<button
												type="button"
												class="btn"
												onclick={() => addEffectToBreakpoint(index, type)}
											>
												Add {type.replace('_', ' ')}
											</button>
										{/each}
									</div>
								</header>

								{#if breakpoint.effects.length === 0}
									<p class="muted">No effects yet.</p>
								{:else}
									<ul class="effects__list">
										{#each breakpoint.effects as effect, effectIndex (`${index}-${effectIndex}`)}
											<li class="effect-row">
												<header class="effect-row__header">
													<select
														value={effect.type}
														onchange={(event) =>
															setEffectType(index, effectIndex, event.currentTarget.value as Effect['type'])}
													>
														{#each effectTypes as type (type)}
															<option value={type}>{type.replace('_', ' ')}</option>
														{/each}
													</select>
													<button
														type="button"
														class="icon-btn danger"
														onclick={() => removeEffectFromBreakpoint(index, effectIndex)}
													>
														🗑️
													</button>
												</header>
												<p class="effect-row__summary">
													{summarizeEffectWithScaling(classFormData.name ?? '', effect)}
												</p>

												{#if effect.type === 'dice'}
													<section class="effect-body effect-body--dice">
														<label>
															Custom Dice
															<select
																value={effect.dice_id ?? ''}
																onchange={(event) =>
																	updateDiceEffect(index, effectIndex, (current) => ({
																		...current,
																		dice_id: event.currentTarget.value
																			? event.currentTarget.value
																			: null,
																		dice_name: event.currentTarget.value
																			? diceNameById.get(event.currentTarget.value) ??
																				current.dice_name ??
																				''
																			: current.dice_name ?? ''
																	}))}
															>
																<option value="">Select dice</option>
																{#each diceOptions as option}
																	<option value={option.id}>{option.name}</option>
																{/each}
															</select>
														</label>
														{#if !diceOptions.length}
															<p class="muted span-full">Create custom dice to reference them here.</p>
														{/if}
														<label>
															Quantity
															<input
																type="number"
																min="1"
																value={effect.quantity}
																oninput={(event) =>
																	updateDiceEffect(index, effectIndex, (current) => ({
																		...current,
																		quantity: Number(event.currentTarget.value)
																	}))}
															/>
														</label>
														{#if !effect.dice_id}
															<label class="span-full">
																Legacy label
																<input
																	type="text"
																	value={effect.dice_name ?? ''}
																	oninput={(event) =>
																		updateDiceEffect(index, effectIndex, (current) => ({
																			...current,
																			dice_name: event.currentTarget.value
																		}))}
																/>
															</label>
														{/if}
														{#if (classFormData.name ?? '').trim().toLowerCase() === sorcererName}
															<p class="effect-body__note span-full">
																Preview: {summarizeEffectWithScaling(classFormData.name ?? '', effect)}.
																Rune count multiplies the dice quantity during gameplay.
															</p>
														{/if}
													</section>
												{:else if effect.type === 'flat_stat'}
													<section class="effect-body">
														<label>
															Stat
															<select
																value={effect.stat}
																onchange={(event) =>
																	updateFlatStatEffect(index, effectIndex, (current) => ({
																		...current,
																		stat: event.currentTarget.value as FlatStatEffect['stat']
																	}))}
															>
																<option value="attack">Attack</option>
																<option value="defense">Defense</option>
															</select>
														</label>
														<label>
															Value
															<input
																type="number"
																value={effect.value}
																oninput={(event) =>
																	updateFlatStatEffect(index, effectIndex, (current) => ({
																		...current,
																		value: Number(event.currentTarget.value)
																	}))}
															/>
														</label>
														<label>
															Condition
															<input
																type="text"
																value={effect.condition ?? ''}
																oninput={(event) =>
																	updateFlatStatEffect(index, effectIndex, (current) => ({
																		...current,
																		condition: event.currentTarget.value
																	}))}
															/>
														</label>
													</section>
												{:else if effect.type === 'multiplier'}
													<section class="effect-body">
														<label>
															Stat
															<select
																value={effect.stat}
																onchange={(event) =>
																	updateMultiplierEffect(index, effectIndex, (current) => ({
																		...current,
																		stat: event.currentTarget.value as MultiplierEffect['stat']
																	}))}
															>
																<option value="attack">Attack</option>
																<option value="defense">Defense</option>
															</select>
														</label>
														<label>
															Multiplier
															<input
																type="number"
																min="0"
																step="0.1"
																value={effect.value}
																oninput={(event) =>
																	updateMultiplierEffect(index, effectIndex, (current) => ({
																		...current,
																		value: Number(event.currentTarget.value)
																	}))}
															/>
														</label>
													</section>
												{:else if effect.type === 'benefit'}
													<section class="effect-body">
														<label>
															Description
															<textarea
																rows="2"
																value={effect.description}
																oninput={(event) =>
																	updateBenefitEffect(index, effectIndex, (current) => ({
																		...current,
																		description: event.currentTarget.value
																	}))}
															></textarea>
														</label>
														<label>
															Value
															<input
																type="number"
																step="0.1"
																value={effect.value ?? ''}
																oninput={(event) =>
																	updateBenefitEffect(index, effectIndex, (current) => ({
																		...current,
																		value: event.currentTarget.value
																			? Number(event.currentTarget.value)
																			: undefined
																	}))}
															/>
														</label>
														<label>
															Type
															<input
																type="text"
																value={effect.benefit_type ?? ''}
																oninput={(event) =>
																	updateBenefitEffect(index, effectIndex, (current) => ({
																		...current,
																		benefit_type: event.currentTarget.value || undefined
																	}))}
															/>
														</label>
													</section>
												{:else if effect.type === 'backup_trim'}
													<section class="effect-body">
														<label>
															Remove Dice
															<input
																type="number"
																min="0"
																value={effect.value}
																oninput={(event) =>
																	updateBackupTrimEffect(index, effectIndex, (current) => ({
																		...current,
																		value: Number(event.currentTarget.value)
																	}))}
															/>
														</label>
													</section>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}
							</section>
						</article>
					{/each}
				{/if}
			</section>
		</form>

		<div slot="footer" class="modal-footer-actions">
			<button class="btn btn--primary" type="submit" form="class-editor-form">Save</button>
			<button class="btn" type="button" onclick={closeClassForm}>Cancel</button>
		</div>
	</EditorModal>
{/if}

<!-- Special Category Modal -->
{#if showSpecialCategoryForm}
	<EditorModal
		title={editingSpecialCategory ? 'Edit Special Category' : 'Create Special Category'}
		description="A special category card displays 3 slots, each containing multiple classes."
		size="lg"
		on:close={closeSpecialCategoryForm}
	>
		<form
			id="special-category-form"
			class="special-category-form"
			onsubmit={submitSpecialCategoryForm}
		>
			<div class="special-category-form__grid">
				<label>
					Name
					<input type="text" bind:value={specialCategoryFormData.name} required />
				</label>
				<label>
					Icon Emoji
					<input type="text" bind:value={specialCategoryFormData.icon_emoji} placeholder="e.g. ⚡" />
				</label>
				<label>
					Color
					<input type="color" bind:value={specialCategoryFormData.color} />
				</label>
				<label>
					Position
					<input type="number" min="0" bind:value={specialCategoryFormData.position} />
				</label>
			</div>

			<label class="span-full">
				Description
				<textarea rows="2" bind:value={specialCategoryFormData.description}></textarea>
			</label>

			<div class="slot-editors">
				{#each [
					{ key: 'slot_1_class_ids' as const, label: 'Slot 1' },
					{ key: 'slot_2_class_ids' as const, label: 'Slot 2' },
					{ key: 'slot_3_class_ids' as const, label: 'Slot 3' }
				] as slot}
					<fieldset class="slot-fieldset">
						<legend>{slot.label}</legend>
						<div class="slot-class-grid">
							{#each classes as cls (cls.id)}
								<label class="slot-class-checkbox">
									<input
										type="checkbox"
										checked={specialCategoryFormData[slot.key].includes(cls.id)}
										onchange={() => toggleClassInSlot(slot.key, cls.id)}
									/>
									<span class="slot-class-label" style="border-color: {cls.color ?? '#8b5cf6'}">
										{cls.icon_emoji ?? '🛡️'} {cls.name}
									</span>
								</label>
							{/each}
						</div>
					</fieldset>
				{/each}
			</div>
		</form>

		<div slot="footer" class="modal-footer-actions">
			<button class="btn btn--primary" type="submit" form="special-category-form">Save</button>
			<button class="btn" type="button" onclick={closeSpecialCategoryForm}>Cancel</button>
		</div>
	</EditorModal>
{/if}

<!-- Runes Modal -->
	<Modal bind:open={runeModal.isOpen} title={runeModal.isEditing ? 'Edit Rune' : 'Create Rune'}>
		<form onsubmit={handleRuneSubmit}>
			<FormField label="Name" required>
				<Input bind:value={runeModal.formData.name} placeholder="Enter rune name" required />
			</FormField>

		<fieldset class="rune-type-fieldset">
			<legend>Rune Type</legend>
			<div class="rune-type-options">
				<label class="rune-type-option">
					<input type="radio" bind:group={runeModal.formData.runeType} value="origin" />
					Origin
				</label>
				<label class="rune-type-option">
					<input type="radio" bind:group={runeModal.formData.runeType} value="class" />
					Class
				</label>
			</div>
		</fieldset>

		{#if runeModal.formData.runeType === 'origin'}
			<FormField label="Origin" required>
				<Select
					bind:value={runeModal.formData.origin_id}
					options={[
						{ value: '', label: 'Select an origin' },
						...origins.map((o) => ({ value: o.id, label: o.name }))
					]}
					required
				/>
			</FormField>
			{:else}
				<FormField label="Class" required>
					<Select
						bind:value={runeModal.formData.class_id}
					options={[
						{ value: '', label: 'Select a class' },
						...classes.map((c) => ({ value: c.id, label: c.name }))
					]}
					required
				/>
				</FormField>
			{/if}

			<div class="rune-icon-settings">
				<FormField label="Icon Background (optional)">
					<ImageUploader
						bind:value={runeModal.formData.icon_background_path}
						folder={`rune_backgrounds/${runeModal.formData.id ?? 'unassigned'}`}
						cropTransparent={false}
						aspectRatio="1 / 1"
						onupload={() => {
							runeIconNeedsRegeneration = true;
						}}
						onerror={(message) => alert(message)}
					/>
					<div class="rune-icon-hint">
						{#if runeIconNeedsRegeneration}
							<span class="rune-icon-hint__dirty">Icon will regenerate on save.</span>
						{:else}
							<span>Icon is up to date.</span>
						{/if}
						{#if runeIconStatus}
							<span class="rune-icon-hint__status">{runeIconStatus}</span>
						{/if}
					</div>
				</FormField>

				<div class="rune-icon-preview">
					{#if runeModal.formData.icon_path}
						{@const iconPreviewUrl = publicAssetUrl(runeModal.formData.icon_path, { updatedAt: runeModal.formData.updated_at ?? Date.now() })}
						{#if iconPreviewUrl}
							<img src={iconPreviewUrl} alt="Rune icon preview" />
						{:else}
							<div class="rune-icon-preview__empty">No exported icon</div>
						{/if}
					{:else}
						<div class="rune-icon-preview__empty">No exported icon</div>
					{/if}
				</div>
			</div>

			<div class="modal__actions">
				<Button variant="primary" type="submit" loading={savingRune}>
					{runeIconNeedsRegeneration ? 'Save & Export' : 'Save'}
				</Button>
				<Button variant="ghost" type="button" onclick={() => runeModal.close()} disabled={savingRune}>
					Cancel
				</Button>
			</div>
		</form>
	</Modal>

<style>
	.item-count {
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

	/* Sub-tabs styling */
	.sub-tabs {
		background: rgba(15, 23, 42, 0.3);
		border-bottom: 1px solid rgba(148, 163, 184, 0.08);
		padding: 0 0.5rem;
	}

	.sub-tabs__bar {
		display: flex;
		gap: 2px;
	}

	.sub-tab {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.3rem 0.6rem;
		border: none;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: #64748b;
		font-size: 0.7rem;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.1s, color 0.1s;
		white-space: nowrap;
	}

	.sub-tab:hover:not(.is-active) {
		background: rgba(51, 65, 85, 0.3);
		color: #94a3b8;
	}

	.sub-tab.is-active {
		background: rgba(51, 65, 85, 0.5);
		color: #f1f5f9;
	}

	.sub-tab__icon {
		font-size: 0.8rem;
		line-height: 1;
	}

	.sub-tab__label {
		letter-spacing: 0.01em;
	}

	/* Origin form styles */
	.origin-form {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.4rem;
	}

	.origin-form :global(> *:nth-child(n + 5)) {
		grid-column: 1 / -1;
	}

	.origin-form__icon-image {
		width: 48px;
		height: 48px;
		object-fit: contain;
		border-radius: 6px;
		background: rgba(148, 163, 184, 0.12);
		padding: 4px;
	}

	.origin-form__icon-emoji {
		font-size: 2.4rem;
	}

	.origin-form__icon-placeholder {
		font-size: 0.9rem;
		color: #94a3b8;
	}

	.icon-preview-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0.35rem 0;
	}

	.path-display {
		font-size: 0.7rem;
		color: #94a3b8;
		margin-top: 0.25rem;
		display: block;
	}

	.icon-actions-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.5rem;
	}

	.icon-actions-row .upload-button {
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}

	.icon-actions-row .upload-button input[type='file'] {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	.icon-actions-row .upload-button span {
		display: inline-block;
		padding: 0.35rem 0.6rem;
		background: rgba(59, 130, 246, 0.3);
		border: 1px solid rgba(59, 130, 246, 0.5);
		border-radius: 6px;
		color: #93c5fd;
		font-size: 0.75rem;
		transition: opacity 0.15s ease;
	}

	.icon-actions-row .upload-button:hover span {
		background: rgba(59, 130, 246, 0.4);
		border-color: rgba(59, 130, 246, 0.7);
	}

	/* Class form styles */
	.class-form {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.class-form__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
		gap: 0.6rem;
	}

	.class-form .span-full {
		grid-column: 1 / -1;
		width: 100%;
	}

	.prismatic-editor {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		border: 1px solid rgba(124, 58, 237, 0.35);
		background: rgba(19, 26, 46, 0.82);
		border-radius: 10px;
		padding: 0.65rem;
	}

	.prismatic-editor header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
		font-weight: 600;
		letter-spacing: 0.01em;
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
	}

	.switch input {
		transform: scale(1.05);
	}

	.prismatic-fields {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 0.6rem;
	}

	.prismatic-description {
		grid-column: 1 / -1;
	}

	.prismatic-disabled {
		margin: 0;
		color: #9ca3c9;
		font-style: italic;
	}

	.breakpoint-editor {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.breakpoint-editor__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.6rem;
	}

	.breakpoint-editor__header h3 {
		margin: 0;
		font-size: 1.05rem;
	}

	.breakpoint-editor__header .btn {
		padding: 0.32rem 0.6rem;
		font-size: 0.85rem;
	}

	.breakpoint-card {
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(18, 24, 42, 0.85);
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0.65rem;
	}

	.breakpoint-card__header {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 0.5rem;
		align-items: end;
	}

	.effects {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effects__header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 0.45rem;
	}

	.effects__header h4 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 600;
	}

	.effect-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.effect-buttons .btn {
		padding: 0.28rem 0.55rem;
		font-size: 0.8rem;
	}

	.effects__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-row {
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		background: rgba(27, 35, 56, 0.82);
		padding: 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-row__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.effect-row__header select {
		min-width: 140px;
	}

	.effect-row__header .icon-btn {
		padding: 0.22rem 0.45rem;
	}

	.effect-row__summary {
		margin: 0;
		font-size: 0.85rem;
		color: #cbd5f5;
	}

	.effect-body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.effect-body--dice {
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
	}

	.effect-body--dice .span-full {
		grid-column: 1 / -1;
	}

	.effect-body__note {
		margin: 0;
		font-size: 0.8rem;
		color: #a5b4fc;
		background: rgba(99, 102, 241, 0.12);
		border: 1px solid rgba(99, 102, 241, 0.25);
		border-radius: 6px;
		padding: 0.35rem 0.55rem;
	}

	.muted {
		color: #94a3b8;
		font-style: italic;
		font-size: 0.85rem;
	}

	/* Special category form */
	.special-category-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.special-category-form__grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.75rem;
	}

	.slot-editors {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.slot-fieldset {
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 0.75rem;
	}

	.slot-fieldset legend {
		padding: 0 0.5rem;
		font-weight: 600;
		color: #e2e8f0;
		font-size: 0.9rem;
	}

	.slot-class-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.slot-class-checkbox {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.slot-class-checkbox input {
		margin: 0;
	}

	.slot-class-label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: rgba(51, 65, 85, 0.4);
		border: 1px solid;
		border-radius: 5px;
		font-size: 0.8rem;
		color: #cbd5e1;
	}

	/* Rune form styles */
	.rune-type-fieldset {
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 8px;
		padding: 0.75rem 1rem;
		margin: 0.5rem 0;
	}

	.rune-type-fieldset legend {
		padding: 0 0.5rem;
		font-weight: 500;
		color: #e2e8f0;
	}

	.rune-type-options {
		display: flex;
		gap: 1.5rem;
	}

	.rune-type-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.rune-type-option input[type='radio'] {
		margin: 0;
	}

		.modal__actions {
			display: flex;
			gap: 0.6rem;
			justify-content: flex-end;
			margin-top: 1rem;
		}

		.rune-icon-settings {
			display: grid;
			grid-template-columns: 1fr 140px;
			gap: 1rem;
			align-items: start;
			margin-top: 0.75rem;
		}

		.rune-icon-preview {
			width: 140px;
			height: 140px;
			border-radius: 12px;
			border: 1px solid rgba(148, 163, 184, 0.18);
			background: rgba(15, 23, 42, 0.35);
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
		}

		.rune-icon-preview img {
			width: 100%;
			height: 100%;
			object-fit: contain;
		}

		.rune-icon-preview__empty {
			font-size: 0.7rem;
			color: rgba(148, 163, 184, 0.7);
			text-align: center;
			padding: 0.5rem;
		}

		.rune-icon-hint {
			margin-top: 0.5rem;
			font-size: 0.7rem;
			color: rgba(148, 163, 184, 0.8);
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		.rune-icon-hint__dirty {
			color: rgba(251, 191, 36, 0.9);
		}

		.rune-icon-hint__status {
			color: rgba(148, 163, 184, 0.9);
		}

		.modal-footer-actions {
			display: flex;
			gap: 0.6rem;
			justify-content: flex-end;
	}

	@media (max-width: 640px) {
		.sub-tabs__bar {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
		}

		.sub-tab__label {
			display: none;
		}

		.sub-tab {
			padding: 0.3rem 0.45rem;
		}

		.sub-tab__icon {
			font-size: 0.9rem;
		}
	}
</style>
