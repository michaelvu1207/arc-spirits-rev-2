<script lang="ts">
	import { tick } from 'svelte';
	import html2canvas from 'html2canvas';
	import type { IconPoolRow } from '$lib/types/gameData';
	import { supabase } from '$lib/api/supabaseClient';
	import { getErrorMessage } from '$lib/utils';
	import { getIconPoolUrl } from '$lib/utils/iconPool';
	import { publicAssetUrl, uploadStorageFile } from '$lib/utils/storage';
	import { Modal } from '$lib/components/layout';
	import { IconPicker } from '$lib/components/shared';
	import { Button, Input, Select, Textarea } from '$lib/components/ui';

	interface Props {
		allIcons: IconPoolRow[];
	}

	let { allIcons = $bindable<IconPoolRow[]>([]) }: Props = $props();

	const ICON_GUIDE_TAG = 'icon_guide';

	let searchQuery = $state('');
	let saveError = $state<string | null>(null);
	let saving = $state(false);
	let reordering = $state(false);

	type GuideLanguage = 'base' | string;
	const BASE_LANGUAGE: GuideLanguage = 'base';

	let guideLanguage = $state<GuideLanguage>(BASE_LANGUAGE);
	let guideLanguageSelect = $state<GuideLanguage>(BASE_LANGUAGE);
	let newLanguageDraft = $state('');
	let extraLanguages = $state<string[]>([]);

	let exporting = $state(false);
	let exportError = $state<string | null>(null);
	let exportPath = $state<string | null>(null);
	let exportedAt = $state<number | null>(null);
	let exportEl = $state<HTMLElement | null>(null);

	let draftDescriptions = $state<Record<string, string>>({});
	let draftGuideNames = $state<Record<string, string>>({});
	let draftGuideGroups = $state<Record<string, string>>({});

	let addIconOpen = $state(false);
	let addIconSelection = $state<string[]>([]);
	let addIconError = $state<string | null>(null);
	let addIconSaving = $state(false);
	let iconTagSaving = $state<Record<string, boolean>>({});

	const iconById = $derived.by(() => new Map(allIcons.map((icon) => [icon.id, icon])));

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

	function getBaseGuideName(icon: IconPoolRow): string {
		return normalizeOptionalText(icon.icon_guide_name) ?? icon.name;
	}

	function getBaseGuideGroup(icon: IconPoolRow): string | null {
		return normalizeOptionalText(icon.icon_guide_group);
	}

	function getBaseDescription(icon: IconPoolRow): string | null {
		return normalizeOptionalText(icon.description ?? null);
	}

	function getGuideName(icon: IconPoolRow): string {
		const draft = draftGuideNames[icon.id];
		const override =
			draft !== undefined
				? normalizeOptionalText(draft)
				: guideLanguage === BASE_LANGUAGE
					? normalizeOptionalText(icon.icon_guide_name)
					: getTranslationValue(icon.icon_guide_name_translations, guideLanguage);
		return override ?? getBaseGuideName(icon);
	}

	function getGuideNameInputValue(icon: IconPoolRow): string {
		const draft = draftGuideNames[icon.id];
		if (draft !== undefined) return draft;
		if (guideLanguage === BASE_LANGUAGE) return icon.icon_guide_name ?? '';
		return getTranslationValue(icon.icon_guide_name_translations, guideLanguage) ?? '';
	}

	function getGuideGroupLabel(icon: IconPoolRow): string | null {
		const draft = draftGuideGroups[icon.id];
		const override =
			draft !== undefined
				? normalizeOptionalText(draft)
				: guideLanguage === BASE_LANGUAGE
					? normalizeOptionalText(icon.icon_guide_group)
					: getTranslationValue(icon.icon_guide_group_translations, guideLanguage);
		return override ?? getBaseGuideGroup(icon);
	}

	function getGuideGroupInputValue(icon: IconPoolRow): string {
		const draft = draftGuideGroups[icon.id];
		if (draft !== undefined) return draft;
		if (guideLanguage === BASE_LANGUAGE) return icon.icon_guide_group ?? '';
		return getTranslationValue(icon.icon_guide_group_translations, guideLanguage) ?? '';
	}

	function getGuideDescription(icon: IconPoolRow): string | null {
		const draft = draftDescriptions[icon.id];
		const override =
			draft !== undefined
				? normalizeOptionalText(draft)
				: guideLanguage === BASE_LANGUAGE
					? normalizeOptionalText(icon.description ?? null)
					: getTranslationValue(icon.description_translations, guideLanguage);
		return override ?? getBaseDescription(icon);
	}

	function getGuideDescriptionInputValue(icon: IconPoolRow): string {
		const draft = draftDescriptions[icon.id];
		if (draft !== undefined) return draft;
		if (guideLanguage === BASE_LANGUAGE) return icon.description ?? '';
		return getTranslationValue(icon.description_translations, guideLanguage) ?? '';
	}

	function getGuideLanguageMeta(): string {
		return guideLanguage === BASE_LANGUAGE ? 'Default' : guideLanguage;
	}

	const guideIcons = $derived.by(() => {
		const icons = allIcons.filter((icon) => Array.isArray(icon.tags) && icon.tags.includes(ICON_GUIDE_TAG));
		return icons.sort((a, b) => {
			const groupA = getGuideGroupLabel(a);
			const groupB = getGuideGroupLabel(b);
			const aHasGroup = groupA !== null;
			const bHasGroup = groupB !== null;
			// Grouped icons first; ungrouped icons last.
			if (aHasGroup !== bHasGroup) return aHasGroup ? -1 : 1;
			if (groupA && groupB) {
				const groupCmp = groupA.localeCompare(groupB, undefined, { sensitivity: 'base' });
				if (groupCmp !== 0) return groupCmp;
			}
			const posA = a.icon_guide_position ?? Number.POSITIVE_INFINITY;
			const posB = b.icon_guide_position ?? Number.POSITIVE_INFINITY;
			if (posA !== posB) return posA - posB;
			const nameA = getGuideName(a);
			const nameB = getGuideName(b);
			return nameA.localeCompare(nameB);
		});
	});

	function isDirty(icon: IconPoolRow): boolean {
		const descDraft = draftDescriptions[icon.id];
		const nameDraft = draftGuideNames[icon.id];
		const groupDraft = draftGuideGroups[icon.id];
		if (descDraft === undefined && nameDraft === undefined && groupDraft === undefined) return false;

		if (descDraft !== undefined) {
			const stored =
				guideLanguage === BASE_LANGUAGE
					? normalizeOptionalText(icon.description ?? null)
					: getTranslationValue(icon.description_translations, guideLanguage);
			if (normalizeOptionalText(descDraft) !== stored) return true;
		}

		if (nameDraft !== undefined) {
			const stored =
				guideLanguage === BASE_LANGUAGE
					? normalizeOptionalText(icon.icon_guide_name)
					: getTranslationValue(icon.icon_guide_name_translations, guideLanguage);
			if (normalizeOptionalText(nameDraft) !== stored) return true;
		}

		if (groupDraft !== undefined) {
			const stored =
				guideLanguage === BASE_LANGUAGE
					? normalizeOptionalText(icon.icon_guide_group)
					: getTranslationValue(icon.icon_guide_group_translations, guideLanguage);
			if (normalizeOptionalText(groupDraft) !== stored) return true;
		}

		return false;
	}

	const dirtyIds = $derived.by(() => guideIcons.filter(isDirty).map((icon) => icon.id));

	const filteredIcons = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		if (!term) return guideIcons;
		return guideIcons.filter((icon) => {
			const baseName = icon.name.toLowerCase();
			const guideName = getGuideName(icon).toLowerCase();
			const groupName = (getGuideGroupLabel(icon) ?? '').toLowerCase();
			const descriptionText = (getGuideDescription(icon) ?? '').toLowerCase();
			const baseGuideName = getBaseGuideName(icon).toLowerCase();
			const baseGroupName = (getBaseGuideGroup(icon) ?? '').toLowerCase();
			const baseDescText = (getBaseDescription(icon) ?? '').toLowerCase();

			if (baseName.includes(term)) return true;
			if (baseGuideName.includes(term)) return true;
			if (guideName.includes(term)) return true;
			if (baseGroupName.includes(term)) return true;
			if (groupName.includes(term)) return true;
			if (baseDescText.includes(term)) return true;
			if (descriptionText.includes(term)) return true;
			return false;
		});
	});

	const filteredIndexById = $derived.by(
		() => new Map(filteredIcons.map((icon, index) => [icon.id, index]))
	);

	const filteredGroupInfoById = $derived.by(() => {
		const totalByGroup = new Map<string, number>();
		for (const icon of filteredIcons) {
			const groupKey = normalizeOptionalText(icon.icon_guide_group) ?? '';
			totalByGroup.set(groupKey, (totalByGroup.get(groupKey) ?? 0) + 1);
		}

		const indexByGroup = new Map<string, number>();
		const result = new Map<string, { index: number; count: number }>();
		for (const icon of filteredIcons) {
			const groupKey = normalizeOptionalText(icon.icon_guide_group) ?? '';
			const index = indexByGroup.get(groupKey) ?? 0;
			indexByGroup.set(groupKey, index + 1);
			result.set(icon.id, { index, count: totalByGroup.get(groupKey) ?? 0 });
		}
		return result;
	});

	const groupOptions = $derived.by(() => {
		const groups = new Set<string>();
		for (const icon of guideIcons) {
			const group = normalizeOptionalText(getGuideGroupInputValue(icon));
			if (group) groups.add(group);
		}
		for (const draft of Object.values(draftGuideGroups)) {
			const group = normalizeOptionalText(draft);
			if (group) groups.add(group);
		}
		return Array.from(groups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	});

	type ExportGroup = { key: string; canonical: string | null; label: string | null; icons: IconPoolRow[] };
	const exportGroups = $derived.by(() => {
		const groups = new Map<string, ExportGroup>();
		for (const icon of guideIcons) {
			const canonical = getBaseGuideGroup(icon);
			const key = canonical ?? '';
			const group = groups.get(key) ?? { key, canonical, label: null, icons: [] };
			group.icons.push(icon);
			if (!group.label) {
				group.label = getGuideGroupLabel(icon);
			}
			groups.set(key, group);
		}

		const sortedGroups: ExportGroup[] = Array.from(groups.entries())
			.map(([_key, value]) => value)
			.sort((a, b) => {
				const aHasGroup = a.canonical !== null;
				const bHasGroup = b.canonical !== null;
				if (aHasGroup !== bHasGroup) return aHasGroup ? -1 : 1;
				const aLabel = a.label ?? a.canonical;
				const bLabel = b.label ?? b.canonical;
				if (aLabel && bLabel) return aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
				return 0;
			});

		for (const group of sortedGroups) {
			group.icons = [...group.icons].sort((a, b) => {
				const posA = a.icon_guide_position ?? Number.POSITIVE_INFINITY;
				const posB = b.icon_guide_position ?? Number.POSITIVE_INFINITY;
				if (posA !== posB) return posA - posB;
				return getGuideName(a).localeCompare(getGuideName(b));
			});
		}

		return sortedGroups;
	});

	const exportPreviewUrl = $derived.by(() =>
		publicAssetUrl(exportPath, { updatedAt: exportedAt ?? undefined })
	);

	function updateDraftDescription(iconId: string, next: string) {
		draftDescriptions = { ...draftDescriptions, [iconId]: next };
	}

	function updateDraftGuideName(iconId: string, next: string) {
		draftGuideNames = { ...draftGuideNames, [iconId]: next };
	}

	function updateDraftGuideGroup(iconId: string, next: string) {
		draftGuideGroups = { ...draftGuideGroups, [iconId]: next };
	}

	function resetDrafts() {
		draftDescriptions = {};
		draftGuideNames = {};
		draftGuideGroups = {};
		saveError = null;
	}

	function ensureLanguageListed(lang: string) {
		if (!lang || lang === BASE_LANGUAGE) return;
		if (!extraLanguages.includes(lang)) extraLanguages = [...extraLanguages, lang];
	}

	$effect(() => {
		if (guideLanguageSelect !== guideLanguage) {
			requestLanguageChange(String(guideLanguageSelect));
		}
	});

	function requestLanguageChange(nextRaw: string) {
		const normalized = nextRaw === BASE_LANGUAGE ? BASE_LANGUAGE : normalizeLanguageCode(nextRaw);
		const next = normalized.length > 0 ? normalized : BASE_LANGUAGE;
		if (next === guideLanguage) return;
		if (dirtyIds.length > 0) {
			const ok = confirm(`Discard ${dirtyIds.length} unsaved change(s) before switching language?`);
			if (!ok) {
				guideLanguageSelect = guideLanguage;
				return;
			}
		}
		resetDrafts();
		guideLanguage = next;
		guideLanguageSelect = next;
	}

	function addLanguage() {
		const normalized = normalizeLanguageCode(newLanguageDraft);
		if (!normalized) return;
		ensureLanguageListed(normalized);
		newLanguageDraft = '';
		requestLanguageChange(normalized);
	}

	const detectedLanguages = $derived.by(() => {
		const out = new Set<string>();
		for (const icon of allIcons) {
			const sources = [
				icon.icon_guide_name_translations,
				icon.icon_guide_group_translations,
				icon.description_translations
			];
			for (const source of sources) {
				if (!source || typeof source !== 'object') continue;
				for (const key of Object.keys(source as Record<string, unknown>)) {
					const normalized = normalizeLanguageCode(key);
					if (!normalized) continue;
					out.add(normalized);
				}
			}
		}
		return Array.from(out).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	});

	const languageOptions = $derived.by(() => {
		const merged = new Set<string>([...detectedLanguages, ...extraLanguages]);
		const langs = Array.from(merged).filter((l) => l && l !== BASE_LANGUAGE);
		langs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		return [{ value: BASE_LANGUAGE, label: 'Default' }, ...langs.map((l) => ({ value: l, label: l }))];
	});

	function sanitizeLanguageForPath(lang: GuideLanguage): string {
		if (lang === BASE_LANGUAGE) return BASE_LANGUAGE;
		return lang.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
	}

	async function waitForImages(container: HTMLElement, timeoutMs = 8000): Promise<void> {
		const images = Array.from(container.querySelectorAll('img'));
		if (images.length === 0) return;

		const waitOne = (img: HTMLImageElement) =>
			new Promise<void>((resolve) => {
				if (img.complete && img.naturalWidth > 0) return resolve();
				const cleanup = () => {
					img.removeEventListener('load', onLoad);
					img.removeEventListener('error', onLoad);
				};
				const onLoad = () => {
					cleanup();
					resolve();
				};
				img.addEventListener('load', onLoad);
				img.addEventListener('error', onLoad);
			});

		await Promise.race([
			Promise.all(images.map((img) => waitOne(img as HTMLImageElement))).then(() => undefined),
			new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
		]);
	}

	function exportPathForLanguage(lang: GuideLanguage): string {
		if (lang === BASE_LANGUAGE) return 'exports/icon_guide/icon_guide.png';
		const safe = sanitizeLanguageForPath(lang);
		return `exports/icon_guide/icon_guide_${safe}.png`;
	}

	async function exportGuideAsPngForLanguage(lang: GuideLanguage) {
		if (typeof window === 'undefined') return;
		if (saving || reordering) return;
		if (guideIcons.length === 0) return;

		try {
			const previous = guideLanguage;
			if (previous !== lang) {
				guideLanguage = lang;
				ensureLanguageListed(lang);
				await tick();
			}

			await tick();
			const container = exportEl;
			if (!container) throw new Error('Export element not available.');
			await waitForImages(container);

			const canvas = await html2canvas(container, {
				backgroundColor: '#0f172a',
				scale: 2,
				useCORS: true,
				allowTaint: false,
				logging: false
			});

			const blob = await new Promise<Blob>((resolve, reject) => {
				canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to create PNG blob'))), 'image/png');
			});

			const nextPath = exportPathForLanguage(lang);
			const { data, error: err } = await uploadStorageFile('game_assets', nextPath, blob, {
				upsert: true,
				contentType: 'image/png'
			});
			if (err) throw err;

			exportPath = data?.path ?? nextPath;
			exportedAt = Date.now();

			if (previous !== lang) {
				guideLanguage = previous;
				await tick();
			}
		} catch (err) {
			console.error(err);
			exportError = `Failed to export PNG: ${getErrorMessage(err)}`;
		}
	}

	async function exportGuideAsPng() {
		if (exporting || saving || reordering) return;
		exporting = true;
		exportError = null;
		try {
			await exportGuideAsPngForLanguage(guideLanguage);
		} finally {
			exporting = false;
		}
	}

	async function exportGuideAsPngAllLanguages() {
		if (exporting || saving || reordering) return;
		if (dirtyIds.length > 0) {
			const ok = confirm('Export All uses saved values only. Save changes first to include drafts. Continue?');
			if (!ok) return;
		}
		exporting = true;
		exportError = null;

		const original = guideLanguage;
		const savedDraftDescriptions = draftDescriptions;
		const savedDraftGuideNames = draftGuideNames;
		const savedDraftGuideGroups = draftGuideGroups;
		try {
			draftDescriptions = {};
			draftGuideNames = {};
			draftGuideGroups = {};

			const langs = languageOptions
				.map((o) => (typeof o === 'string' ? o : String(o.value)))
				.filter((l) => l !== '');

			for (const lang of langs) {
				await exportGuideAsPngForLanguage(lang as GuideLanguage);
			}
		} finally {
			guideLanguage = original;
			draftDescriptions = savedDraftDescriptions;
			draftGuideNames = savedDraftGuideNames;
			draftGuideGroups = savedDraftGuideGroups;
			await tick();
			exporting = false;
		}
	}

	async function ensureGuidePositions() {
		const icons = [...guideIcons];
		if (icons.length === 0) return;

		const byGroup = new Map<string, IconPoolRow[]>();
		for (const icon of icons) {
			const groupKey = normalizeOptionalText(icon.icon_guide_group) ?? '';
			const groupIcons = byGroup.get(groupKey) ?? [];
			groupIcons.push(icon);
			byGroup.set(groupKey, groupIcons);
		}

		const payload: { id: string; icon_guide_position: number }[] = [];

		for (const [_groupKey, groupIcons] of byGroup.entries()) {
			const seen = new Set<number>();
			let needsInit = false;
			let maxPos = -1;

			for (const icon of groupIcons) {
				const pos = icon.icon_guide_position;
				if (typeof pos !== 'number' || !Number.isFinite(pos) || !Number.isInteger(pos) || pos < 0) {
					needsInit = true;
					break;
				}
				if (seen.has(pos)) {
					needsInit = true;
					break;
				}
				seen.add(pos);
				if (pos > maxPos) maxPos = pos;
			}

			// Keep positions compact (0..n-1) per group.
			if (!needsInit && (maxPos !== groupIcons.length - 1 || seen.size !== groupIcons.length)) {
				needsInit = true;
			}

			if (!needsInit) continue;

			const sorted = [...groupIcons].sort((a, b) => {
				const posA = typeof a.icon_guide_position === 'number' ? a.icon_guide_position : Number.POSITIVE_INFINITY;
				const posB = typeof b.icon_guide_position === 'number' ? b.icon_guide_position : Number.POSITIVE_INFINITY;
				if (posA !== posB) return posA - posB;
				const nameA = normalizeOptionalText(a.icon_guide_name) ?? a.name;
				const nameB = normalizeOptionalText(b.icon_guide_name) ?? b.name;
				return nameA.localeCompare(nameB);
			});

			for (const [index, icon] of sorted.entries()) {
				payload.push({ id: icon.id, icon_guide_position: index });
			}
		}

		if (payload.length === 0) return;

		for (const row of payload) {
			const { error: err } = await supabase
				.from('icon_pool')
				.update({ icon_guide_position: row.icon_guide_position })
				.eq('id', row.id);
			if (err) throw new Error(err.message);
		}

		const nextById = new Map(payload.map((row) => [row.id, row.icon_guide_position]));
		allIcons = allIcons.map((row) => {
			const next = nextById.get(row.id);
			return next === undefined ? row : { ...row, icon_guide_position: next };
		});
	}

	async function shiftGuideIcon(iconId: string, direction: -1 | 1) {
		if (reordering || saving) return;

		const icon = iconById.get(iconId);
		if (!icon) return;
		const groupKey = normalizeOptionalText(icon.icon_guide_group) ?? '';

		const visibleIds = filteredIcons
			.filter((i) => (normalizeOptionalText(i.icon_guide_group) ?? '') === groupKey)
			.map((i) => i.id);
		const currentIndex = visibleIds.indexOf(iconId);
		if (currentIndex < 0) return;

		const targetIndex = currentIndex + direction;
		if (targetIndex < 0 || targetIndex >= visibleIds.length) return;
		const neighborId = visibleIds[targetIndex];

		reordering = true;
		saveError = null;

		try {
			await ensureGuidePositions();

			const neighbor = iconById.get(neighborId);
			const posA = icon.icon_guide_position;
			const posB = neighbor?.icon_guide_position;
			if (typeof posA !== 'number' || typeof posB !== 'number') {
				throw new Error('Unable to reorder icons: positions not initialized.');
			}

			const { error: errA } = await supabase
				.from('icon_pool')
				.update({ icon_guide_position: posB })
				.eq('id', iconId);
			if (errA) throw new Error(errA.message);

			const { error: errB } = await supabase
				.from('icon_pool')
				.update({ icon_guide_position: posA })
				.eq('id', neighborId);
			if (errB) {
				await supabase.from('icon_pool').update({ icon_guide_position: posA }).eq('id', iconId);
				throw new Error(errB.message);
			}

			allIcons = allIcons.map((row) => {
				if (row.id === iconId) return { ...row, icon_guide_position: posB };
				if (row.id === neighborId) return { ...row, icon_guide_position: posA };
				return row;
			});
		} catch (err) {
			saveError = getErrorMessage(err);
		} finally {
			reordering = false;
		}
	}

	function openAddIcons() {
		addIconSelection = [];
		addIconError = null;
		addIconOpen = true;
	}

	async function addSelectedIcons() {
		const ids = Array.from(new Set(addIconSelection.filter((id) => typeof id === 'string')));
		if (ids.length === 0) return;

		addIconSaving = true;
		addIconError = null;
		saveError = null;
		const errors: string[] = [];

		try {
			await ensureGuidePositions();
			const nextPosByGroup = new Map<string, number>();
			for (const icon of guideIcons) {
				const groupKey = normalizeOptionalText(icon.icon_guide_group) ?? '';
				nextPosByGroup.set(groupKey, (nextPosByGroup.get(groupKey) ?? 0) + 1);
			}

			for (const iconId of ids) {
				const icon = iconById.get(iconId);
				if (!icon) continue;
				if (Array.isArray(icon.tags) && icon.tags.includes(ICON_GUIDE_TAG)) continue;

				const currentTags = Array.isArray(icon.tags)
					? icon.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
					: [];
				const nextTags = Array.from(new Set([...currentTags, ICON_GUIDE_TAG]));

				const groupKey = normalizeOptionalText(icon.icon_guide_group) ?? '';
				const nextPos = nextPosByGroup.get(groupKey) ?? 0;
				nextPosByGroup.set(groupKey, nextPos + 1);

				const { error: err } = await supabase
					.from('icon_pool')
					.update({ tags: nextTags, icon_guide_position: nextPos })
					.eq('id', iconId);
				if (err) {
					errors.push(`${icon.name}: ${err.message}`);
					continue;
				}

				allIcons = allIcons.map((row) =>
					row.id === iconId ? { ...row, tags: nextTags, icon_guide_position: nextPos } : row
				);
			}
		} catch (err) {
			addIconError = getErrorMessage(err);
		} finally {
			addIconSaving = false;
		}

		if (errors.length > 0) {
			addIconError = `Failed to add ${errors.length} icon(s):\n${errors.slice(0, 6).join('\n')}`;
			return;
		}

		addIconSelection = [];
		addIconOpen = false;
	}

	async function removeIconFromGuide(icon: IconPoolRow) {
		if (!Array.isArray(icon.tags) || !icon.tags.includes(ICON_GUIDE_TAG)) return;
		if (iconTagSaving[icon.id]) return;

		saveError = null;
		iconTagSaving = { ...iconTagSaving, [icon.id]: true };

		try {
			const nextTags = icon.tags.filter((t): t is string => typeof t === 'string' && t !== ICON_GUIDE_TAG);
			const { error: err } = await supabase
				.from('icon_pool')
				.update({ tags: nextTags, icon_guide_position: null })
				.eq('id', icon.id);
			if (err) throw new Error(err.message);

			allIcons = allIcons.map((row) =>
				row.id === icon.id ? { ...row, tags: nextTags, icon_guide_position: null } : row
			);
		} catch (err) {
			saveError = getErrorMessage(err);
		} finally {
			const { [icon.id]: _, ...rest } = iconTagSaving;
			iconTagSaving = rest;
		}
	}

	async function saveGuideChanges() {
		const ids = [...dirtyIds];
		if (ids.length === 0) return;

		saving = true;
		saveError = null;
		const nextDraftDescriptions = { ...draftDescriptions };
		const nextDraftGuideNames = { ...draftGuideNames };
		const nextDraftGuideGroups = { ...draftGuideGroups };
		const errors: string[] = [];

		try {
			for (const iconId of ids) {
				const icon = iconById.get(iconId);
				if (!icon) continue;

				const updates: Partial<IconPoolRow> = {};

				const descDraft = draftDescriptions[iconId];
				if (descDraft !== undefined) {
					const nextText = typeof descDraft === 'string' ? descDraft.trim() : '';
					if (guideLanguage === BASE_LANGUAGE) {
						updates.description = nextText.length > 0 ? nextText : null;
					} else {
						const lang = guideLanguage;
						const current = icon.description_translations ?? {};
						const next = { ...(current as Record<string, string>) };
						if (nextText.length > 0) next[lang] = nextText;
						else delete next[lang];
						updates.description_translations = next;
					}
				}

				const nameDraft = draftGuideNames[iconId];
				if (nameDraft !== undefined) {
					if (guideLanguage === BASE_LANGUAGE) {
						updates.icon_guide_name = normalizeOptionalText(nameDraft);
					} else {
						const lang = guideLanguage;
						const current = icon.icon_guide_name_translations ?? {};
						const next = { ...(current as Record<string, string>) };
						const value = normalizeOptionalText(nameDraft);
						if (value) next[lang] = value;
						else delete next[lang];
						updates.icon_guide_name_translations = next;
					}
				}

				const groupDraft = draftGuideGroups[iconId];
				if (groupDraft !== undefined) {
					if (guideLanguage === BASE_LANGUAGE) {
						const nextGroup = normalizeOptionalText(groupDraft);
						updates.icon_guide_group = nextGroup;
						// When an icon moves groups, clear its position so it can be appended + renumbered.
						if (nextGroup !== normalizeOptionalText(icon.icon_guide_group)) {
							updates.icon_guide_position = null;
						}
					} else {
						const lang = guideLanguage;
						const current = icon.icon_guide_group_translations ?? {};
						const next = { ...(current as Record<string, string>) };
						const value = normalizeOptionalText(groupDraft);
						if (value) next[lang] = value;
						else delete next[lang];
						updates.icon_guide_group_translations = next;
					}
				}

				if (Object.keys(updates).length === 0) continue;

				const { error: err } = await supabase.from('icon_pool').update(updates).eq('id', iconId);
				if (err) {
					errors.push(`${icon.name}: ${err.message}`);
					continue;
				}

				allIcons = allIcons.map((row) => (row.id === iconId ? { ...row, ...updates } : row));
				delete nextDraftDescriptions[iconId];
				delete nextDraftGuideNames[iconId];
				delete nextDraftGuideGroups[iconId];
			}

			await ensureGuidePositions();
		} catch (err) {
			saveError = getErrorMessage(err);
		} finally {
			saving = false;
			draftDescriptions = nextDraftDescriptions;
			draftGuideNames = nextDraftGuideNames;
			draftGuideGroups = nextDraftGuideGroups;
		}

		if (errors.length > 0) {
			saveError = `Failed to save ${errors.length} icon(s):\n${errors.slice(0, 6).join('\n')}`;
		}
	}
</script>

<div class="icon-guide">
	{#if saveError}
		<div class="banner banner--error">{saveError}</div>
	{/if}
	{#if exportError}
		<div class="banner banner--error">{exportError}</div>
	{/if}

	<div class="icon-guide__toolbar">
		<div class="icon-guide__search">
			<div class="icon-guide__label">Search</div>
			<Input bind:value={searchQuery} placeholder="Search icons…" />
		</div>

		<div class="icon-guide__language">
			<div class="icon-guide__label">Language</div>
			<div class="icon-guide__language-row">
				<Select
					bind:value={guideLanguageSelect}
					options={languageOptions}
					disabled={saving || reordering || exporting}
				/>
				<Input
					bind:value={newLanguageDraft}
					placeholder="Add lang (e.g. es, fr-CA)"
					disabled={saving || reordering || exporting}
				/>
				<Button
					variant="secondary"
					size="sm"
					onclick={addLanguage}
					disabled={saving || reordering || exporting || newLanguageDraft.trim().length === 0}
				>
					Add
				</Button>
			</div>
			{#if guideLanguage !== BASE_LANGUAGE}
				<div class="icon-guide__hint">Editing translations; switch to Default to change grouping/order.</div>
			{/if}
		</div>

		<div class="icon-guide__actions">
			<span class="icon-guide__meta">
				{dirtyIds.length} unsaved · {guideIcons.length} icons · {getGuideLanguageMeta()}
			</span>
			<Button
				variant="secondary"
				onclick={openAddIcons}
				disabled={saving || reordering || exporting}
			>
				+ Add Icon
			</Button>
			<Button
				variant="secondary"
				onclick={exportGuideAsPng}
				loading={exporting}
				disabled={saving || reordering || guideIcons.length === 0}
			>
				Export PNG
			</Button>
			<Button
				variant="secondary"
				onclick={exportGuideAsPngAllLanguages}
				loading={exporting}
				disabled={saving || reordering || guideIcons.length === 0 || languageOptions.length <= 1}
			>
				Export All
			</Button>
			<Button
				variant="secondary"
				onclick={resetDrafts}
				disabled={saving || reordering || exporting || dirtyIds.length === 0}
			>
				Reset
			</Button>
				<Button
					variant="primary"
					onclick={saveGuideChanges}
					loading={saving}
					disabled={reordering || exporting || dirtyIds.length === 0}
				>
					Save Changes
				</Button>
			</div>
		</div>

		<datalist id="icon-guide-groups">
			{#each groupOptions as group}
				<option value={group} />
			{/each}
		</datalist>

	{#if exportPreviewUrl}
		<div class="icon-guide__export-preview">
			<div class="icon-guide__export-preview-header">
				<div class="icon-guide__label">Export Preview</div>
				<span class="icon-guide__meta">{exportPath}</span>
			</div>
			<img src={exportPreviewUrl} alt="Icon Guide export preview" loading="lazy" decoding="async" />
		</div>
	{/if}

	{#if guideIcons.length === 0}
		<div class="placeholder">
			<p>No icons in the guide yet. Click “+ Add Icon”.</p>
		</div>
	{:else if filteredIcons.length === 0}
		<div class="placeholder">
			<p>No icons found.</p>
		</div>
	{:else}
		<div class="icon-guide__grid">
				{#each filteredIcons as icon (icon.id)}
					{@const url = getIconPoolUrl(icon)}
					{@const displayName = getGuideName(icon)}
					{@const groupName = getGuideGroupLabel(icon)}
					{@const baseGroupName = getBaseGuideGroup(icon)}
					{@const nameDraft = getGuideNameInputValue(icon)}
					{@const groupDraft = getGuideGroupInputValue(icon)}
					{@const descriptionDraft = getGuideDescriptionInputValue(icon)}
					{@const namePlaceholder = guideLanguage === BASE_LANGUAGE ? icon.name : getBaseGuideName(icon)}
					{@const groupPlaceholder = guideLanguage === BASE_LANGUAGE ? '(optional) e.g. Combat' : baseGroupName ?? '(optional) e.g. Combat'}
					{@const descriptionPlaceholder = guideLanguage === BASE_LANGUAGE ? 'What does this icon mean?' : getBaseDescription(icon) ?? 'What does this icon mean?'}
					{@const dirty = isDirty(icon)}
					{@const groupInfo = filteredGroupInfoById.get(icon.id)}
					{@const canShiftUp = (groupInfo?.index ?? 0) > 0}
					{@const canShiftDown = groupInfo ? groupInfo.index < groupInfo.count - 1 : false}

					<div class="icon-guide__card">
						<div class="icon-guide__card-header">
							<div class="icon-guide__icon">
								{#if url}
								<img src={url} alt={icon.name} loading="lazy" decoding="async" />
							{:else}
								<span class="icon-guide__icon-missing">?</span>
							{/if}
						</div>
						<div class="icon-guide__title">
							<div class="icon-guide__name">{displayName}</div>
							{#if displayName !== icon.name}
								<div class="icon-guide__base-name">{icon.name}</div>
							{/if}
							<div class="icon-guide__sub">
								<span class="icon-guide__source">{icon.source_type}</span>
								{#if groupName}
									<span class="icon-guide__group">{groupName}</span>
								{/if}
								{#if dirty}
									<span class="icon-guide__dirty">Unsaved</span>
								{/if}
							</div>
						</div>

						<div class="icon-guide__card-actions">
							<button
								type="button"
								class="icon-guide__order-btn"
								onclick={() => shiftGuideIcon(icon.id, -1)}
								disabled={!canShiftUp || saving || reordering}
							>
								-
							</button>
							<button
								type="button"
								class="icon-guide__order-btn"
								onclick={() => shiftGuideIcon(icon.id, 1)}
								disabled={!canShiftDown || saving || reordering}
							>
								+
							</button>
							<Button
								size="sm"
								variant="secondary"
								onclick={() => removeIconFromGuide(icon)}
								disabled={iconTagSaving[icon.id] || saving || reordering}
							>
								Remove
							</Button>
						</div>
					</div>

					<div class="icon-guide__field">
						<div class="icon-guide__label">
							Guide Name{guideLanguage === BASE_LANGUAGE ? '' : ` (${guideLanguage})`}
						</div>
						<Input
							placeholder={namePlaceholder}
							value={nameDraft}
							oninput={(e) =>
								updateDraftGuideName(icon.id, (e.currentTarget as HTMLInputElement).value)}
						/>
					</div>

					<div class="icon-guide__field">
						<div class="icon-guide__label">
							Group{guideLanguage === BASE_LANGUAGE ? '' : ` (${guideLanguage})`}
						</div>
						<Input
							placeholder={groupPlaceholder}
							value={groupDraft}
							list="icon-guide-groups"
							oninput={(e) =>
								updateDraftGuideGroup(icon.id, (e.currentTarget as HTMLInputElement).value)}
						/>
					</div>

					<div class="icon-guide__field">
						<div class="icon-guide__label">
							Description{guideLanguage === BASE_LANGUAGE ? '' : ` (${guideLanguage})`}
						</div>
						<Textarea
							rows={3}
							placeholder={descriptionPlaceholder}
							value={descriptionDraft}
							oninput={(e) =>
								updateDraftDescription(icon.id, (e.currentTarget as HTMLTextAreaElement).value)}
						/>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if exporting}
		{@const hasNamedGroups = exportGroups.some((g) => g.canonical !== null)}

		<div class="icon-guide-export" aria-hidden="true">
			<div class="icon-guide-export__sheet" bind:this={exportEl}>
				<div class="icon-guide-export__header">
					<div class="icon-guide-export__title">Icon Guide{guideLanguage === BASE_LANGUAGE ? '' : ` (${guideLanguage})`}</div>
					<div class="icon-guide-export__meta">{guideIcons.length} icons</div>
				</div>

				<div class="icon-guide-export__groups">
					{#each exportGroups as group (group.key)}
						<div class="icon-guide-export__group">
							{#if group.canonical || hasNamedGroups}
								<div class="icon-guide-export__group-title">{group.label ?? group.canonical ?? 'Ungrouped'}</div>
							{/if}

							<div class="icon-guide-export__grid">
								{#each group.icons as icon (icon.id)}
									{@const url = getIconPoolUrl(icon)}
									{@const displayName = getGuideName(icon)}
									{@const descriptionText = (getGuideDescription(icon) ?? '').trim()}
									<div class="icon-guide-export__item">
										<div class="icon-guide-export__icon">
											{#if url}
												<img
													src={url}
													alt={displayName}
													crossorigin="anonymous"
													loading="eager"
													decoding="async"
												/>
											{:else}
												<span class="icon-guide-export__icon-missing">?</span>
											{/if}
										</div>
										<div class="icon-guide-export__content">
											<p class="icon-guide-export__name">{displayName}</p>
											{#if descriptionText}
												<p class="icon-guide-export__description">{descriptionText}</p>
											{:else}
												<p class="icon-guide-export__description icon-guide-export__description--missing">
													No description
												</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>

<Modal bind:open={addIconOpen} title="Add Icons to Icon Guide" size="lg">
	{#snippet children()}
		{#if addIconError}
			<div class="banner banner--error">{addIconError}</div>
		{/if}
		<p class="image-note">Icons only appear in the guide when you manually add them here.</p>
		<IconPicker bind:selected={addIconSelection} allowDuplicates={false} multiple={true} maxSelection={50} />
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (addIconOpen = false)} disabled={addIconSaving}>
			Cancel
		</Button>
		<Button
			variant="primary"
			onclick={addSelectedIcons}
			loading={addIconSaving}
			disabled={addIconSelection.length === 0}
		>
			Add to Guide
		</Button>
	{/snippet}
</Modal>

<style>
	.banner {
		padding: 0.75rem 1rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(15, 23, 42, 0.55);
		color: #cbd5f5;
	}

	.banner--error {
		border-color: rgba(248, 113, 113, 0.35);
		background: rgba(248, 113, 113, 0.12);
		color: #fecaca;
	}

	.placeholder {
		display: grid;
		place-items: center;
		min-height: 240px;
		color: #94a3b8;
	}

	.icon-guide {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.icon-guide__toolbar {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.icon-guide__language {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 280px;
	}

	.icon-guide__language-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.icon-guide__hint {
		color: rgba(148, 163, 184, 0.95);
		font-size: 0.85rem;
	}

	.icon-guide__search {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 240px;
		flex: 1;
	}

	.icon-guide__actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.icon-guide__meta {
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.9);
		white-space: nowrap;
	}

	.icon-guide__label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(148, 163, 184, 0.85);
	}

	.icon-guide__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}

	@media (min-width: 1100px) {
		.icon-guide__grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.icon-guide__card {
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(15, 23, 42, 0.45);
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.icon-guide__card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.icon-guide__icon {
		width: 52px;
		height: 52px;
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.4);
		display: grid;
		place-items: center;
		overflow: hidden;
		flex-shrink: 0;
	}

	.icon-guide__icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.icon-guide__icon-missing {
		color: rgba(148, 163, 184, 0.9);
		font-weight: 800;
	}

	.icon-guide__title {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1;
	}

	.icon-guide__name {
		font-size: 0.95rem;
		font-weight: 800;
		color: #e2e8f0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.icon-guide__base-name {
		font-size: 0.78rem;
		color: rgba(148, 163, 184, 0.85);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.icon-guide__sub {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.icon-guide__source {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.icon-guide__group {
		font-size: 0.75rem;
		color: rgba(226, 232, 240, 0.9);
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(2, 6, 23, 0.35);
	}

	.icon-guide__dirty {
		font-size: 0.75rem;
		color: rgba(251, 191, 36, 0.9);
		font-weight: 700;
	}

	.icon-guide__card-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-left: auto;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.icon-guide__order-btn {
		width: 34px;
		height: 34px;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.22);
		background: rgba(2, 6, 23, 0.35);
		color: rgba(226, 232, 240, 0.9);
		font-weight: 800;
		display: grid;
		place-items: center;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.icon-guide__order-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 16px rgba(15, 23, 42, 0.35);
		border-color: rgba(96, 165, 250, 0.35);
	}

	.icon-guide__order-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.icon-guide__field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.icon-guide__export-preview {
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(15, 23, 42, 0.45);
		padding: 0.75rem;
	}

	.icon-guide__export-preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.6rem;
	}

	.icon-guide__export-preview img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.12);
		background: rgba(2, 6, 23, 0.35);
	}

	.icon-guide-export {
		position: fixed;
		left: -100000px;
		top: 0;
		pointer-events: none;
	}

	.icon-guide-export__sheet {
		--guide-export-columns: 5;
		--guide-export-icon-size: 72px;

		width: 1200px;
		padding: 1.25rem;
		border-radius: 16px;
		background: #0f172a;
		color: #e2e8f0;
		border: 1px solid rgba(148, 163, 184, 0.18);
	}

	.icon-guide-export__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.icon-guide-export__title {
		font-size: 1.15rem;
		font-weight: 800;
		letter-spacing: 0.02em;
	}

	.icon-guide-export__meta {
		font-size: 0.85rem;
		color: rgba(148, 163, 184, 0.9);
	}

	.icon-guide-export__groups {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.icon-guide-export__group {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.icon-guide-export__group-title {
		font-size: 0.95rem;
		font-weight: 900;
		letter-spacing: 0.02em;
		color: rgba(226, 232, 240, 0.96);
		padding-bottom: 0.35rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.18);
	}

	.icon-guide-export__grid {
		display: grid;
		grid-template-columns: repeat(var(--guide-export-columns), minmax(0, 1fr));
		gap: 0.8rem;
	}

	.icon-guide-export__item {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		align-items: stretch;
		padding: 0.85rem;
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.14);
		background: rgba(2, 6, 23, 0.35);
		min-height: 160px;
	}

	.icon-guide-export__icon {
		width: var(--guide-export-icon-size);
		height: var(--guide-export-icon-size);
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(15, 23, 42, 0.65);
		display: grid;
		place-items: center;
		padding: 8px;
	}

	.icon-guide-export__icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		filter:
			drop-shadow(1px 0 0 rgba(43, 26, 18, 0.95))
			drop-shadow(-1px 0 0 rgba(43, 26, 18, 0.95))
			drop-shadow(0 1px 0 rgba(43, 26, 18, 0.95))
			drop-shadow(0 -1px 0 rgba(43, 26, 18, 0.95));
	}

	.icon-guide-export__icon-missing {
		color: rgba(148, 163, 184, 0.9);
		font-weight: 800;
		font-size: 1rem;
	}

	.icon-guide-export__content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.icon-guide-export__name {
		font-size: 0.9rem;
		font-weight: 800;
		margin: 0;
		line-height: 1.1;
	}

	.icon-guide-export__description {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.25;
		color: rgba(226, 232, 240, 0.92);
		white-space: pre-wrap;
	}

	.icon-guide-export__description--missing {
		color: rgba(148, 163, 184, 0.85);
		font-style: italic;
	}
</style>
