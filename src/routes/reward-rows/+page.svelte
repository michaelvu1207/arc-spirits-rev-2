<script lang="ts">
	import { onMount } from 'svelte';
	import type {
		GameLocationRewardRow,
		GameLocationRow,
		GameLocationRowCompositionRow,
		RewardRowAssignment,
		RewardIconToken,
		RewardRowTagRow
	} from '$lib/types/gameData';
	import { configToRewardRow } from '$lib/types/gameData';
	import { renderLocationRewardRowPngBlob } from '$lib/generators/game-locations/locationCardIconPlacer';
	import { loadAllIcons, getIconPoolUrl, loadIconPool } from '$lib/utils/iconPool';
	import { processAndUploadImage, publicAssetUrl } from '$lib/utils/storage';
	import {
		normalizeRewardIconTokens,
		rewardIconTokensHaveAnyIcons,
		clampRewardIconTokensBySlots,
		isRewardOrIconToken,
		rewardIconTokensSlotsUsed,
		rewardIconTokenSlotCost
	} from '$lib/utils/rewardIconTokens';
	import { getErrorMessage } from '$lib/utils';
	import { fetchAll, upsertById, deleteById } from '$lib/services/dataService';
	import { useFormModal } from '$lib/composables/useFormModal.svelte';
	import { useLookup } from '$lib/composables/useLookup.svelte';
	import { PageLayout, Modal } from '$lib/components/layout';
	import { ConfirmDialog, FilterBar, IconPicker, RewardRowPreview } from '$lib/components/shared';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import TagManager from '$lib/components/shared/TagManager.svelte';
	import { supabase } from '$lib/api/supabaseClient';

	type RewardRowRecord = GameLocationRowCompositionRow;
	type LocationSummary = Pick<GameLocationRow, 'id' | 'name'>;

	// --- State ---
	let rows = $state<RewardRowRecord[]>([]);
	let locations = $state<LocationSummary[]>([]);
	let assignments = $state<RewardRowAssignment[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saving = $state(false);
	let deleting = $state(false);
	let exportingRowPngs = $state(false);
	let progressMessage = $state<string | null>(null);

	let searchQuery = $state('');
	let typeFilter = $state<string>('all');
	let rewardRowTags = $state<RewardRowTagRow[]>([]);
	let tagFilter = $state<string[]>([]);
	let showTagManager = $state(false);

	// --- Form modal ---
	type FormData = {
		name: string;
		type: 'gain' | 'trade' | 'text';
		tagIds: string[];
		quantity: number;
		// Icon editing state stored separately
	};

	const modal = useFormModal<FormData>({
		name: '',
		type: 'gain',
		tagIds: [],
		quantity: 1
	});

	let formError = $state<string | null>(null);

	// Inline content editing state for the modal
	let editingRewardRow = $state<GameLocationRewardRow>({ type: 'gain', gain_icon_ids: [] });

	// Icon picker state
	type PickingState =
		| { list: 'gain' | 'cost'; mode: 'append' }
		| { list: 'gain' | 'cost'; mode: 'edit'; tokenIndex: number };
	let picking = $state<PickingState | null>(null);
	const slotLimits = { gain: 6, trade_cost: 6, trade_gain: 6 };

	// --- Delete confirm ---
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<RewardRowRecord | null>(null);

	// --- Assignment modal ---
	let showAssignModal = $state(false);
	let assignRowId = $state<string | null>(null);
	let assignLocationId = $state('');
	let assignError = $state<string | null>(null);
	let assignSaving = $state(false);

	// --- Lookups ---
	const locationLookup = useLookup(() => locations as (LocationSummary & { id: string })[], 'name');
	const tagLookup = useLookup(() => rewardRowTags);

	// --- Filtering ---
	const filteredRows = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		return rows.filter((row) => {
			if (typeFilter !== 'all' && row.type !== typeFilter) return false;
			if (tagFilter.length > 0) {
				const tagSet = new Set(row.tag_ids ?? []);
				if (!tagFilter.every((t) => tagSet.has(t))) return false;
			}
			if (!term) return true;
			const name = (row.name ?? '').toLowerCase();
			return (
				name.includes(term) ||
				row.type.toLowerCase().includes(term) ||
				row.id.toLowerCase().includes(term)
			);
		});
	});

	type TagSection = { tag: RewardRowTagRow | null; rows: RewardRowRecord[] };

	const groupedRows = $derived.by((): TagSection[] => {
		const sections: TagSection[] = [];
		const tagOrder = rewardRowTags;

		for (const tag of tagOrder) {
			const matching = filteredRows.filter((r) => (r.tag_ids ?? []).includes(tag.id));
			if (matching.length > 0) sections.push({ tag, rows: matching });
		}

		const untagged = filteredRows.filter((r) => !r.tag_ids || r.tag_ids.length === 0);
		if (untagged.length > 0) sections.push({ tag: null, rows: untagged });

		return sections;
	});

	const hasMultipleTags = $derived(rewardRowTags.length > 0);

	const subtitleText = $derived.by(() => {
		const gain = filteredRows.filter((r) => r.type === 'gain').length;
		const trade = filteredRows.filter((r) => r.type === 'trade').length;
		const text = filteredRows.filter((r) => r.type === 'text').length;
		return `${filteredRows.length} rows · Gain ${gain} · Trade ${trade} · Text ${text}`;
	});

	const locationOptions = $derived(
		locations.map((loc) => ({ value: loc.id, label: loc.name }))
	);

	const typeOptions = [
		{ value: 'gain', label: 'Gain' },
		{ value: 'trade', label: 'Trade' },
		{ value: 'text', label: 'Text' }
	];

	// --- Helpers ---
	function getAssignmentsForRow(rowId: string): (RewardRowAssignment & { locationName: string })[] {
		return assignments
			.filter((a) => a.row_id === rowId)
			.map((a) => ({
				...a,
				locationName: locationLookup.getLabel(a.location_id, 'Unknown')
			}))
			.sort((a, b) => a.locationName.localeCompare(b.locationName));
	}

	function getResolvedRewardRow(row: RewardRowRecord): GameLocationRewardRow {
		return configToRewardRow(row.type, row.config);
	}

	function hasRewardContent(row: GameLocationRewardRow | null | undefined): boolean {
		if (!row) return false;
		if (row.type === 'text') return row.text.trim().length > 0;
		if (row.type === 'trade') {
			return (
				rewardIconTokensHaveAnyIcons(row.cost_icon_ids) ||
				rewardIconTokensHaveAnyIcons(row.gain_icon_ids)
			);
		}
		return rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
	}

	function getRewardRowImageUrl(row: RewardRowRecord): string | null {
		const raw = typeof row.row_image_path === 'string' ? row.row_image_path.trim() : '';
		if (!raw) return null;
		if (/^https?:\/\//i.test(raw)) return raw;
		return publicAssetUrl(raw, { updatedAt: row.updated_at ?? 0 });
	}

	function sanitizeFileName(value: string): string {
		return value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 60);
	}

	function rewardRowToConfig(row: GameLocationRewardRow): Record<string, unknown> {
		if (row.type === 'text') return { type: 'text', text: row.text };
		if (row.type === 'trade') return { type: 'trade', cost_icon_ids: row.cost_icon_ids, gain_icon_ids: row.gain_icon_ids };
		return { type: 'gain', gain_icon_ids: row.gain_icon_ids };
	}

	// --- Icon editing helpers (adapted from LocationRewardRowsEditor) ---
	function maxFor(row: GameLocationRewardRow, list: 'gain' | 'cost'): number {
		if (row.type === 'text') return 0;
		if (row.type === 'trade') return list === 'cost' ? slotLimits.trade_cost : slotLimits.trade_gain;
		return slotLimits.gain;
	}

	function getTokens(row: GameLocationRewardRow, list: 'gain' | 'cost'): RewardIconToken[] {
		if (row.type === 'text') return [];
		if (list === 'gain') return row.gain_icon_ids ?? [];
		if (row.type !== 'trade') return [];
		return row.cost_icon_ids ?? [];
	}

	function setTokens(list: 'gain' | 'cost', tokens: RewardIconToken[]) {
		const row = editingRewardRow;
		if (row.type === 'text') return;
		if (list === 'gain') {
			editingRewardRow = { ...row, gain_icon_ids: clampRewardIconTokensBySlots(tokens, maxFor(row, 'gain')) } as GameLocationRewardRow;
			return;
		}
		if (row.type !== 'trade') return;
		editingRewardRow = { ...row, cost_icon_ids: clampRewardIconTokensBySlots(tokens, maxFor(row, 'cost')) } as GameLocationRewardRow;
	}

	function remainingSlots(row: GameLocationRewardRow, list: 'gain' | 'cost'): number {
		return Math.max(0, maxFor(row, list) - rewardIconTokensSlotsUsed(getTokens(row, list)));
	}

	function appendIcons(list: 'gain' | 'cost', iconIds: string[]) {
		const row = editingRewardRow;
		if (row.type === 'text') return;
		const existing = getTokens(row, list);
		const toAdd = iconIds.slice(0, remainingSlots(row, list)).map((id) => String(id));
		setTokens(list, [...existing, ...toAdd]);
	}

	function replaceTokenAt(list: 'gain' | 'cost', tokenIndex: number, next: RewardIconToken) {
		const row = editingRewardRow;
		if (row.type === 'text') return;
		const tokens = getTokens(row, list);
		if (tokenIndex < 0 || tokenIndex >= tokens.length) return;
		const updated = tokens.map((t, i) => (i === tokenIndex ? next : t));
		setTokens(list, updated);
	}

	function removeTokenAt(list: 'gain' | 'cost', tokenIndex: number) {
		const row = editingRewardRow;
		if (row.type === 'text') return;
		const tokens = getTokens(row, list).filter((_, i) => i !== tokenIndex);
		setTokens(list, tokens);
	}

	function addOrSlot(list: 'gain' | 'cost') {
		const row = editingRewardRow;
		if (row.type === 'text') return;
		if (remainingSlots(row, list) < 2) return;
		const tokens = getTokens(row, list);
		const tokenIndex = tokens.length;
		setTokens(list, [...tokens, { kind: 'or', icon_ids: [] }]);
		picking = { list, mode: 'edit', tokenIndex };
	}

	function setEditingType(type: 'gain' | 'trade' | 'text') {
		const row = editingRewardRow;
		if (row.type === type) return;
		modal.formData.type = type;
		if (type === 'gain') {
			editingRewardRow = { type: 'gain', gain_icon_ids: row.type === 'trade' ? row.gain_icon_ids ?? [] : [] };
		} else if (type === 'trade') {
			editingRewardRow = { type: 'trade', cost_icon_ids: [], gain_icon_ids: row.type === 'gain' ? row.gain_icon_ids ?? [] : [] };
		} else {
			editingRewardRow = { type: 'text', text: '' };
		}
		picking = null;
	}

	// --- Render + upload a single row PNG ---
	async function renderAndUploadRowPng(row: RewardRowRecord, resolved: GameLocationRewardRow) {
		const blob = await renderLocationRewardRowPngBlob(resolved);
		const uploadName = sanitizeFileName(row.name ?? row.id);
		const { data, error: uploadError } = await processAndUploadImage(blob, {
			folder: 'game_location_rows',
			filename: uploadName,
			cropTransparent: false,
			upsert: true
		});
		if (uploadError) throw uploadError;

		const path = (data?.path ?? '').trim();
		if (!path) throw new Error('Missing uploaded row image path.');

		const updatedAt = new Date().toISOString();
		const { error: updateError } = await supabase
			.from('game_location_rows')
			.update({ row_image_path: path, updated_at: updatedAt })
			.eq('id', row.id);
		if (updateError) throw updateError;

		rows = rows.map((existing) =>
			existing.id === row.id
				? { ...existing, row_image_path: path, updated_at: updatedAt }
				: existing
		);
	}

	// --- Data loading ---
	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			await loadAllIcons();
			const [rowsData, locationsData, assignmentsData, tagsRes] = await Promise.all([
				fetchAll<RewardRowRecord>('game_location_rows', '*', { column: 'name', ascending: true }),
				fetchAll<LocationSummary>('game_locations', 'id, name', { column: 'name', ascending: true }),
				fetchAll<RewardRowAssignment>('reward_row_assignments', '*', { column: 'created_at', ascending: true }),
				supabase.from('reward_row_tags').select('*').order('name')
			]);

			rows = rowsData;
			locations = locationsData;
			assignments = assignmentsData;
			if (tagsRes.data) rewardRowTags = tagsRes.data;
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	// --- CRUD ---
	function openCreate() {
		formError = null;
		picking = null;
		editingRewardRow = { type: 'gain', gain_icon_ids: [] };
		modal.open({ name: '', type: 'gain', tagIds: [], quantity: 1 });
	}

	function openEdit(row: RewardRowRecord) {
		formError = null;
		picking = null;
		editingRewardRow = getResolvedRewardRow(row);
		modal.open({
			id: row.id,
			name: row.name ?? '',
			type: row.type,
			tagIds: row.tag_ids ?? [],
			quantity: row.quantity ?? 1
		});
	}

	function openDuplicate(row: RewardRowRecord) {
		formError = null;
		picking = null;
		editingRewardRow = getResolvedRewardRow(row);
		modal.open({
			name: (row.name ?? '') + ' (copy)',
			type: row.type,
			tagIds: row.tag_ids ?? [],
			quantity: row.quantity ?? 1
		});
	}

	async function handleSave() {
		formError = null;
		const { formData } = modal;

		const name = formData.name.trim();

		saving = true;
		try {
			const config = rewardRowToConfig(editingRewardRow);
			const payload = {
				id: modal.isEditing ? modal.editingId : undefined,
				name: name || null,
				type: editingRewardRow.type,
				config,
				tag_ids: formData.tagIds ?? [],
				quantity: Math.max(1, formData.quantity ?? 1)
			} as Partial<RewardRowRecord> & { id?: string | null };

			const saved = await upsertById<typeof payload>('game_location_rows', payload) as RewardRowRecord;
			modal.close();
			picking = null;
			await loadData();

			// Auto-render PNG for the saved row
			const resolved = configToRewardRow(saved.type, saved.config);
			if (hasRewardContent(resolved)) {
				progressMessage = 'Rendering PNG...';
				try {
					await renderAndUploadRowPng(saved, resolved);
				} catch (err) {
					console.warn('Auto-render failed:', err);
					progressMessage = `Saved row, but PNG render failed: ${getErrorMessage(err)}`;
					setTimeout(() => (progressMessage = null), 5000);
					return;
				}
				progressMessage = 'Row saved and PNG updated.';
				setTimeout(() => (progressMessage = null), 3000);
			}
		} catch (err) {
			formError = getErrorMessage(err);
		} finally {
			saving = false;
		}
	}

	function confirmDelete(row: RewardRowRecord) {
		deleteTarget = row;
		showDeleteConfirm = true;
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		deleting = true;
		try {
			await deleteById('game_location_rows', deleteTarget.id);
			deleteTarget = null;
			await loadData();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			deleting = false;
		}
	}

	// --- Tag management ---
	async function handleSaveTag(event: CustomEvent<Partial<RewardRowTagRow>>) {
		const tag = event.detail;
		try {
			if (tag.id) {
				const { error: err } = await supabase
					.from('reward_row_tags')
					.update({ name: tag.name, color: tag.color })
					.eq('id', tag.id);
				if (err) throw err;
			} else {
				const { error: err } = await supabase
					.from('reward_row_tags')
					.insert({ name: tag.name, color: tag.color });
				if (err) throw err;
			}
			await loadData();
		} catch (err) {
			console.error('Error saving tag:', err);
			error = `Failed to ${tag.id ? 'update' : 'create'} tag: ${getErrorMessage(err)}`;
		}
	}

	async function handleDeleteTag(event: CustomEvent<RewardRowTagRow>) {
		const tag = event.detail;
		try {
			const { error: err } = await supabase.from('reward_row_tags').delete().eq('id', tag.id);
			if (err) throw err;
			await loadData();
		} catch (err) {
			console.error('Error deleting tag:', err);
			error = `Failed to delete tag: ${getErrorMessage(err)}`;
		}
	}

	function toggleFormTag(tagId: string) {
		const current = modal.formData.tagIds ?? [];
		if (current.includes(tagId)) {
			modal.formData.tagIds = current.filter((id) => id !== tagId);
		} else {
			modal.formData.tagIds = [...current, tagId];
		}
	}

	async function toggleCardTag(row: RewardRowRecord, tagId: string) {
		const current = row.tag_ids ?? [];
		const next = current.includes(tagId)
			? current.filter((id) => id !== tagId)
			: [...current, tagId];
		try {
			const { error: err } = await supabase
				.from('game_location_rows')
				.update({ tag_ids: next })
				.eq('id', row.id);
			if (err) throw err;
			rows = rows.map((r) => (r.id === row.id ? { ...r, tag_ids: next } : r));
		} catch (err) {
			error = getErrorMessage(err);
		}
	}

	// --- Assignment CRUD ---
	function openAssignModal(rowId: string) {
		assignRowId = rowId;
		assignLocationId = '';
		assignError = null;
		showAssignModal = true;
	}

	async function handleAssign() {
		assignError = null;
		if (!assignRowId || !assignLocationId) {
			assignError = 'Please select a location.';
			return;
		}

		// Auto-pick next available slot (0, 1, 2)
		const usedSlots = assignments
			.filter((a) => a.location_id === assignLocationId)
			.map((a) => a.row_index);
		const nextSlot = [0, 1, 2, 3, 4].find((i) => !usedSlots.includes(i));
		if (nextSlot === undefined) {
			assignError = 'All 5 slots at this location are already assigned.';
			return;
		}

		assignSaving = true;
		try {
			const { error: err } = await supabase
				.from('reward_row_assignments')
				.insert({
					location_id: assignLocationId,
					row_id: assignRowId,
					row_index: nextSlot,
					pos_x: 0,
					pos_y: 0,
					scale: 1
				});
			if (err) throw err;
			showAssignModal = false;
			await loadData();
		} catch (err) {
			assignError = getErrorMessage(err);
		} finally {
			assignSaving = false;
		}
	}

	async function removeAssignment(assignmentId: string) {
		try {
			const { error: err } = await supabase
				.from('reward_row_assignments')
				.delete()
				.eq('id', assignmentId);
			if (err) throw err;
			await loadData();
		} catch (err) {
			error = getErrorMessage(err);
		}
	}

	// --- Export PNGs ---
	async function exportRewardRowPngs() {
		const targets = filteredRows
			.map((row) => ({ row, resolved: getResolvedRewardRow(row) }))
			.filter(
				(entry): entry is { row: RewardRowRecord; resolved: GameLocationRewardRow } =>
					hasRewardContent(entry.resolved)
			);

		if (targets.length === 0) {
			progressMessage = 'No reward rows with renderable content for the current filter.';
			setTimeout(() => (progressMessage = null), 4000);
			return;
		}

		exportingRowPngs = true;
		progressMessage = `Exporting 0/${targets.length}...`;
		try {
			let success = 0;
			let failed = 0;

			for (const { row, resolved } of targets) {
				progressMessage = `Exporting ${success + failed + 1}/${targets.length}...`;
				try {
					await renderAndUploadRowPng(row, resolved);
					success++;
				} catch (err) {
					console.warn(`Failed to generate/upload reward row image for ${row.id}:`, err);
					failed++;
				}
			}

			progressMessage = failed > 0
				? `Saved ${success} reward row PNG(s), ${failed} failed.`
				: `Saved ${success} reward row PNG(s) to Supabase storage.`;
			setTimeout(() => (progressMessage = null), 5000);
		} catch (err) {
			console.error('Failed to save reward row PNGs:', err);
			progressMessage = `Failed to save reward row PNGs: ${getErrorMessage(err)}`;
			setTimeout(() => (progressMessage = null), 5000);
		} finally {
			exportingRowPngs = false;
		}
	}
</script>

<PageLayout title="Reward Rows" subtitle={subtitleText}>
	{#snippet headerActions()}
		<Button size="sm" variant="primary" onclick={openCreate} disabled={loading}>
			+ Add Row
		</Button>
		<Button size="sm" onclick={() => (showTagManager = true)} disabled={loading}>
			Manage Tags
		</Button>
		<Button
			size="sm"
			onclick={exportRewardRowPngs}
			disabled={loading || exportingRowPngs}
			loading={exportingRowPngs}
		>
			Save PNGs
		</Button>
	{/snippet}

	{#snippet children()}
		{#if error}
			<div class="banner banner--error">{error}</div>
		{/if}

		{#if progressMessage}
			<div class="banner banner--info">{progressMessage}</div>
		{/if}

		<FilterBar
			bind:searchValue={searchQuery}
			searchPlaceholder="Search reward rows..."
			filters={[
				{
					key: 'type',
					label: 'Type',
					value: typeFilter === 'all' ? null : typeFilter,
					options: typeOptions
				},
				{
					key: 'tags',
					label: 'Tags',
					options: rewardRowTags.map((t) => ({ label: t.name, value: t.id })),
					value: tagFilter[0] ?? 'all'
				}
			]}
			onfilterchange={(key, value) => {
				if (key === 'type') typeFilter = value ? String(value) : 'all';
				if (key === 'tags') tagFilter = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
			}}
		/>

		{#if loading}
			<div class="placeholder">
				<p>Loading reward rows...</p>
			</div>
		{:else if filteredRows.length === 0}
			<div class="empty-state">
				<span class="empty-state__icon">🎁</span>
				<p>No reward rows found</p>
			</div>
		{:else if hasMultipleTags}
			{#each groupedRows as section (section.tag?.id ?? '__untagged')}
				<div class="tag-section">
					<div class="tag-section__header">
						{#if section.tag}
							<span class="tag-section__badge" style="--tag-color: {section.tag.color}">
								{section.tag.name}
							</span>
						{:else}
							<span class="tag-section__badge tag-section__badge--untagged">Untagged</span>
						{/if}
						<span class="tag-section__count">{section.rows.length}</span>
					</div>
					<div class="tag-section__grid">
						{#each section.rows as item (item.id)}
							{@render rowCard(item)}
						{/each}
					</div>
				</div>
			{/each}
		{:else}
			<div class="tag-section__grid">
				{#each filteredRows as item (item.id)}
					{@render rowCard(item)}
				{/each}
			</div>
		{/if}
	{/snippet}
</PageLayout>

{#snippet rowCard(item: RewardRowRecord)}
	{@const rowImageUrl = getRewardRowImageUrl(item)}
	{@const resolved = getResolvedRewardRow(item)}
	{@const rowAssignments = getAssignmentsForRow(item.id)}
	<div class="row-card">
		<header class="row-card__header">
			<div class="row-card__title-wrap">
				<h3>{item.name ?? 'Untitled'}</h3>
				<p class="row-card__subtitle">
					<span class="type-badge type-badge--{item.type}">{item.type}</span>
				</p>
				{#if rewardRowTags.length > 0}
					<div class="row-card__tags">
						{#each rewardRowTags as tag (tag.id)}
							{@const isActive = (item.tag_ids ?? []).includes(tag.id)}
							<button
								type="button"
								class="row-card__tag"
								class:row-card__tag--active={isActive}
								style="--tag-color: {tag.color}"
								onclick={() => toggleCardTag(item, tag.id)}
							>
								{tag.name}
							</button>
						{/each}
					</div>
				{/if}
			</div>
			<div class="row-card__actions">
				<Button size="sm" variant="ghost" onclick={() => openEdit(item)}>
					Edit
				</Button>
				<Button size="sm" variant="ghost" onclick={() => openDuplicate(item)}>
					Duplicate
				</Button>
				<Button size="sm" variant="danger" onclick={() => confirmDelete(item)}>
					Delete
				</Button>
			</div>
		</header>

		<div class="row-card__body">
			<div class="row-card__content-preview">
				<RewardRowPreview row={resolved} iconSize={28} />
			</div>

			<div class="row-card__preview" aria-label="Reward row image preview">
				{#if rowImageUrl}
					<img
						src={rowImageUrl}
						alt={`${item.name ?? 'Reward row'} PNG`}
						loading="lazy"
					/>
				{:else}
					<div class="row-card__preview-placeholder">No row PNG</div>
				{/if}
			</div>

			<div class="row-card__assignments">
				<div class="row-card__assignments-header">
					<span class="row-card__assignments-label">Assigned to ({rowAssignments.length})</span>
					<Button size="sm" variant="ghost" onclick={() => openAssignModal(item.id)}>
						+ Assign
					</Button>
				</div>
				{#if rowAssignments.length === 0}
					<p class="row-card__no-assignments">Not assigned to any location</p>
				{:else}
					<div class="row-card__assignment-list">
						{#each rowAssignments as a (a.id)}
							<div class="assignment-chip">
								<span>{a.locationName} (Slot {a.row_index + 1})</span>
								<button
									type="button"
									class="assignment-chip__remove"
									onclick={() => removeAssignment(a.id)}
									title="Remove assignment"
								>
									✕
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/snippet}

<!-- Create / Edit modal with inline content editing -->
<Modal bind:open={modal.isOpen} title={modal.isEditing ? 'Edit Reward Row' : 'New Reward Row'} size="lg">
	{#snippet children()}
		{#if formError}
			<div class="banner banner--error">{formError}</div>
		{/if}

		<FormField label="Name (optional)">
			<Input bind:value={modal.formData.name} placeholder="Row name..." />
		</FormField>

		<FormField label="Quantity">
			<Input type="number" bind:value={modal.formData.quantity} min={1} />
		</FormField>

		{#if rewardRowTags.length > 0}
			<FormField label="Tags">
				<div class="tag-picker">
					{#each rewardRowTags as tag (tag.id)}
						{@const isSelected = (modal.formData.tagIds ?? []).includes(tag.id)}
						<button
							type="button"
							class="tag-picker__pill"
							class:tag-picker__pill--active={isSelected}
							style="--tag-color: {tag.color}"
							onclick={() => toggleFormTag(tag.id)}
						>
							{tag.name}
						</button>
					{/each}
				</div>
			</FormField>
		{/if}

		<FormField label="Type" required>
			<Select
				options={typeOptions}
				value={editingRewardRow.type}
				onchange={(e) => setEditingType((e.target as HTMLSelectElement).value as 'gain' | 'trade' | 'text')}
			/>
		</FormField>

		<!-- Inline content editor (adapted from LocationRewardRowsEditor) -->
		<div class="content-editor">
			<h4 class="content-editor__title">Content</h4>

			{#if editingRewardRow.type === 'gain'}
				{@const gainTokens = editingRewardRow.gain_icon_ids ?? []}
				<div class="content-editor__icons">
					<div class="content-editor__section-title">Gain</div>
					{#if gainTokens.length === 0}
						<div class="content-editor__add-actions">
							<button type="button" class="content-editor__add-icon" onclick={() => (picking = { list: 'gain', mode: 'append' })}>
								+ Add Icons
							</button>
							<button type="button" class="content-editor__add-or" onclick={() => addOrSlot('gain')} disabled={remainingSlots(editingRewardRow, 'gain') < 2}>
								+ OR Slot
							</button>
						</div>
					{:else}
						<div class="content-editor__icon-list">
							{#each gainTokens as token, tokenIndex (tokenIndex)}
								<div class="content-editor__icon">
									<button type="button" class="content-editor__icon-edit" title="Edit slot" onclick={() => (picking = { list: 'gain', mode: 'edit', tokenIndex })}>
										✎
									</button>
									{#if typeof token === 'string'}
										{@const url = getIconPoolUrl(token)}
										{#if url}
											<img src={url} alt="Gain icon" />
										{:else}
											<span class="content-editor__icon-placeholder">?</span>
										{/if}
									{:else if isRewardOrIconToken(token)}
										{#if token.icon_ids.length === 0}
											<span class="content-editor__icon-placeholder">OR</span>
										{:else}
											<div class="content-editor__or-group">
												{#each token.icon_ids.slice(0, 4) as iconId, iconIdx (iconIdx)}
													{@const url = getIconPoolUrl(iconId)}
													{#if url}
														<img src={url} alt="OR icon" />
													{:else}
														<span class="content-editor__icon-placeholder">?</span>
													{/if}
													{#if iconIdx < Math.min(4, token.icon_ids.length) - 1}
														<span class="content-editor__or-slash">/</span>
													{/if}
												{/each}
											</div>
										{/if}
									{/if}
									<button type="button" class="content-editor__icon-remove" onclick={() => removeTokenAt('gain', tokenIndex)}>
										✕
									</button>
								</div>
							{/each}
							{#if remainingSlots(editingRewardRow, 'gain') > 0}
								<div class="content-editor__add-more-group">
									<button type="button" class="content-editor__add-more" onclick={() => (picking = { list: 'gain', mode: 'append' })}>+</button>
									<button type="button" class="content-editor__add-or-mini" onclick={() => addOrSlot('gain')} disabled={remainingSlots(editingRewardRow, 'gain') < 2}>OR</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>

			{:else if editingRewardRow.type === 'trade'}
				{@const costTokens = editingRewardRow.cost_icon_ids ?? []}
				{@const gainTokens = editingRewardRow.gain_icon_ids ?? []}
				<div class="content-editor__trade">
					<div class="content-editor__trade-col">
						<div class="content-editor__section-title">Spend</div>
						{#if costTokens.length === 0}
							<div class="content-editor__add-actions">
								<button type="button" class="content-editor__add-icon" onclick={() => (picking = { list: 'cost', mode: 'append' })}>+ Add Cost Icons</button>
								<button type="button" class="content-editor__add-or" onclick={() => addOrSlot('cost')} disabled={remainingSlots(editingRewardRow, 'cost') < 2}>+ OR Slot</button>
							</div>
						{:else}
							<div class="content-editor__icon-list">
								{#each costTokens as token, tokenIndex (tokenIndex)}
									<div class="content-editor__icon">
										<button type="button" class="content-editor__icon-edit" title="Edit slot" onclick={() => (picking = { list: 'cost', mode: 'edit', tokenIndex })}>✎</button>
										{#if typeof token === 'string'}
											{@const url = getIconPoolUrl(token)}
											{#if url}<img src={url} alt="Cost icon" />{:else}<span class="content-editor__icon-placeholder">?</span>{/if}
										{:else if isRewardOrIconToken(token)}
											{#if token.icon_ids.length === 0}
												<span class="content-editor__icon-placeholder">OR</span>
											{:else}
												<div class="content-editor__or-group">
													{#each token.icon_ids.slice(0, 4) as iconId, iconIdx (iconIdx)}
														{@const url = getIconPoolUrl(iconId)}
														{#if url}<img src={url} alt="OR icon" />{:else}<span class="content-editor__icon-placeholder">?</span>{/if}
														{#if iconIdx < Math.min(4, token.icon_ids.length) - 1}<span class="content-editor__or-slash">/</span>{/if}
													{/each}
												</div>
											{/if}
										{/if}
										<button type="button" class="content-editor__icon-remove" onclick={() => removeTokenAt('cost', tokenIndex)}>✕</button>
									</div>
								{/each}
								{#if remainingSlots(editingRewardRow, 'cost') > 0}
									<div class="content-editor__add-more-group">
										<button type="button" class="content-editor__add-more" onclick={() => (picking = { list: 'cost', mode: 'append' })}>+</button>
										<button type="button" class="content-editor__add-or-mini" onclick={() => addOrSlot('cost')} disabled={remainingSlots(editingRewardRow, 'cost') < 2}>OR</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<div class="content-editor__trade-arrow">→</div>

					<div class="content-editor__trade-col">
						<div class="content-editor__section-title">Gain</div>
						{#if gainTokens.length === 0}
							<div class="content-editor__add-actions">
								<button type="button" class="content-editor__add-icon" onclick={() => (picking = { list: 'gain', mode: 'append' })}>+ Add Reward Icons</button>
								<button type="button" class="content-editor__add-or" onclick={() => addOrSlot('gain')} disabled={remainingSlots(editingRewardRow, 'gain') < 2}>+ OR Slot</button>
							</div>
						{:else}
							<div class="content-editor__icon-list">
								{#each gainTokens as token, tokenIndex (tokenIndex)}
									<div class="content-editor__icon">
										<button type="button" class="content-editor__icon-edit" title="Edit slot" onclick={() => (picking = { list: 'gain', mode: 'edit', tokenIndex })}>✎</button>
										{#if typeof token === 'string'}
											{@const url = getIconPoolUrl(token)}
											{#if url}<img src={url} alt="Reward icon" />{:else}<span class="content-editor__icon-placeholder">?</span>{/if}
										{:else if isRewardOrIconToken(token)}
											{#if token.icon_ids.length === 0}
												<span class="content-editor__icon-placeholder">OR</span>
											{:else}
												<div class="content-editor__or-group">
													{#each token.icon_ids.slice(0, 4) as iconId, iconIdx (iconIdx)}
														{@const url = getIconPoolUrl(iconId)}
														{#if url}<img src={url} alt="OR icon" />{:else}<span class="content-editor__icon-placeholder">?</span>{/if}
														{#if iconIdx < Math.min(4, token.icon_ids.length) - 1}<span class="content-editor__or-slash">/</span>{/if}
													{/each}
												</div>
											{/if}
										{/if}
										<button type="button" class="content-editor__icon-remove" onclick={() => removeTokenAt('gain', tokenIndex)}>✕</button>
									</div>
								{/each}
								{#if remainingSlots(editingRewardRow, 'gain') > 0}
									<div class="content-editor__add-more-group">
										<button type="button" class="content-editor__add-more" onclick={() => (picking = { list: 'gain', mode: 'append' })}>+</button>
										<button type="button" class="content-editor__add-or-mini" onclick={() => addOrSlot('gain')} disabled={remainingSlots(editingRewardRow, 'gain') < 2}>OR</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

			{:else}
				<div class="content-editor__text">
					<div class="content-editor__section-title">Text</div>
					<Textarea
						rows={3}
						value={editingRewardRow.type === 'text' ? editingRewardRow.text : ''}
						placeholder="Enter row text..."
						oninput={(e) => {
							if (editingRewardRow.type === 'text') {
								editingRewardRow = { ...editingRewardRow, text: (e.currentTarget as HTMLTextAreaElement).value };
							}
						}}
					/>
				</div>
			{/if}

			<!-- Icon picker -->
			{#if picking && editingRewardRow.type !== 'text'}
				{@const tokenList = getTokens(editingRewardRow, picking.list)}
				{@const activeToken = picking.mode === 'edit' ? tokenList[(picking as any).tokenIndex] : null}
				{@const pickerSelected = picking.mode === 'edit'
					? (typeof activeToken === 'string'
						? [activeToken]
						: (activeToken && isRewardOrIconToken(activeToken) ? activeToken.icon_ids : []))
					: []}
				{@const pickerMax = (() => {
					if (picking.mode === 'append') return remainingSlots(editingRewardRow, picking.list);
					if (!activeToken || typeof activeToken === 'string' || !isRewardOrIconToken(activeToken)) return 1;
					const otherTokens = tokenList.filter((_, i) => i !== (picking as any).tokenIndex);
					const usedElsewhere = rewardIconTokensSlotsUsed(otherTokens);
					const budget = Math.max(0, maxFor(editingRewardRow, picking.list) - usedElsewhere);
					const currentCost = rewardIconTokenSlotCost(activeToken);
					return Math.min(4, Math.max(budget, currentCost));
				})()}
				{@const pickerMultiple = picking.mode === 'append' || (!!activeToken && isRewardOrIconToken(activeToken))}
				<div class="content-editor__picker">
					<IconPicker
						selected={pickerSelected}
						onselect={(ids) => {
							if (picking!.mode === 'append') {
								appendIcons(picking!.list, ids);
								return;
							}
							const token = tokenList[(picking as any).tokenIndex];
							if (typeof token === 'string') {
								const next = ids[0] ?? token;
								replaceTokenAt(picking!.list, (picking as any).tokenIndex, next);
								return;
							}
							if (token && isRewardOrIconToken(token)) {
								replaceTokenAt(picking!.list, (picking as any).tokenIndex, { kind: 'or', icon_ids: ids });
							}
						}}
						multiple={pickerMultiple}
						maxSelection={pickerMax}
						allowDuplicates={true}
					/>
					<Button variant="secondary" onclick={() => (picking = null)}>Done</Button>
				</div>
			{/if}
		</div>
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={() => { modal.close(); picking = null; }} disabled={saving}>
			Cancel
		</Button>
		<Button variant="primary" onclick={handleSave} loading={saving} disabled={saving}>
			{modal.isEditing ? 'Save Changes' : 'Create Row'}
		</Button>
	{/snippet}
</Modal>

<!-- Assignment modal -->
<Modal bind:open={showAssignModal} title="Assign to Location" size="sm">
	{#snippet children()}
		{#if assignError}
			<div class="banner banner--error">{assignError}</div>
		{/if}

		<FormField label="Location" required>
			<Select
				options={locationOptions}
				bind:value={assignLocationId}
				placeholder="Select location..."
			/>
		</FormField>
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showAssignModal = false)} disabled={assignSaving}>Cancel</Button>
		<Button variant="primary" onclick={handleAssign} loading={assignSaving} disabled={assignSaving}>Assign</Button>
	{/snippet}
</Modal>

<!-- Tag Manager -->
<TagManager
	bind:isOpen={showTagManager}
	tags={rewardRowTags}
	on:save={handleSaveTag}
	on:delete={handleDeleteTag}
	on:close={() => (showTagManager = false)}
/>

<!-- Delete confirmation -->
<ConfirmDialog
	bind:open={showDeleteConfirm}
	title="Delete Reward Row"
	message={deleteTarget
		? `Delete "${deleteTarget.name ?? 'Untitled'}"? This will also remove all location assignments.`
		: 'Delete this reward row?'}
	confirmLabel={deleting ? 'Deleting...' : 'Delete'}
	variant="danger"
	onconfirm={handleDelete}
	oncancel={() => {
		deleteTarget = null;
	}}
/>

<style>
	.banner {
		padding: 0.75rem 1rem;
		margin: 0 0 0.5rem;
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

	.banner--info {
		border-color: rgba(96, 165, 250, 0.35);
		background: rgba(96, 165, 250, 0.12);
		color: #bfdbfe;
	}

	.placeholder {
		display: grid;
		place-items: center;
		min-height: 240px;
		color: #94a3b8;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		color: #94a3b8;
		gap: 0.5rem;
	}

	.empty-state__icon {
		font-size: 2.5rem;
	}

	.tag-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.tag-section + .tag-section {
		margin-top: 1.25rem;
	}

	.tag-section__header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tag-section__badge {
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		font-size: 0.8rem;
		font-weight: 700;
		background: color-mix(in srgb, var(--tag-color) 18%, transparent);
		border: 1px solid var(--tag-color);
		color: var(--tag-color);
	}

	.tag-section__badge--untagged {
		--tag-color: #64748b;
	}

	.tag-section__count {
		font-size: 0.75rem;
		color: #64748b;
		font-weight: 600;
	}

	.tag-section__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr));
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.tag-section__grid {
			grid-template-columns: 1fr;
		}
	}

	.row-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(15, 23, 42, 0.55);
		box-shadow: 0 10px 20px rgba(2, 6, 23, 0.25);
	}

	.row-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.row-card__title-wrap h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.row-card__subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.type-badge {
		display: inline-block;
		padding: 0.1rem 0.45rem;
		border-radius: 6px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.type-badge--gain {
		background: rgba(74, 222, 128, 0.15);
		color: #4ade80;
		border: 1px solid rgba(74, 222, 128, 0.3);
	}

	.type-badge--trade {
		background: rgba(251, 191, 36, 0.15);
		color: #fbbf24;
		border: 1px solid rgba(251, 191, 36, 0.3);
	}

	.type-badge--text {
		background: rgba(96, 165, 250, 0.15);
		color: #60a5fa;
		border: 1px solid rgba(96, 165, 250, 0.3);
	}

	.row-card__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-top: 0.25rem;
	}

	.row-card__tag {
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: transparent;
		color: #64748b;
		font-size: 0.7rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0.45;
	}

	.row-card__tag:hover {
		opacity: 0.8;
		border-color: var(--tag-color);
		color: var(--tag-color);
	}

	.row-card__tag--active {
		opacity: 1;
		background: color-mix(in srgb, var(--tag-color) 18%, transparent);
		border-color: var(--tag-color);
		color: var(--tag-color);
	}

	.tag-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.tag-picker__pill {
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		border: 1px solid var(--tag-color, #6b7280);
		background: transparent;
		color: #94a3b8;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.tag-picker__pill:hover {
		background: color-mix(in srgb, var(--tag-color) 15%, transparent);
		color: var(--tag-color);
	}

	.tag-picker__pill--active {
		background: color-mix(in srgb, var(--tag-color) 20%, transparent);
		color: var(--tag-color);
		border-color: var(--tag-color);
	}

	.row-card__actions {
		display: flex;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.row-card__body {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.row-card__content-preview {
		padding: 0.35rem;
	}

	.row-card__preview {
		border: 1px solid rgba(148, 163, 184, 0.22);
		border-radius: 0.65rem;
		min-height: 48px;
		background: rgba(2, 6, 23, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem;
		overflow: hidden;
	}

	.row-card__preview img {
		max-width: 100%;
		max-height: 120px;
		object-fit: contain;
		display: block;
	}

	.row-card__preview-placeholder {
		font-size: 0.78rem;
		color: #64748b;
	}

	.row-card__assignments {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.row-card__assignments-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.row-card__assignments-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.row-card__no-assignments {
		margin: 0;
		font-size: 0.78rem;
		color: #64748b;
	}

	.row-card__assignment-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.assignment-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.5rem;
		border-radius: 8px;
		background: rgba(96, 165, 250, 0.12);
		border: 1px solid rgba(96, 165, 250, 0.3);
		color: #93c5fd;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.assignment-chip__remove {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: none;
		background: rgba(248, 113, 113, 0.7);
		color: white;
		font-size: 0.55rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.assignment-chip__remove:hover {
		opacity: 1;
	}

	/* Content editor styles (adapted from LocationRewardRowsEditor) */
	.content-editor {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.content-editor__title {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #e2e8f0;
	}

	.content-editor__section-title {
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.content-editor__icons,
	.content-editor__text {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.content-editor__add-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.content-editor__add-icon,
	.content-editor__add-or {
		width: 100%;
		padding: 0.75rem;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.content-editor__add-icon:hover,
	.content-editor__add-or:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
	}

	.content-editor__add-or:disabled,
	.content-editor__add-more:disabled,
	.content-editor__add-or-mini:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.content-editor__icon-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.content-editor__icon {
		position: relative;
		width: 40px;
		height: 40px;
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.5);
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.content-editor__icon > img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.content-editor__or-group {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		gap: 0;
		padding: 0.1rem;
	}

	.content-editor__or-group img {
		width: 12px;
		height: 12px;
		object-fit: contain;
	}

	.content-editor__or-slash {
		color: rgba(226, 232, 240, 0.9);
		font-weight: 800;
		font-size: 1.1rem;
		line-height: 1;
		margin: 0 0.16rem;
	}

	.content-editor__icon-placeholder {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		color: #64748b;
	}

	.content-editor__icon-remove {
		position: absolute;
		top: -4px;
		right: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		background: rgba(248, 113, 113, 0.9);
		color: white;
		font-size: 0.6rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.content-editor__icon:hover .content-editor__icon-remove {
		opacity: 1;
	}

	.content-editor__icon-edit {
		position: absolute;
		top: -4px;
		left: -4px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: none;
		background: rgba(96, 165, 250, 0.9);
		color: white;
		font-size: 0.6rem;
		cursor: pointer;
		display: grid;
		place-items: center;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.content-editor__icon:hover .content-editor__icon-edit {
		opacity: 1;
	}

	.content-editor__add-more-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.content-editor__add-more,
	.content-editor__add-or-mini {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		font-size: 1.25rem;
		display: grid;
		place-items: center;
		transition: all 0.15s;
	}

	.content-editor__add-or-mini {
		font-size: 0.8rem;
		font-weight: 700;
	}

	.content-editor__add-more:hover,
	.content-editor__add-or-mini:hover {
		border-color: rgba(96, 165, 250, 0.75);
		color: #93c5fd;
	}

	.content-editor__trade {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 0.75rem;
		align-items: start;
	}

	.content-editor__trade-col {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.content-editor__trade-arrow {
		color: #94a3b8;
		font-weight: 700;
		padding-top: 1.6rem;
	}

	.content-editor__picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.15);
	}

	@media (max-width: 720px) {
		.content-editor__trade {
			grid-template-columns: 1fr;
		}

		.content-editor__trade-arrow {
			display: none;
		}
	}
</style>
