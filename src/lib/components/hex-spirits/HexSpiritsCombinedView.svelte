<script lang="ts">
	import type { HexSpiritRow, MatItemRow, LookupService } from '$lib/types/gameData';
	import { isAwakenOrRuneToken } from '$lib/utils/awakenRuneTokens';
	import { supabase } from '$lib/api/supabaseClient';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';
	import { normalizeLanguageCode, normalizeOptionalText } from '$lib/i18n/translations';
	import { useMultiSelect } from '$lib/composables';

	type HexSpirit = HexSpiritRow & {
		game_print_image_url: string | null;
		art_raw_image_url: string | null;
	};

	type SortColumn =
		| 'name'
		| 'cost'
		| 'primary_origin'
		| 'primary_class'
		| 'runes';
	type SortDirection = 'asc' | 'desc';

	interface Props {
		spirits: HexSpirit[];
		originLookup: LookupService;
		classLookup: LookupService;
		runes: MatItemRow[];
		onEdit: (spirit: HexSpirit) => void;
		onDelete: (spirit: HexSpirit) => void;
		onDeleteMultiple?: (ids: string[]) => void;
	}

	let { spirits, originLookup, classLookup, runes, onEdit, onDelete, onDeleteMultiple }: Props =
		$props();

	// Sort state
	let sortColumn: SortColumn = $state('name');
	let sortDirection: SortDirection = $state('asc');

	// Inline edit state
	let nameLanguage: string = $state('primary');
	let editingId: string | null = $state(null);
	let editValue: string = $state('');
	let savingById: Record<string, boolean> = $state({});
	let errorById: Record<string, string | null> = $state({});
	let nameOverrideById: Record<string, string | undefined> = $state({});
	let translationOverrideById: Record<string, Record<string, string | null> | undefined> =
		$state({});

	const selection = useMultiSelect();

	const LANGUAGE_LABELS: Record<string, string> = {
		primary: 'Primary',
		'zh-Hans': 'Chinese (Simplified)',
		'zh-Hant': 'Chinese (Traditional)',
		de: 'German',
		fr: 'French',
		es: 'Spanish',
		it: 'Italian',
		ja: 'Japanese',
		pl: 'Polish',
		ko: 'Korean'
	};

	// --- Helpers ---

	function primaryOriginId(spirit: HexSpiritRow | HexSpirit): string | null {
		return spirit.traits?.origin_ids?.[0] ?? null;
	}

	function primaryClassId(spirit: HexSpiritRow | HexSpirit): string | null {
		return spirit.traits?.class_ids?.[0] ?? null;
	}

	function calculateOriginCounts(spirit: HexSpirit): Record<string, number> {
		return (
			spirit.traits?.origin_ids?.reduce(
				(acc, id) => {
					acc[id] = (acc[id] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			) ?? {}
		);
	}

	function calculateClassCounts(spirit: HexSpirit): Record<string, number> {
		return (
			spirit.traits?.class_ids?.reduce(
				(acc, id) => {
					acc[id] = (acc[id] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			) ?? {}
		);
	}

	function getNameTranslation(spirit: HexSpiritRow, lang: string): string | null {
		if (lang === 'primary') return spirit.name;
		const normalizedLang = normalizeLanguageCode(lang);

		const overrides = translationOverrideById[spirit.id];
		if (overrides) {
			if (lang in overrides) {
				const direct = overrides[lang];
				if (typeof direct === 'string') return normalizeOptionalText(direct);
				if (direct === null) return null;
			}
			for (const [key, value] of Object.entries(overrides)) {
				if (normalizeLanguageCode(key) !== normalizedLang) continue;
				if (typeof value !== 'string') continue;
				return normalizeOptionalText(value);
			}
		}

		const translations = (spirit as { name_translations?: unknown }).name_translations;
		if (!translations || typeof translations !== 'object' || Array.isArray(translations))
			return null;
		const v = (translations as Record<string, unknown>)[lang];
		if (typeof v === 'string') return normalizeOptionalText(v);
		for (const [key, value] of Object.entries(translations as Record<string, unknown>)) {
			if (normalizeLanguageCode(key) !== normalizedLang) continue;
			if (typeof value !== 'string') continue;
			return normalizeOptionalText(value);
		}
		return null;
	}

	function getDisplayName(spirit: HexSpiritRow): string {
		const nameOverride = nameOverrideById[spirit.id];
		if (typeof nameOverride === 'string' && nameOverride.trim().length > 0)
			return nameOverride.trim();
		return getNameTranslation(spirit, nameLanguage) ?? spirit.name;
	}

	function getCurrentEditableName(spirit: HexSpiritRow): string {
		if (nameLanguage === 'primary') return getDisplayName(spirit);
		return getNameTranslation(spirit, nameLanguage) ?? '';
	}

	// --- Sorting ---

	function handleSort(column: SortColumn) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	const sortedSpirits = $derived.by(() => {
		const sorted = [...spirits].sort((a, b) => {
			let aValue: any;
			let bValue: any;

			switch (sortColumn) {
				case 'name':
					aValue = getDisplayName(a).toLowerCase();
					bValue = getDisplayName(b).toLowerCase();
					break;
				case 'cost':
					aValue = a.cost;
					bValue = b.cost;
					break;
				case 'primary_origin':
					aValue = originLookup.getLabel(primaryOriginId(a), '').toLowerCase();
					bValue = originLookup.getLabel(primaryOriginId(b), '').toLowerCase();
					break;
				case 'primary_class':
					aValue = classLookup.getLabel(primaryClassId(a), '').toLowerCase();
					bValue = classLookup.getLabel(primaryClassId(b), '').toLowerCase();
					break;
				case 'runes':
					aValue =
						a.awaken_condition?.type === 'rune_cost'
							? (a.awaken_condition.rune_ids?.length ?? 0)
							: 0;
					bValue =
						b.awaken_condition?.type === 'rune_cost'
							? (b.awaken_condition.rune_ids?.length ?? 0)
							: 0;
					break;
				default:
					return 0;
			}

			if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
			if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});
		return sorted;
	});

	const availableNameLanguages = $derived.by(() => {
		const langs = new Set<string>([
			'primary',
			...Object.keys(LANGUAGE_LABELS).filter((k) => k !== 'primary')
		]);
		for (const spirit of spirits) {
			const translations = (spirit as { name_translations?: unknown }).name_translations;
			if (!translations || typeof translations !== 'object' || Array.isArray(translations))
				continue;
			for (const k of Object.keys(translations as Record<string, unknown>)) {
				const lang = k.trim();
				if (lang) langs.add(lang);
			}
		}
		const out = [...langs];
		out.sort((a, b) => {
			if (a === 'primary') return -1;
			if (b === 'primary') return 1;
			const la = LANGUAGE_LABELS[a] ?? a;
			const lb = LANGUAGE_LABELS[b] ?? b;
			return la.localeCompare(lb);
		});
		return out;
	});

	// --- Inline edit ---

	function startInlineEdit(spirit: HexSpiritRow) {
		editingId = spirit.id;
		editValue = getCurrentEditableName(spirit);
		errorById = { ...errorById, [spirit.id]: null };
	}

	function cancelInlineEdit() {
		editingId = null;
		editValue = '';
	}

	async function saveInlineEdit(spirit: HexSpiritRow) {
		const id = spirit.id;
		if (savingById[id]) return;

		const next = editValue.trim();
		if (nameLanguage === 'primary' && next.length === 0) {
			errorById = { ...errorById, [id]: 'Name cannot be empty.' };
			return;
		}

		savingById = { ...savingById, [id]: true };
		errorById = { ...errorById, [id]: null };

		try {
			if (nameLanguage === 'primary') {
				const { error } = await supabase
					.from('hex_spirits')
					.update({ name: next, updated_at: new Date().toISOString() })
					.eq('id', id);
				if (error) throw error;
				nameOverrideById = { ...nameOverrideById, [id]: next };
			} else {
				const existing = (spirit as { name_translations?: unknown }).name_translations;
				const base =
					existing && typeof existing === 'object' && !Array.isArray(existing)
						? ({ ...(existing as Record<string, unknown>) } as Record<string, unknown>)
						: {};

				const normalizedTarget = normalizeLanguageCode(nameLanguage);
				for (const key of Object.keys(base)) {
					if (normalizeLanguageCode(key) !== normalizedTarget) continue;
					delete base[key];
				}
				if (next.length > 0) base[nameLanguage] = next;

				const cleaned: Record<string, string> = {};
				for (const [k, v] of Object.entries(base)) {
					if (typeof v === 'string' && v.trim().length > 0) cleaned[k] = v.trim();
				}

				const { error } = await supabase
					.from('hex_spirits')
					.update({ name_translations: cleaned, updated_at: new Date().toISOString() })
					.eq('id', id);
				if (error) throw error;

				const existingOverrides = translationOverrideById[id] ?? {};
				translationOverrideById = {
					...translationOverrideById,
					[id]: { ...existingOverrides, [nameLanguage]: next.length === 0 ? null : next }
				};
			}

			cancelInlineEdit();
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errorById = { ...errorById, [id]: message };
		} finally {
			savingById = { ...savingById, [id]: false };
		}
	}

	async function deleteSelected() {
		if (selection.selectedCount === 0) return;
		if (!confirm(`Delete ${selection.selectedCount} selected item(s)?`)) return;

		if (onDeleteMultiple) {
			onDeleteMultiple(Array.from(selection.selectedIds));
		} else {
			for (const id of selection.selectedIds) {
				const spirit = spirits.find((s) => s.id === id);
				if (spirit) onDelete(spirit);
			}
		}
		selection.deselectAll();
	}
</script>

<MultiSelectBar
	selectedCount={selection.selectedCount}
	totalCount={spirits.length}
	onSelectAll={() => selection.selectAll(spirits.map((s) => s.id))}
	onDeselectAll={selection.deselectAll}
	onDeleteSelected={deleteSelected}
/>

<div class="combined-view">
	{#if spirits.length === 0}
		<div class="empty-state">No spirits to display.</div>
	{:else}
		<div class="table-toolbar">
			<label class="toolbar-label">
				Name Language
				<select class="toolbar-select" bind:value={nameLanguage}>
					{#each availableNameLanguages as lang (lang)}
						<option value={lang}>{LANGUAGE_LABELS[lang] ?? lang}</option>
					{/each}
				</select>
			</label>
		</div>

		<div class="table-scroll">
			<table class="combined-table">
				<thead>
					<tr>
						<th class="col-select">
							<input
								type="checkbox"
								checked={selection.selectedCount === spirits.length && spirits.length > 0}
								onchange={() => {
									if (selection.selectedCount === spirits.length) selection.deselectAll();
									else selection.selectAll(spirits.map((s) => s.id));
								}}
							/>
						</th>
						<th class="col-thumb">Img</th>
						<th
							class="col-name sortable"
							onclick={() => handleSort('name')}
						>
							Name
							{#if nameLanguage !== 'primary'}
								<span class="lang-tag">({LANGUAGE_LABELS[nameLanguage] ?? nameLanguage})</span>
							{/if}
							{#if sortColumn === 'name'}
								<span class="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>
							{/if}
						</th>
						<th
							class="col-cost sortable"
							onclick={() => handleSort('cost')}
						>
							Cost
							{#if sortColumn === 'cost'}
								<span class="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>
							{/if}
						</th>
						<th
							class="col-origins sortable"
							onclick={() => handleSort('primary_origin')}
						>
							Origins
							{#if sortColumn === 'primary_origin'}
								<span class="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>
							{/if}
						</th>
						<th
							class="col-classes sortable"
							onclick={() => handleSort('primary_class')}
						>
							Classes
							{#if sortColumn === 'primary_class'}
								<span class="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>
							{/if}
						</th>
						<th
							class="col-awaken sortable"
							onclick={() => handleSort('runes')}
						>
							Awaken
							{#if sortColumn === 'runes'}
								<span class="sort-arrow">{sortDirection === 'asc' ? '▲' : '▼'}</span>
							{/if}
						</th>
						<th class="col-actions"></th>
					</tr>
				</thead>
				<tbody>
					{#each sortedSpirits as spirit (spirit.id)}
						{@const originCounts = calculateOriginCounts(spirit)}
						{@const classCounts = calculateClassCounts(spirit)}
						{@const isSelected = selection.isSelected(spirit.id)}
						{@const isEditing = editingId === spirit.id}
						<tr
							class="data-row"
							class:selected={isSelected}
							onclick={() => onEdit(spirit)}
						>
							<!-- Checkbox -->
							<td class="col-select" onclick={(e) => e.stopPropagation()}>
								<input
									type="checkbox"
									checked={isSelected}
									onchange={() => selection.toggle(spirit.id)}
								/>
							</td>

							<!-- Thumbnail -->
							<td class="col-thumb">
								{#if spirit.game_print_image_url}
									<img
										class="thumb"
										src={spirit.game_print_image_url}
										alt=""
										loading="lazy"
									/>
								{:else}
									<div class="thumb thumb--empty"></div>
								{/if}
							</td>

							<!-- Name (inline edit) -->
							<td class="col-name" onclick={(e) => e.stopPropagation()}>
								{#if isEditing}
									<div class="name-edit">
										<input
											class="name-input"
											type="text"
											bind:value={editValue}
											placeholder={nameLanguage === 'primary' ? 'Name' : 'Translation'}
											onkeydown={(e) => {
												if (e.key === 'Enter') void saveInlineEdit(spirit);
												if (e.key === 'Escape') cancelInlineEdit();
											}}
										/>
										<button
											type="button"
											class="inline-btn inline-btn--save"
											disabled={savingById[spirit.id]}
											onclick={() => void saveInlineEdit(spirit)}
										>
											{savingById[spirit.id] ? '…' : '✓'}
										</button>
										<button
											type="button"
											class="inline-btn"
											onclick={cancelInlineEdit}
											disabled={savingById[spirit.id]}
										>
											✕
										</button>
									</div>
									{#if errorById[spirit.id]}
										<div class="name-error">{errorById[spirit.id]}</div>
									{/if}
								{:else}
									<button
										type="button"
										class="name-display"
										ondblclick={() => startInlineEdit(spirit)}
										onclick={(e) => { e.stopPropagation(); onEdit(spirit); }}
									>
										{getDisplayName(spirit)}
									</button>
								{/if}
							</td>

							<!-- Cost -->
							<td class="col-cost">{spirit.cost}</td>

							<!-- Origins -->
							<td class="col-origins">
								{#if Object.keys(originCounts).length > 0}
									<div class="badges">
										{#each Object.entries(originCounts) as [originId, count]}
											<span class="badge badge--origin">
												{originLookup.getLabel(originId, '?')}
												{#if count > 1}×{count}{/if}
											</span>
										{/each}
									</div>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>

							<!-- Classes -->
							<td class="col-classes">
								{#if Object.keys(classCounts).length > 0}
									<div class="badges">
										{#each Object.entries(classCounts) as [classId, count]}
											<span class="badge badge--class">
												{classLookup.getLabel(classId, '?')}
												{#if count > 1}×{count}{/if}
											</span>
										{/each}
									</div>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>

							<!-- Awaken -->
							<td class="col-awaken">
								{#if spirit.awaken_condition?.type === 'rune_cost'}
									<div class="badges">
										{#each spirit.awaken_condition.rune_ids as token}
											{#if typeof token === 'string'}
												{@const rune = runes.find((r) => r.id === token)}
												{#if rune}
													<span class="badge badge--rune">{rune.name}</span>
												{/if}
											{:else if isAwakenOrRuneToken(token)}
												<span class="badge badge--rune">
													{(token.rune_ids ?? []).map((id) => runes.find((r) => r.id === id)?.name ?? '?').join(' / ')}
												</span>
											{/if}
										{/each}
									</div>
								{:else if spirit.awaken_condition?.type === 'text'}
									<span class="awaken-text">{spirit.awaken_condition.text}</span>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>

							<!-- Actions -->
							<td class="col-actions" onclick={(e) => e.stopPropagation()}>
								<CardActionMenu
									onEdit={() => onEdit(spirit)}
									onDelete={() => onDelete(spirit)}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.combined-view {
		width: 100%;
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.1);
	}

	.empty-state {
		padding: 3rem;
		text-align: center;
		color: #94a3b8;
		font-size: 0.875rem;
	}

	.table-toolbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.toolbar-label {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		color: rgba(226, 232, 240, 0.8);
		font-size: 0.7rem;
		white-space: nowrap;
	}

	.toolbar-select {
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #e2e8f0;
		font-size: 0.7rem;
	}

	.table-scroll {
		width: 100%;
		overflow-x: auto;
	}

	.combined-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.72rem;
		line-height: 1.3;
	}

	/* Header */
	.combined-table thead {
		position: sticky;
		top: 0;
		z-index: 10;
		background: rgba(30, 41, 59, 0.95);
		backdrop-filter: blur(8px);
	}

	.combined-table thead tr {
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.combined-table th {
		padding: 0.35rem 0.4rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.7rem;
		color: #cbd5e1;
		white-space: nowrap;
		user-select: none;
	}

	.combined-table th.sortable {
		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.combined-table th.sortable:hover {
		background-color: rgba(99, 102, 241, 0.1);
	}

	.sort-arrow {
		margin-left: 0.2rem;
		color: #a5b4fc;
		font-size: 0.65rem;
	}

	.lang-tag {
		font-weight: 400;
		color: #94a3b8;
		font-size: 0.65rem;
	}

	/* Rows */
	.combined-table tbody tr {
		border-bottom: 1px solid rgba(148, 163, 184, 0.06);
		transition: background-color 0.1s ease;
	}

	.combined-table tbody tr:hover {
		background: rgba(99, 102, 241, 0.08);
		cursor: pointer;
	}

	.combined-table tbody tr.selected {
		background: rgba(99, 102, 241, 0.14);
	}

	.combined-table td {
		padding: 0.3rem 0.4rem;
		color: #e2e8f0;
		vertical-align: middle;
	}

	/* Column widths */
	.col-select {
		width: 28px;
		text-align: center;
	}

	.col-select input[type='checkbox'] {
		width: 14px;
		height: 14px;
		cursor: pointer;
		accent-color: #6366f1;
	}

	.col-thumb {
		width: 40px;
	}

	.thumb {
		width: 32px;
		height: 32px;
		border-radius: 3px;
		object-fit: cover;
		display: block;
	}

	.thumb--empty {
		background: rgba(148, 163, 184, 0.1);
		border: 1px dashed rgba(148, 163, 184, 0.2);
	}

	.col-name {
		min-width: 160px;
		font-weight: 500;
		color: #f1f5f9;
	}

	.name-display {
		background: none;
		border: none;
		color: #f1f5f9;
		font-weight: 500;
		font-size: 0.72rem;
		cursor: pointer;
		padding: 0;
		text-align: left;
	}

	.name-display:hover {
		text-decoration: underline;
		text-decoration-color: rgba(165, 180, 252, 0.4);
	}

	.name-edit {
		display: flex;
		align-items: center;
		gap: 0.3rem;
	}

	.name-input {
		flex: 1;
		min-width: 0;
		padding: 0.2rem 0.35rem;
		border-radius: 4px;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #e2e8f0;
		font-size: 0.72rem;
	}

	.inline-btn {
		padding: 0.15rem 0.3rem;
		border-radius: 3px;
		background: rgba(148, 163, 184, 0.12);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #e2e8f0;
		font-size: 0.65rem;
		cursor: pointer;
		line-height: 1;
	}

	.inline-btn:hover {
		background: rgba(148, 163, 184, 0.2);
	}

	.inline-btn:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.inline-btn--save {
		background: rgba(34, 197, 94, 0.14);
		border-color: rgba(34, 197, 94, 0.25);
		color: #86efac;
	}

	.inline-btn--save:hover {
		background: rgba(34, 197, 94, 0.22);
	}

	.name-error {
		margin-top: 0.15rem;
		color: rgba(248, 113, 113, 0.95);
		font-size: 0.65rem;
	}

	.col-cost {
		width: 44px;
		text-align: center;
		font-weight: 600;
		color: #fbbf24;
	}

	.col-origins,
	.col-classes {
		max-width: 160px;
	}

	.col-awaken {
		max-width: 150px;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		font-size: 0.6rem;
		font-weight: 500;
		padding: 0.1rem 0.3rem;
		border-radius: 2px;
		line-height: 1.2;
		white-space: nowrap;
	}

	.badge--origin {
		background: rgba(236, 72, 153, 0.18);
		color: #f9a8d4;
		border: 1px solid rgba(236, 72, 153, 0.25);
	}

	.badge--class {
		background: rgba(59, 130, 246, 0.18);
		color: #93c5fd;
		border: 1px solid rgba(59, 130, 246, 0.25);
	}

	.badge--rune {
		background: rgba(168, 85, 247, 0.18);
		color: #d8b4fe;
		border: 1px solid rgba(168, 85, 247, 0.25);
	}

	.awaken-text {
		color: #d8b4fe;
		font-size: 0.65rem;
		font-style: italic;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.muted {
		color: #475569;
	}

	.col-actions {
		width: 32px;
	}

	@media (max-width: 768px) {
		.combined-table {
			font-size: 0.68rem;
		}

		.combined-table th,
		.combined-table td {
			padding: 0.25rem 0.3rem;
		}

		.col-origins,
		.col-classes,
		.col-awaken {
			display: none;
		}
	}
</style>
