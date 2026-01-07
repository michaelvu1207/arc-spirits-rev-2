<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type {
		ArtifactRow,
		OriginRow,
		RuneRow,
		GuardianRow,
		ArtifactTagRow,
		ArtifactTemplateRow
	} from '$lib/types/gameData';
	import { artifactService, type ArtifactTemplateConfig, type GeneratedArtifactPreview } from '$lib/services/artifactService';
	import { generateArtifactCardPNG } from '$lib/generators/cards';
	import ArtifactEditorDrawer from '$lib/components/artifacts/ArtifactEditorDrawer.svelte';
	import TagManager from '$lib/components/artifacts/TagManager.svelte';
	import ArtifactCardGallery from '$lib/components/artifacts/ArtifactCardGallery.svelte';
	import ArtifactCardEditor from '$lib/components/artifacts/ArtifactCardEditor.svelte';
	import { ArtifactsListView, ArtifactsTableView, ArtifactsGridView } from '$lib/components/artifacts';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button, Input, Select } from '$lib/components/ui';
	import { ConfirmDialog, FilterBar } from '$lib/components/shared';
	import { normalizeTranslationRecord } from '$lib/features/artifacts/artifactTranslations';
	import { getErrorMessage } from '$lib/utils';
	import { processAndUploadImage } from '$lib/utils/storage';
	import { useLookup } from '$lib/composables';

	// Data
	let artifacts = $state<ArtifactRow[]>([]);
	let origins = $state<OriginRow[]>([]);
	let runes = $state<RuneRow[]>([]);
	let guardians = $state<Pick<GuardianRow, 'id' | 'name' | 'name_translations'>[]>([]);
	let tags = $state<ArtifactTagRow[]>([]);
	let templates = $state<ArtifactTemplateRow[]>([]);

	// Lookups for efficient ID → name mapping
	const tagLookup = useLookup(() => tags);
	const guardiansForArtifactLanguage = $derived.by(() =>
		guardians.map((guardian) => ({
			id: guardian.id,
			name:
				artifactLanguage === BASE_LANGUAGE
					? guardian.name
					: getTranslationValue(guardian.name_translations, artifactLanguage) ?? guardian.name
		}))
	);

	const guardianLookup = useLookup(() => guardiansForArtifactLanguage);
	const runeLookup = useLookup(() => runes);

	// Tab state
	const tabs: Tab[] = [
		{ id: 'list', label: 'Data: List', icon: '📋' },
		{ id: 'table', label: 'Data: Table', icon: '📊' },
		{ id: 'generator', label: 'Generator', icon: '⚙️' },
		{ id: 'gallery', label: 'Card Gallery', icon: '🖼️' }
	];
	let activeTab = $state('list');

	// UI State
	let isEditorOpen = $state(false);
	let isTagManagerOpen = $state(false);
	let isGalleryOpen = $state(false);
	let isCardEditorOpen = $state(false);
	let editingArtifact = $state<Partial<ArtifactRow>>({});
	let loading = $state(true);

	// Confirm dialog state
	let confirmOpen = $state(false);
	let confirmMessage = $state('');
	let confirmAction = $state<(() => void) | null>(null);

	// Filters
	let search = $state('');
	let tagFilter = $state<string[]>([]);

	type ArtifactLanguage = 'base' | string;
	const BASE_LANGUAGE: ArtifactLanguage = 'base';

	let artifactLanguage = $state<ArtifactLanguage>(BASE_LANGUAGE);
	let artifactLanguageSelect = $state<ArtifactLanguage>(BASE_LANGUAGE);
	let newArtifactLanguageDraft = $state('');
	let extraArtifactLanguages = $state<string[]>([]);

	function normalizeOptionalText(value: string | null | undefined): string | null {
		const trimmed = (value ?? '').trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	function normalizeLanguageCode(value: string): string {
		return value.trim().replace(/_/g, '-').toLowerCase();
	}

	function getTranslationValue(input: unknown, lang: string): string | null {
		if (!lang || lang === BASE_LANGUAGE) return null;
		if (!input || typeof input !== 'object') return null;
		const record = input as Record<string, unknown>;
		const direct = record[lang];
		if (typeof direct === 'string') return normalizeOptionalText(direct);
		for (const [key, value] of Object.entries(record)) {
			if (normalizeLanguageCode(key) !== lang) continue;
			if (typeof value !== 'string') continue;
			return normalizeOptionalText(value);
		}
		return null;
	}

	function getArtifactName(artifact: ArtifactRow, lang: ArtifactLanguage = artifactLanguage): string {
		if (lang === BASE_LANGUAGE) return artifact.name;
		return getTranslationValue(artifact.name_translations, lang) ?? artifact.name;
	}

	function getArtifactBenefit(artifact: ArtifactRow, lang: ArtifactLanguage = artifactLanguage): string {
		if (lang === BASE_LANGUAGE) return artifact.benefit ?? '';
		return getTranslationValue(artifact.benefit_translations, lang) ?? artifact.benefit ?? '';
	}

	function getArtifactCardImagePath(artifact: ArtifactRow, lang: ArtifactLanguage = artifactLanguage): string | null {
		if (lang === BASE_LANGUAGE) return artifact.card_image_path ?? null;
		return getTranslationValue(artifact.card_image_path_translations, lang) ?? null;
	}

	function sanitizeLanguageForPath(lang: ArtifactLanguage): string {
		if (lang === BASE_LANGUAGE) return BASE_LANGUAGE;
		return lang.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
	}

	const BASE_STORAGE_LANG = 'en';

	function getArtifactCardFolderForLanguage(lang: ArtifactLanguage): string {
		const safeLang = lang === BASE_LANGUAGE ? BASE_STORAGE_LANG : sanitizeLanguageForPath(lang);
		return `card_images/artifacts/${safeLang || BASE_STORAGE_LANG}`;
	}

	function ensureLanguageListed(lang: string) {
		if (!lang || lang === BASE_LANGUAGE) return;
		if (!extraArtifactLanguages.includes(lang)) extraArtifactLanguages = [...extraArtifactLanguages, lang];
	}

	const detectedArtifactLanguages = $derived.by(() => {
		const out = new Set<string>();
		for (const artifact of artifacts) {
			const sources = [
				artifact.name_translations,
				artifact.benefit_translations,
				artifact.card_image_path_translations
			];
			for (const source of sources) {
				if (!source || typeof source !== "object") continue;
				for (const key of Object.keys(source as Record<string, unknown>)) {
					const normalized = normalizeLanguageCode(key);
					if (!normalized) continue;
					out.add(normalized);
				}
			}
		}
		return Array.from(out).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	});

	const artifactLanguageOptions = $derived.by(() => {
		const merged = new Set<string>([...detectedArtifactLanguages, ...extraArtifactLanguages]);
		const langs = Array.from(merged).filter((l) => l && l !== BASE_LANGUAGE);
		langs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		return [{ value: BASE_LANGUAGE, label: 'Default' }, ...langs.map((l) => ({ value: l, label: l }))];
	});

	$effect(() => {
		if (artifactLanguageSelect !== artifactLanguage) {
			requestArtifactLanguageChange(String(artifactLanguageSelect));
		}
	});

	function requestArtifactLanguageChange(nextRaw: string) {
		const normalized = nextRaw === BASE_LANGUAGE ? BASE_LANGUAGE : normalizeLanguageCode(nextRaw);
		const next = normalized.length > 0 ? normalized : BASE_LANGUAGE;
		if (next === artifactLanguage) return;

		if (isEditorOpen) {
			const ok = confirm('Switching language will discard any unsaved changes in the editor. Continue?');
			if (!ok) {
				artifactLanguageSelect = artifactLanguage;
				return;
			}
			isEditorOpen = false;
		}

		artifactLanguage = next;
		artifactLanguageSelect = next;
	}

	function addArtifactLanguage() {
		const normalized = normalizeLanguageCode(newArtifactLanguageDraft);
		if (!normalized) return;
		ensureLanguageListed(normalized);
		newArtifactLanguageDraft = '';
		requestArtifactLanguageChange(normalized);
	}


	// Generator state
	let currentTemplateId = $state<string | null>(null);
	let templateName = $state('New Template');
	let isActive = $state(false);
	let config = $state<ArtifactTemplateConfig>({
		namePattern: '{origin} Memory',
		benefit: 'Gain {quantity} {origin} runes',
		recipeType: 'origin-runes',
		originRuneQuantity: 2,
		specificRunes: [],
		tagIds: [],
		selectedOriginIds: [],
		quantity: 1
	});
	let previewArtifacts = $state<GeneratedArtifactPreview[]>([]);
	let saving = $state(false);

	// Gallery state
	let generatingCards = $state(false);
	let generationProgress = $state({ current: 0, total: 0 });
	let selectedArtifacts = $state<Set<string>>(new Set());

	// Filtered Artifacts - sorted by guardian, then by name
	const filteredArtifacts = $derived(
		artifacts
			.filter((artifact) => {
				// Search
				if (search) {
					const q = search.toLowerCase();
					const baseName = (artifact.name ?? '').toLowerCase();
					const baseBenefit = (artifact.benefit ?? '').toLowerCase();
					const localizedName = getArtifactName(artifact, artifactLanguage).toLowerCase();
					const localizedBenefit = getArtifactBenefit(artifact, artifactLanguage).toLowerCase();

					const matchesName = baseName.includes(q) || localizedName.includes(q);
					const matchesBenefit = baseBenefit.includes(q) || localizedBenefit.includes(q);
					if (!matchesName && !matchesBenefit) {
						return false;
					}
				}

				// Tag Filter
				if (tagFilter.length > 0) {
					const tagSet = new Set(artifact.tag_ids ?? []);
					if (!tagFilter.every((t) => tagSet.has(t))) return false;
				}

				return true;
			})
			.sort((a, b) => {
				// Sort by guardian first (no guardian goes to end)
				const guardianA = a.guardian_id ? guardianLookup.getLabel(a.guardian_id, '') : '';
				const guardianB = b.guardian_id ? guardianLookup.getLabel(b.guardian_id, '') : '';

				// If one has guardian and other doesn't, guardian comes first
				if (guardianA && !guardianB) return -1;
				if (!guardianA && guardianB) return 1;

				// If both have guardians, sort by guardian name
				if (guardianA !== guardianB) {
					return guardianA.localeCompare(guardianB);
				}

				// Within same guardian (or both no guardian), sort by artifact name
				return getArtifactName(a, artifactLanguage).localeCompare(getArtifactName(b, artifactLanguage));
			})
	);

	// Generation status
	const generationStatus = $derived({
		total: artifacts.length,
		withCards: artifacts.filter((a) => Boolean(getArtifactCardImagePath(a, artifactLanguage))).length,
		selected: selectedArtifacts.size
	});


	onMount(async () => {
		await loadData();
		// Initialize selected origin IDs after loading
		if (!config.selectedOriginIds || config.selectedOriginIds.length === 0) {
			config.selectedOriginIds = origins.map(o => o.id);
		}
		updatePreview();
	});

	async function loadData() {
		loading = true;
		const [aRes, oRes, rRes, avRes, tRes, tmpRes] = await Promise.all([
			supabase.from('artifacts').select('*'),
			supabase.from('origins').select('*').order('position', { ascending: true }),
			supabase.from('runes').select('*'),
				supabase.from('guardians').select('id, name, name_translations').order('name'),
			supabase.from('artifact_tags').select('*').order('name'),
			supabase.from('artifact_templates').select('*').order('name')
		]);

		if (aRes.data) artifacts = aRes.data;
		if (oRes.data) origins = oRes.data;
		if (rRes.data) runes = rRes.data;
		if (avRes.data) guardians = avRes.data;
		if (tRes.data) tags = tRes.data;
		if (tmpRes.data) templates = tmpRes.data;
		loading = false;
	}

	function openCreate() {
		editingArtifact = {
			name: '',
			benefit: '',
			tag_ids: [],
			recipe_box: [],
			quantity: 1
		};
		isEditorOpen = true;
	}

	function openEdit(artifact: ArtifactRow) {
		editingArtifact = {
			...JSON.parse(JSON.stringify(artifact)),
			recipe_box: artifact.recipe_box || [],
			quantity: artifact.quantity ?? 1
		};
		isEditorOpen = true;
	}

	function handleDelete(artifact: ArtifactRow) {
		confirmMessage = `Delete "${artifact.name}"?`;
		confirmAction = async () => {
			try {
				const { error } = await supabase.from('artifacts').delete().eq('id', artifact.id);
				if (error) throw error;
				artifacts = artifacts.filter((a) => a.id !== artifact.id);
			} catch (err) {
				console.error('Error deleting artifact:', err);
				alert(`Failed to delete artifact: ${getErrorMessage(err)}`);
			}
		};
		confirmOpen = true;
	}

	async function handleSave(event: CustomEvent<Partial<ArtifactRow>>) {
		const toSave = event.detail;
		if (!toSave.name) return alert('Name is required');

		const payload = {
			name: toSave.name,
			benefit: toSave.benefit ?? '',
			guardian_id: toSave.guardian_id,
			tag_ids: toSave.tag_ids ?? [],
			recipe_box: toSave.recipe_box,
			quantity: toSave.quantity ?? 1,
			name_translations: normalizeTranslationRecord(toSave.name_translations, 'name'),
			benefit_translations: normalizeTranslationRecord(toSave.benefit_translations, 'benefit'),
			card_image_path_translations: normalizeTranslationRecord(toSave.card_image_path_translations, 'path')
		};

		try {
			if (toSave.id) {
				// Update
				const { error } = await supabase.from('artifacts').update(payload).eq('id', toSave.id);
				if (error) throw error;
			} else {
				// Create
				const { error } = await supabase.from('artifacts').insert([payload]);
				if (error) throw error;
			}
			await loadData();
			isEditorOpen = false;
		} catch (err) {
			console.error('Error saving artifact:', err);
			alert(`Failed to ${toSave.id ? 'update' : 'create'} artifact: ${getErrorMessage(err)}`);
		}
	}

	async function handleSaveTag(event: CustomEvent<Partial<ArtifactTagRow>>) {
		const tag = event.detail;
		try {
			if (tag.id) {
				const { error } = await supabase
					.from('artifact_tags')
					.update({ name: tag.name, color: tag.color })
					.eq('id', tag.id);
				if (error) throw error;
			} else {
				const { error } = await supabase
					.from('artifact_tags')
					.insert({ name: tag.name, color: tag.color });
				if (error) throw error;
			}
			await loadData();
		} catch (err) {
			console.error('Error saving tag:', err);
			alert(`Failed to ${tag.id ? 'update' : 'create'} tag: ${getErrorMessage(err)}`);
		}
	}

	async function handleDeleteTag(event: CustomEvent<ArtifactTagRow>) {
		const tag = event.detail;
		confirmMessage = `Delete tag "${tag.name}"?`;
		confirmAction = async () => {
			try {
				const { error } = await supabase.from('artifact_tags').delete().eq('id', tag.id);
				if (error) throw error;
				await loadData();
			} catch (err) {
				console.error('Error deleting tag:', err);
				alert(`Failed to delete tag: ${getErrorMessage(err)}`);
			}
		};
		confirmOpen = true;
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	// ========== Generator Functions ==========

	function updatePreview() {
		previewArtifacts = artifactService.generateFromTemplate(config, origins, runes);
	}

	function toggleOrigin(originId: string) {
		const currentIds = config.selectedOriginIds || [];
		const index = currentIds.indexOf(originId);
		if (index > -1) {
			config.selectedOriginIds = currentIds.filter((id) => id !== originId);
		} else {
			config.selectedOriginIds = [...currentIds, originId];
		}
		updatePreview();
	}

	function toggleAllOrigins() {
		const currentIds = config.selectedOriginIds || [];
		config.selectedOriginIds = currentIds.length === origins.length ? [] : origins.map((o) => o.id);
		updatePreview();
	}

	function toggleTag(tagId: string) {
		const index = config.tagIds.indexOf(tagId);
		if (index > -1) {
			config.tagIds = config.tagIds.filter((t) => t !== tagId);
		} else {
			config.tagIds = [...config.tagIds, tagId];
		}
		updatePreview();
	}

	function addSpecificRune() {
		if (runes.length === 0) {
			alert('No runes available.');
			return;
		}
		config.specificRunes = [...config.specificRunes, { rune_id: runes[0].id, quantity: 1 }];
		updatePreview();
	}

	function updateSpecificRune(index: number, runeId: string) {
		config.specificRunes = config.specificRunes.map((e, i) => (i === index ? { ...e, rune_id: runeId } : e));
		updatePreview();
	}

	function updateSpecificRuneQuantity(index: number, quantity: number) {
		config.specificRunes = config.specificRunes.map((e, i) => (i === index ? { ...e, quantity: Math.max(1, quantity) } : e));
		updatePreview();
	}

	function removeSpecificRune(index: number) {
		config.specificRunes = config.specificRunes.filter((_, i) => i !== index);
		updatePreview();
	}

	async function syncTemplateArtifacts(templateId: string, artifactsToCreate: typeof previewArtifacts) {
		const { error: deleteError } = await supabase
			.from('artifacts')
			.delete()
			.eq('template_id', templateId);

		if (deleteError) throw deleteError;

		if (artifactsToCreate.length > 0) {
			const payload = artifactsToCreate.map(a => ({
				name: a.name,
				benefit: a.benefit,
				guardian_id: null,
				recipe_box: a.recipe_box,
				tag_ids: a.tag_ids ?? [],
				template_id: templateId,
				quantity: config.quantity ?? 1
			}));

			const { error: insertError } = await supabase
				.from('artifacts')
				.insert(payload);

			if (insertError) throw insertError;
		}
	}

	async function toggleTemplateActive(template: ArtifactTemplateRow, event: Event) {
		event.stopPropagation();
		const newStatus = !template.is_active;

		try {
			if (currentTemplateId !== template.id) {
				await loadTemplate(template);
			}

			isActive = newStatus;

			const payload = {
				name: templateName,
				config: config as any,
				is_active: newStatus,
				updated_at: new Date().toISOString()
			};

			const { error } = await supabase
				.from('artifact_templates')
				.update(payload)
				.eq('id', template.id);
			if (error) throw error;

			if (newStatus) {
				await syncTemplateArtifacts(template.id, previewArtifacts);
			} else {
				await syncTemplateArtifacts(template.id, []);
			}

			await loadData();
		} catch (err) {
			console.error('Error toggling template:', err);
			alert('Failed to toggle template.');
		}
	}

	async function loadTemplate(template: ArtifactTemplateRow) {
		currentTemplateId = template.id;
		templateName = template.name;
		isActive = template.is_active ?? false;

		const loadedConfig = template.config as any;
		config = {
			namePattern: loadedConfig.namePattern ?? '{origin} Memory',
			benefit: loadedConfig.benefit ?? 'Gain {quantity} {origin} runes',
			recipeType: loadedConfig.recipeType ?? 'origin-runes',
			originRuneQuantity: loadedConfig.originRuneQuantity ?? 2,
			specificRunes: Array.isArray(loadedConfig.specificRunes) ? loadedConfig.specificRunes : [],
			tagIds: Array.isArray(loadedConfig.tagIds) ? loadedConfig.tagIds : [],
			selectedOriginIds: Array.isArray(loadedConfig.selectedOriginIds) ? loadedConfig.selectedOriginIds : origins.map(o => o.id),
			quantity: loadedConfig.quantity ?? 1
		};

		updatePreview();
	}

	async function deleteTemplate(id: string, event: Event) {
		event.stopPropagation();
		if (!confirm('Delete this template? This will also delete all artifacts generated by it.')) return;
		try {
			await syncTemplateArtifacts(id, []);

			const { error } = await supabase
				.from('artifact_templates')
				.delete()
				.eq('id', id);
			if (error) throw error;

			if (currentTemplateId === id) {
				createNewTemplate();
			}
			await loadData();
		} catch (err) {
			console.error('Error deleting template:', err);
			alert('Failed to delete template.');
		}
	}

	function createNewTemplate() {
		currentTemplateId = null;
		templateName = 'New Template';
		isActive = false;
		config = {
			namePattern: '{origin} Memory',
			benefit: 'Gain {quantity} {origin} runes',
			recipeType: 'origin-runes',
			originRuneQuantity: 2,
			specificRunes: [],
			tagIds: [],
			selectedOriginIds: origins.map(o => o.id),
			quantity: 1
		};
		updatePreview();
	}

	async function saveTemplateWithIds() {
		const name = prompt('Enter template name:', templateName);
		if (!name) return;

		saving = true;
		try {
			const payload = {
				name,
				config: config as any,
				is_active: isActive,
				updated_at: new Date().toISOString()
			};

			let savedId = currentTemplateId;

			if (currentTemplateId) {
				const { error } = await supabase
					.from('artifact_templates')
					.update(payload)
					.eq('id', currentTemplateId);
				if (error) throw error;
			} else {
				const { data, error } = await supabase
					.from('artifact_templates')
					.insert(payload)
					.select()
					.single();
				if (error) throw error;
				if (data) savedId = data.id;
			}

			currentTemplateId = savedId;
			templateName = name;

			if (savedId) {
				if (isActive) {
					await syncTemplateArtifacts(savedId, previewArtifacts);
				} else {
					await syncTemplateArtifacts(savedId, []);
				}
			}

			await loadData();
		} catch (err) {
			console.error('Error saving template:', err);
			alert('Failed to save template.');
		} finally {
			saving = false;
		}
	}

	// ========== Gallery Functions ==========

	function toggleSelection(artifactId: string) {
		const newSet = new Set(selectedArtifacts);
		if (newSet.has(artifactId)) {
			newSet.delete(artifactId);
		} else {
			newSet.add(artifactId);
		}
		selectedArtifacts = newSet;
	}

	function selectAll() {
		selectedArtifacts = new Set(filteredArtifacts.map((a) => a.id));
	}

	function deselectAll() {
		selectedArtifacts = new Set();
	}

	function renderArtifactForLanguage(artifact: ArtifactRow, lang: ArtifactLanguage): ArtifactRow {
		return {
			...artifact,
			name: getArtifactName(artifact, lang),
			benefit: getArtifactBenefit(artifact, lang)
		};
	}

	type CardGenerationResult = { successes: string[]; errors: string[] };

	async function generateCardsBatch(artifactList: ArtifactRow[], langs: ArtifactLanguage[]): Promise<void> {
		if (langs.length === 0) return;

		generatingCards = true;
		generationProgress = { current: 0, total: artifactList.length * langs.length };

		const allErrors: string[] = [];
		const allSuccesses: string[] = [];
		let done = 0;

		for (const lang of langs) {
			const { successes, errors } = await generateCardsForLanguage(artifactList, lang, () => {
				done += 1;
				generationProgress = { current: done, total: artifactList.length * langs.length };
			});
			allSuccesses.push(...successes);
			allErrors.push(...errors);
		}

		generatingCards = false;
		generationProgress = { current: 0, total: 0 };

		await loadData();

		const message = `Generated ${allSuccesses.length} card image(s) successfully.\n${allErrors.length > 0 ? `\n${allErrors.length} errors:\n${allErrors.slice(0, 10).join('\n')}${allErrors.length > 10 ? `\n... and ${allErrors.length - 10} more` : ''}` : ''}`;
		alert(message);

		selectedArtifacts = new Set();
	}

	async function generateSelectedCards() {
		const selected = artifacts.filter((a) => selectedArtifacts.has(a.id));
		if (selected.length === 0) {
			alert('Please select at least one artifact');
			return;
		}

		if (!confirm(`Generate card images for ${selected.length} selected artifact${selected.length !== 1 ? 's' : ''} (${artifactLanguage === BASE_LANGUAGE ? 'Default' : artifactLanguage})? This may take a while.`)) {
			return;
		}

		await generateCardsBatch(selected, [artifactLanguage]);
	}

	async function generateAllCards() {
		if (!confirm(`Generate card images for all ${artifacts.length} artifacts (${artifactLanguage === BASE_LANGUAGE ? 'Default' : artifactLanguage})? This may take a while.`)) {
			return;
		}

		await generateCardsBatch(artifacts, [artifactLanguage]);
	}

	async function generateSelectedCardsAllLanguages() {
		const selected = artifacts.filter((a) => selectedArtifacts.has(a.id));
		if (selected.length === 0) {
			alert('Please select at least one artifact');
			return;
		}

		if (!confirm(`Generate card images for ${selected.length} selected artifacts in ALL languages? This may take a while.`)) {
			return;
		}

		const langs = artifactLanguageOptions
			.map((o) => (typeof o === 'string' ? o : String(o.value)))
			.filter((l) => l !== '') as ArtifactLanguage[];

		await generateCardsBatch(selected, langs);
	}

	async function generateAllCardsAllLanguages() {
		if (!confirm(`Generate card images for all ${artifacts.length} artifacts in ALL languages? This may take a while.`)) {
			return;
		}

		const langs = artifactLanguageOptions
			.map((o) => (typeof o === 'string' ? o : String(o.value)))
			.filter((l) => l !== '') as ArtifactLanguage[];

		await generateCardsBatch(artifacts, langs);
	}

	async function generateCardsForLanguage(
		artifactList: ArtifactRow[],
		lang: ArtifactLanguage,
		onArtifactDone: () => void
	): Promise<CardGenerationResult> {
		const errors: string[] = [];
		const successes: string[] = [];

		for (const artifact of artifactList) {

			if (!artifact.id || !artifact.name) {
				errors.push(`${artifact.name || 'Unknown'}: Missing ID or name`);
				onArtifactDone();
				continue;
			}

			try {
					const renderArtifact = renderArtifactForLanguage(artifact, lang);
					const guardiansForLang = guardians.map((g) => ({
						id: g.id,
						name: lang === BASE_LANGUAGE ? g.name : getTranslationValue(g.name_translations, lang) ?? g.name
					}));
					const pngBlob = await generateArtifactCardPNG(renderArtifact, origins, runes, tags, guardiansForLang);

				const folder = getArtifactCardFolderForLanguage(lang);
				const fileName = artifact.id;

				const { data, error: uploadError } = await processAndUploadImage(pngBlob, {
					folder,
					filename: fileName,
					cropTransparent: true,
					upsert: true
				});

				if (uploadError) {
					errors.push(`${artifact.name}: ${uploadError.message}`);
					onArtifactDone();
					continue;
				}

				const uploadedPath = data?.path ?? '';

				const updatePayload: Partial<ArtifactRow> = {
					updated_at: new Date().toISOString()
				};

				if (lang === BASE_LANGUAGE) {
					updatePayload.card_image_path = uploadedPath;
				} else {
					const current = artifact.card_image_path_translations ?? {};
					updatePayload.card_image_path_translations = {
						...(current as Record<string, string>),
						[lang]: uploadedPath
					};
				}

				const { error: updateError } = await supabase
					.from('artifacts')
					.update(updatePayload)
					.eq('id', artifact.id);

				if (updateError) {
					errors.push(`${artifact.name}: ${updateError.message}`);
				} else {
					successes.push(renderArtifact.name);
				}
			} catch (error) {
				errors.push(`${artifact.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}

			await new Promise((resolve) => setTimeout(resolve, 50));
			onArtifactDone();
		}

		return { successes, errors };
	}
</script>

<PageLayout
	title="Artifacts"
	subtitle="Manage artifact definitions, recipes, guardians, and tags"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		<Button variant="primary" onclick={openCreate}>Create Artifact</Button>
		<Button onclick={() => (isTagManagerOpen = true)}>Manage Tags</Button>
		<Button onclick={() => (isCardEditorOpen = true)}>Card Editor</Button>
	{/snippet}

	{#snippet tabActions()}
		<div class="artifact-actions-row">
			<span class="artifact-count">{filteredArtifacts.length} artifacts</span>
			<div class="artifact-language">
				<span class="artifact-language__label">Language</span>
				<Select
					bind:value={artifactLanguageSelect}
					options={artifactLanguageOptions}
					disabled={loading || generatingCards}
				/>
				<Input
					bind:value={newArtifactLanguageDraft}
					placeholder="Add lang (e.g. es, fr-CA)"
					disabled={loading || generatingCards}
				/>
				<Button
					variant="secondary"
					size="sm"
					onclick={addArtifactLanguage}
					disabled={loading || generatingCards || newArtifactLanguageDraft.trim().length === 0}
				>
					Add
				</Button>
			</div>
		</div>
	{/snippet}

	<FilterBar
		bind:searchValue={search}
		searchPlaceholder="Search artifacts"
		filters={[
			{
				key: 'tags',
				label: 'Tags',
				options: tags.map((t) => ({ label: t.name, value: t.id })),
				value: tagFilter[0] ?? 'all'
			}
		]}
		onfilterchange={(key, value) => {
			if (key === 'tags') {
				tagFilter = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
			}
		}}
	/>

	{#if loading}
		<div class="loading-state">Loading artifacts...</div>
	{:else if activeTab === 'list'}
		<ArtifactsListView
			artifacts={filteredArtifacts}
			language={artifactLanguage}
			{tagLookup}
			{guardianLookup}
			{runeLookup}
			onEdit={(artifact) => openEdit(artifact)}
			onDelete={(artifact) => handleDelete(artifact)}
		/>
	{:else if activeTab === 'table'}
		<ArtifactsTableView
			artifacts={filteredArtifacts}
			language={artifactLanguage}
			{tagLookup}
			{guardianLookup}
			{runeLookup}
			onEdit={(artifact) => openEdit(artifact)}
		/>
	{:else if activeTab === 'generator'}
		<div class="generator-layout">
			<!-- Sidebar: Saved Templates -->
			<aside class="sidebar-panel">
				<div class="sidebar-header">
					<h3>Templates</h3>
					<Button variant="primary" size="sm" onclick={createNewTemplate}>New</Button>
				</div>
				{#if templates.length === 0}
					<p class="muted-text">No templates saved.</p>
				{:else}
					<div class="template-list">
						{#each templates as t}
							<div class="template-item" class:active={currentTemplateId === t.id}>
								<button class="template-btn" onclick={() => loadTemplate(t)}>
									<span class="status-dot" class:on={t.is_active}></span>
									{t.name}
								</button>
								<button
									class="icon-btn"
									title={t.is_active ? 'Deactivate' : 'Activate'}
									onclick={(e) => toggleTemplateActive(t, e)}
								>
									{t.is_active ? '⏸️' : '▶️'}
								</button>
								<button class="delete-btn" onclick={(e) => deleteTemplate(t.id, e)} title="Delete">×</button>
							</div>
						{/each}
					</div>
				{/if}
			</aside>

			<!-- Main Panel -->
			<div class="main-panel">
				<!-- Config Section -->
				<div class="config-panel">
					<div class="panel-header">
						<h2>{templateName}</h2>
						<div class="header-actions">
							<label class="active-toggle">
								<input type="checkbox" bind:checked={isActive} />
								<span>Active (Syncs to DB)</span>
							</label>
							<Button variant="primary" onclick={saveTemplateWithIds} disabled={saving}>
								{saving ? 'Saving...' : 'Save & Sync'}
							</Button>
						</div>
					</div>

					<div class="config-grid">
						<!-- Left Column -->
						<div class="config-col">
							<label>
								Name Pattern
								<input
									type="text"
									bind:value={config.namePattern}
									placeholder="&#123;origin&#125; Memory"
									oninput={updatePreview}
								/>
							</label>

							<label>
								Benefit
								<textarea
									rows="2"
									bind:value={config.benefit}
									placeholder="Gain &#123;quantity&#125; &#123;origin&#125; runes"
									oninput={updatePreview}
								></textarea>
							</label>
						</div>

						<!-- Right Column -->
						<div class="config-col">
							<label>
								Recipe Type
								<select bind:value={config.recipeType} onchange={updatePreview}>
									<option value="origin-runes">Origin Runes</option>
									<option value="specific-runes">Specific Runes</option>
									<option value="custom">Custom (None)</option>
								</select>
							</label>

							{#if config.recipeType === 'origin-runes'}
								<label>
									Rune Quantity
									<input
										type="number"
										min="1"
										bind:value={config.originRuneQuantity}
										oninput={updatePreview}
									/>
								</label>
							{:else if config.recipeType === 'specific-runes'}
								<div class="mini-recipe-editor">
									<div class="mini-header">
										<small>Runes</small>
										<button class="btn-tiny" onclick={addSpecificRune}>+</button>
									</div>
									{#each config.specificRunes as entry, index (index)}
										<div class="mini-row">
											<select
												value={entry.rune_id}
												onchange={(e) => updateSpecificRune(index, e.currentTarget.value)}
											>
												{#each runes as rune}
													<option value={rune.id}>{rune.name}</option>
												{/each}
											</select>
											<input
												type="number"
												min="1"
												value={entry.quantity}
												oninput={(e) => updateSpecificRuneQuantity(index, Number(e.currentTarget.value))}
											/>
											<button class="delete-btn" onclick={() => removeSpecificRune(index)}>×</button>
										</div>
									{/each}
								</div>
							{/if}

							<label>
								Tags
								<div class="compact-tags">
									{#each tags as tag}
										<button
											class="compact-tag"
											class:active={config.tagIds.includes(tag.id)}
											style="--tag-color: {tag.color}"
											onclick={() => toggleTag(tag.id)}
										>
											{tag.name}
										</button>
									{/each}
								</div>
							</label>
						</div>
					</div>

					<!-- Origin Selector -->
					<div class="origin-bar">
						<div class="origin-bar-header">
							<small>Origins ({config.selectedOriginIds?.length ?? 0})</small>
							<button class="btn-tiny" onclick={toggleAllOrigins}>
								{config.selectedOriginIds?.length === origins.length ? 'None' : 'All'}
							</button>
						</div>
						<div class="origin-chips">
							{#each origins as origin}
								<button
									class="origin-chip"
									class:active={config.selectedOriginIds?.includes(origin.id)}
									onclick={() => toggleOrigin(origin.id)}
								>
									{origin.name}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Preview Section -->
				<div class="preview-panel">
					<div class="preview-header">
						<h2>Generated Artifacts ({previewArtifacts.length})</h2>
						{#if isActive}
							<span class="status-badge live">● Live Syncing</span>
						{:else}
							<span class="status-badge draft">○ Draft</span>
						{/if}
					</div>

					<div class="preview-grid">
						{#each previewArtifacts as artifact}
							<article class="card artifact-preview">
								<div class="preview-top">
									<h3>{artifact.name}</h3>
								</div>
								<p class="benefit">{artifact.benefit}</p>
								<div class="preview-meta">
									{#if artifact.recipe_box.length > 0}
										<div class="mini-recipe">
											{#each artifact.recipe_box as entry}
												{@const rune = runes.find((r) => r.id === entry.rune_id)}
												<span title="{rune?.name}">{entry.quantity}x {rune?.name?.substring(0, 2) ?? '?'}</span>
											{/each}
										</div>
									{/if}
									<div class="mini-tags">
										{#each artifact.tag_ids as tagId}
											{@const tag = tags.find((t) => t.id === tagId)}
											{#if tag}
												<span class="dot" style="background: {tag.color ?? '#666'}" title={tag.name}></span>
											{/if}
										{/each}
									</div>
								</div>
							</article>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{:else if activeTab === 'gallery'}
		<div class="gallery-container">
			<div class="gallery-controls">
				<div class="status-info">
					<div class="stat-card">
						<span class="stat-label">Total</span>
						<span class="stat-value">{generationStatus.total}</span>
					</div>
					<div class="stat-card">
						<span class="stat-label">With Cards</span>
						<span class="stat-value">{generationStatus.withCards}</span>
					</div>
					<div class="stat-card">
						<span class="stat-label">Selected</span>
						<span class="stat-value">{generationStatus.selected}</span>
					</div>
				</div>

				<div class="action-buttons">
					<Button
						variant="primary"
						onclick={generateSelectedCards}
						disabled={generatingCards || selectedArtifacts.size === 0}
					>
						Generate Selected ({selectedArtifacts.size})
					</Button>
						<Button
							variant="secondary"
							onclick={generateSelectedCardsAllLanguages}
							disabled={generatingCards || selectedArtifacts.size === 0 || artifactLanguageOptions.length <= 1}
						>
							Generate Selected (All Languages)
						</Button>
					<Button
						variant="secondary"
						onclick={generateAllCards}
						disabled={generatingCards || artifacts.length === 0}
					>
						Generate All
					</Button>
						<Button
							variant="secondary"
							onclick={generateAllCardsAllLanguages}
							disabled={generatingCards || artifacts.length === 0 || artifactLanguageOptions.length <= 1}
						>
							Generate All (All Languages)
						</Button>
					<Button variant="secondary" onclick={() => (isGalleryOpen = true)}>
						View Gallery ({generationStatus.withCards})
					</Button>
				</div>

				{#if generatingCards}
					<div class="progress-bar">
						<div class="progress-label">
							Generating... ({generationProgress.current}/{generationProgress.total})
						</div>
						<div class="progress-track">
							<div
								class="progress-fill"
								style="width: {(generationProgress.current / generationProgress.total) * 100}%"
							></div>
						</div>
					</div>
				{/if}

				<div class="selection-controls">
					<button class="btn-link" onclick={selectAll}>Select All</button>
					<button class="btn-link" onclick={deselectAll}>Deselect All</button>
				</div>
			</div>

			<div class="artifacts-grid">
				{#each filteredArtifacts as artifact (artifact.id)}
					{@const displayName = getArtifactName(artifact, artifactLanguage)}
					{@const displayBenefit = getArtifactBenefit(artifact, artifactLanguage)}
					{@const cardPath = getArtifactCardImagePath(artifact, artifactLanguage)}
					<div
						class="artifact-card"
						class:selected={selectedArtifacts.has(artifact.id)}
						role="button"
						tabindex="0"
						onclick={() => toggleSelection(artifact.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								toggleSelection(artifact.id);
							}
						}}
					>
						<div class="card-header">
							<input
								type="checkbox"
								checked={selectedArtifacts.has(artifact.id)}
								onclick={(e) => e.stopPropagation()}
								onchange={() => toggleSelection(artifact.id)}
							/>
							<h3>{displayName}</h3>
							{#if cardPath}
								<span class="status-badge-check">✓</span>
							{/if}
						</div>
						<p class="benefit">{displayBenefit || 'No benefit description'}</p>
						<div class="card-footer">
							{#if artifact.guardian_id}
								<span class="tag guardian-tag">Guardian</span>
							{/if}
							{#if artifact.tag_ids && artifact.tag_ids.length > 0}
								{#each artifact.tag_ids.slice(0, 2) as tagId}
									{@const tag = tags.find((t) => t.id === tagId)}
									{#if tag}
										<span class="tag" style="background-color: {tag.color}20; border-color: {tag.color}">
											{tag.name}
										</span>
									{/if}
								{/each}
								{#if artifact.tag_ids.length > 2}
									<span class="tag">+{artifact.tag_ids.length - 2}</span>
								{/if}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</PageLayout>

	<ArtifactEditorDrawer
		bind:isOpen={isEditorOpen}
		artifact={editingArtifact}
		language={artifactLanguage}
		{origins}
			guardians={guardiansForArtifactLanguage}
		{runes}
		{tags}
		on:save={handleSave}
		on:close={() => (isEditorOpen = false)}
	/>

	<TagManager
		bind:isOpen={isTagManagerOpen}
		{tags}
		on:save={handleSaveTag}
		on:delete={handleDeleteTag}
		on:close={() => (isTagManagerOpen = false)}
	/>

	<ArtifactCardGallery bind:isOpen={isGalleryOpen} {artifacts} language={artifactLanguage} {origins} {runes} {tags} guardians={guardiansForArtifactLanguage} />

<ArtifactCardEditor bind:isOpen={isCardEditorOpen} />

<ConfirmDialog
	bind:open={confirmOpen}
	message={confirmMessage}
	variant="danger"
	onconfirm={() => confirmAction?.()}
/>

<style>
	.artifact-count {
		font-size: 0.7rem;
		color: #64748b;
	}

	.artifact-actions-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		width: 100%;
	}

	.artifact-language {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.artifact-language__label {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.loading-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	/* ========== Generator Styles ========== */

	.generator-layout {
		display: grid;
		grid-template-columns: 250px 1fr;
		gap: 1rem;
		align-items: start;
	}

	@media (max-width: 1024px) {
		.generator-layout {
			grid-template-columns: 1fr;
		}
	}

	.sidebar-panel {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 0.75rem;
		position: sticky;
		top: 1rem;
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		gap: 0.5rem;
	}

	.sidebar-panel h3 {
		margin: 0;
		font-size: 0.85rem;
		color: #cbd5f5;
	}

	.template-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.template-item {
		display: flex;
		align-items: center;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 6px;
		overflow: hidden;
		transition: background 0.2s;
	}

	.template-item:hover {
		background: rgba(30, 41, 59, 0.8);
	}

	.template-item.active {
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.4);
	}

	.template-btn {
		flex: 1;
		border: none;
		background: none;
		color: #f8fafc;
		padding: 0.4rem 0.6rem;
		text-align: left;
		cursor: pointer;
		font-size: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #475569;
	}

	.status-dot.on {
		background: #4ade80;
		box-shadow: 0 0 5px #4ade80;
	}

	.icon-btn {
		border: none;
		background: none;
		color: #cbd5f5;
		padding: 0.4rem;
		cursor: pointer;
		font-size: 0.75rem;
	}

	.icon-btn:hover {
		color: white;
	}

	.delete-btn {
		border: none;
		background: none;
		color: #94a3b8;
		padding: 0.4rem;
		cursor: pointer;
		font-size: 1rem;
		line-height: 1;
	}

	.delete-btn:hover {
		color: #f87171;
	}

	.main-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.config-panel {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 1rem;
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.panel-header h2 {
		margin: 0;
		font-size: 1rem;
		color: #f8fafc;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.active-toggle {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
		color: #cbd5f5;
		font-size: 0.75rem;
		background: rgba(30, 41, 59, 0.5);
		padding: 0.3rem 0.6rem;
		border-radius: 16px;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.active-toggle input {
		width: auto;
		margin: 0;
	}

	.config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	@media (max-width: 768px) {
		.config-grid {
			grid-template-columns: 1fr;
		}
	}

	.config-col {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.config-panel label {
		display: block;
		font-size: 0.7rem;
		color: #94a3b8;
		margin-bottom: 0.25rem;
	}

	.config-panel input,
	.config-panel select,
	.config-panel textarea {
		width: 100%;
		padding: 0.4rem;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #f8fafc;
		font-size: 0.75rem;
	}

	.compact-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}

	.compact-tag {
		border: 1px solid var(--tag-color);
		color: var(--tag-color);
		background: transparent;
		border-radius: 4px;
		padding: 2px 6px;
		font-size: 0.7rem;
		cursor: pointer;
		opacity: 0.6;
	}

	.compact-tag.active {
		background: var(--tag-color);
		color: #0f172a;
		opacity: 1;
	}

	.mini-recipe-editor {
		background: rgba(0, 0, 0, 0.2);
		padding: 0.4rem;
		border-radius: 6px;
	}

	.mini-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.btn-tiny {
		padding: 1px 6px;
		font-size: 0.7rem;
		background: rgba(148, 163, 184, 0.2);
		border: 1px solid rgba(148, 163, 184, 0.3);
		color: #f8fafc;
		border-radius: 4px;
		cursor: pointer;
	}

	.mini-row {
		display: grid;
		grid-template-columns: 1fr 50px 20px;
		gap: 0.4rem;
		margin-bottom: 0.25rem;
	}

	.origin-bar {
		border-top: 1px solid rgba(148, 163, 184, 0.18);
		padding-top: 0.75rem;
	}

	.origin-bar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
		color: #94a3b8;
	}

	.origin-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		max-height: 120px;
		overflow-y: auto;
	}

	.origin-chip {
		background: rgba(148, 163, 184, 0.1);
		border: 1px solid transparent;
		color: #cbd5f5;
		padding: 0.2rem 0.5rem;
		border-radius: 99px;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.origin-chip:hover {
		background: rgba(148, 163, 184, 0.2);
	}

	.origin-chip.active {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.5);
		color: #60a5fa;
	}

	.preview-panel {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 1rem;
	}

	.preview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.preview-header h2 {
		margin: 0;
		font-size: 0.9rem;
		color: #f8fafc;
	}

	.status-badge {
		font-size: 0.7rem;
		padding: 0.2rem 0.5rem;
		border-radius: 12px;
		font-weight: 500;
	}

	.status-badge.live {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
		border: 1px solid rgba(74, 222, 128, 0.3);
	}

	.status-badge.draft {
		background: rgba(148, 163, 184, 0.15);
		color: #cbd5f5;
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.5rem;
	}

	.artifact-preview {
		padding: 0.6rem;
		min-height: 80px;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.75rem;
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 6px;
	}

	.preview-top {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}

	.preview-top h3 {
		margin: 0;
		font-size: 0.85rem;
		color: #f8fafc;
	}

	.benefit {
		margin: 0;
		font-size: 0.7rem;
		color: #cbd5f5;
		flex: 1;
	}

	.preview-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-top: 1px solid rgba(255, 255, 255, 0.05);
		padding-top: 0.4rem;
		margin-top: auto;
	}

	.mini-recipe span {
		display: inline-block;
		font-size: 0.65rem;
		background: rgba(0, 0, 0, 0.3);
		padding: 1px 3px;
		border-radius: 3px;
		margin-right: 2px;
		color: #a5b4fc;
	}

	.mini-tags {
		display: flex;
		gap: 2px;
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.muted-text {
		color: #64748b;
		font-size: 0.75rem;
		text-align: center;
		padding: 0.75rem 0;
	}

	/* ========== Gallery Styles ========== */

	.gallery-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.gallery-controls {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.status-info {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.stat-card {
		flex: 1;
		min-width: 120px;
		background: rgba(30, 41, 59, 0.6);
		border-radius: 6px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.stat-label {
		color: #94a3b8;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-value {
		color: #f8fafc;
		font-size: 1.5rem;
		font-weight: 700;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.progress-bar {
		margin-top: 0.5rem;
	}

	.progress-label {
		color: #cbd5e1;
		font-size: 0.75rem;
		margin-bottom: 0.4rem;
	}

	.progress-track {
		height: 6px;
		background: rgba(30, 41, 59, 0.6);
		border-radius: 4px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #8b5cf6);
		transition: width 0.3s ease;
	}

	.selection-controls {
		display: flex;
		gap: 0.75rem;
	}

	.btn-link {
		background: none;
		border: none;
		color: #3b82f6;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
	}

	.btn-link:hover {
		color: #60a5fa;
	}

	.artifacts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.artifact-card {
		background: rgba(15, 23, 42, 0.4);
		border: 2px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
		padding: 0.75rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.artifact-card:hover {
		border-color: rgba(148, 163, 184, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.artifact-card.selected {
		border-color: #3b82f6;
		background: rgba(59, 130, 246, 0.1);
	}

	.card-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.card-header h3 {
		flex: 1;
		margin: 0;
		font-size: 0.9rem;
		color: #f8fafc;
	}

	.card-header input[type='checkbox'] {
		cursor: pointer;
		width: 16px;
		height: 16px;
	}

	.status-badge-check {
		color: #10b981;
		font-size: 1rem;
	}

	.card-footer {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.tag {
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: rgba(255, 255, 255, 0.8);
	}

	.guardian-tag {
		background: rgba(239, 68, 68, 0.2);
		border-color: #ef4444;
		color: #fca5a5;
	}
</style>
