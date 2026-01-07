<script lang="ts">
	import type { HexSpiritRow, RuneRow } from '$lib/types/gameData';
	import { supabase } from '$lib/api/supabaseClient';

	type SortColumn =
		| 'name'
		| 'cost'
		| 'primary_origin'
		| 'primary_class'
		| 'total_origins'
		| 'total_classes'
		| 'runes'
		| 'has_game_print'
		| 'has_art'
		| 'updated_at';
	type SortDirection = 'asc' | 'desc';

	interface Lookup {
		getLabel(id: string | null, defaultValue?: string): string;
	}

	interface Props {
		spirits: HexSpiritRow[];
		originLookup: Lookup;
		classLookup: Lookup;
		runes: RuneRow[];
		onEdit: (spirit: HexSpiritRow) => void;
	}

	let { spirits, originLookup, classLookup, runes, onEdit }: Props = $props();

	let sortColumn: SortColumn = $state('name');
	let sortDirection: SortDirection = $state('asc');
	let nameLanguage: string = $state('primary');
	let editingId: string | null = $state(null);
	let editValue: string = $state('');
	let savingById: Record<string, boolean> = $state({});
	let errorById: Record<string, string | null> = $state({});

	// Optimistic overrides so the table updates immediately after save.
	let nameOverrideById: Record<string, string | undefined> = $state({});
	let translationOverrideById: Record<string, Record<string, string | null> | undefined> = $state({});

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

	function normalizeLanguageCode(value: string): string {
		return value.trim().replace(/_/g, '-').toLowerCase();
	}

	function normalizeOptionalText(value: string | null | undefined): string | null {
		const trimmed = (value ?? '').trim();
		return trimmed.length > 0 ? trimmed : null;
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
		if (!translations || typeof translations !== 'object' || Array.isArray(translations)) return null;
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
		if (typeof nameOverride === 'string' && nameOverride.trim().length > 0) return nameOverride.trim();
		return getNameTranslation(spirit, nameLanguage) ?? spirit.name;
	}

	function getCurrentEditableName(spirit: HexSpiritRow): string {
		if (nameLanguage === 'primary') return getDisplayName(spirit);
		return getNameTranslation(spirit, nameLanguage) ?? '';
	}

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

				// Avoid duplicate keys across different casing/formatting (e.g. `zh-Hans` vs `zh-hans`).
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

	function isEditing(spirit: HexSpiritRow): boolean {
		return editingId === spirit.id;
	}

	function primaryOriginId(spirit: HexSpiritRow): string | null {
		return spirit.traits?.origin_ids?.[0] ?? null;
	}

	function primaryClassId(spirit: HexSpiritRow): string | null {
		return spirit.traits?.class_ids?.[0] ?? null;
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'N/A';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return 'Invalid date';
		}
	}

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
				case 'total_origins':
					aValue = a.traits?.origin_ids?.length ?? 0;
					bValue = b.traits?.origin_ids?.length ?? 0;
					break;
				case 'total_classes':
					aValue = a.traits?.class_ids?.length ?? 0;
					bValue = b.traits?.class_ids?.length ?? 0;
					break;
				case 'runes':
					aValue = a.rune_cost?.length ?? 0;
					bValue = b.rune_cost?.length ?? 0;
					break;
				case 'has_game_print':
					aValue = a.game_print_image_path ? 1 : 0;
					bValue = b.game_print_image_path ? 1 : 0;
					break;
				case 'has_art':
					aValue = a.art_raw_image_path ? 1 : 0;
					bValue = b.art_raw_image_path ? 1 : 0;
					break;
				case 'updated_at':
					aValue = a.updated_at ? new Date(a.updated_at).getTime() : 0;
					bValue = b.updated_at ? new Date(b.updated_at).getTime() : 0;
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
		const langs = new Set<string>(['primary', ...Object.keys(LANGUAGE_LABELS).filter((k) => k !== 'primary')]);
		for (const spirit of spirits) {
			const translations = (spirit as { name_translations?: unknown }).name_translations;
			if (!translations || typeof translations !== 'object' || Array.isArray(translations)) continue;
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

	const isEmpty = $derived(spirits.length === 0);
</script>

<div class="table-container">
	{#if isEmpty}
		<div class="empty-state">
			<div class="empty-state__icon">📊</div>
			<p class="empty-state__message">No spirits to display.</p>
		</div>
	{:else}
		<div class="table-toolbar">
			<label class="table-toolbar__label">
				Name Language
				<select class="table-toolbar__select" bind:value={nameLanguage}>
					{#each availableNameLanguages as lang (lang)}
						<option value={lang}>{LANGUAGE_LABELS[lang] ?? lang}</option>
					{/each}
				</select>
			</label>
		</div>
		<table class="spirits-table">
			<thead>
				<tr>
					<th class="sortable" onclick={() => handleSort('name')}>
						Name {nameLanguage === 'primary' ? '' : `(${LANGUAGE_LABELS[nameLanguage] ?? nameLanguage})`}
						{#if sortColumn === 'name'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('cost')}>
						Cost
						{#if sortColumn === 'cost'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('primary_origin')}>
						Primary Origin
						{#if sortColumn === 'primary_origin'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('primary_class')}>
						Primary Class
						{#if sortColumn === 'primary_class'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('total_origins')}>
						Total Origins
						{#if sortColumn === 'total_origins'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('total_classes')}>
						Total Classes
						{#if sortColumn === 'total_classes'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('runes')}>
						Runes
						{#if sortColumn === 'runes'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('has_game_print')}>
						Has Game Print
						{#if sortColumn === 'has_game_print'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('has_art')}>
						Has Art
						{#if sortColumn === 'has_art'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
					<th class="sortable" onclick={() => handleSort('updated_at')}>
						Updated
						{#if sortColumn === 'updated_at'}
							<span class="sort-indicator">{sortDirection === 'asc' ? '▲' : '▼'}</span>
						{/if}
					</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedSpirits as spirit (spirit.id)}
					<tr class="data-row" onclick={() => onEdit(spirit)}>
						<td class="cell-name" onclick={(e) => e.stopPropagation()}>
							<div class="name-cell">
								{#if isEditing(spirit)}
									<input
										class="name-cell__input"
										type="text"
										bind:value={editValue}
										placeholder={nameLanguage === 'primary' ? 'Name' : 'Translation (optional)'}
										onkeydown={(e) => {
											if (e.key === 'Enter') void saveInlineEdit(spirit);
											if (e.key === 'Escape') cancelInlineEdit();
										}}
									/>
									<button
										type="button"
										class="name-cell__btn name-cell__btn--primary"
										disabled={savingById[spirit.id]}
										onclick={() => void saveInlineEdit(spirit)}
									>
										{savingById[spirit.id] ? 'Saving…' : 'Save'}
									</button>
									<button type="button" class="name-cell__btn" onclick={cancelInlineEdit} disabled={savingById[spirit.id]}>
										Cancel
									</button>
								{:else}
									<span class="name-cell__value">{getDisplayName(spirit)}</span>
									<button type="button" class="name-cell__btn" onclick={() => startInlineEdit(spirit)}>
										Edit
									</button>
								{/if}
							</div>
							{#if errorById[spirit.id]}
								<div class="name-cell__error">{errorById[spirit.id]}</div>
							{/if}
						</td>
						<td class="cell-center">{spirit.cost}</td>
						<td>{originLookup.getLabel(primaryOriginId(spirit), 'Unassigned')}</td>
						<td>{classLookup.getLabel(primaryClassId(spirit), 'None')}</td>
						<td class="cell-center">{spirit.traits?.origin_ids?.length ?? 0}</td>
						<td class="cell-center">{spirit.traits?.class_ids?.length ?? 0}</td>
						<td class="cell-center">{spirit.rune_cost?.length ?? 0}</td>
						<td class="cell-center">
							<span class="status-badge" class:status-badge--yes={spirit.game_print_image_path}></span>
						</td>
						<td class="cell-center">
							<span class="status-badge" class:status-badge--yes={spirit.art_raw_image_path}></span>
						</td>
						<td>{formatDate(spirit.updated_at)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<style>
	.table-container {
		width: 100%;
		overflow-x: auto;
		background: rgba(15, 23, 42, 0.3);
		border: 1px solid rgba(148, 163, 184, 0.1);
		min-height: 300px;
	}

	.table-toolbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		gap: 0.5rem;
	}

	.table-toolbar__label {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: rgba(226, 232, 240, 0.8);
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.table-toolbar__select {
		padding: 0.25rem 0.45rem;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #e2e8f0;
		font-size: 0.75rem;
	}

	.name-cell {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 240px;
	}

	.name-cell__value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.name-cell__input {
		flex: 1;
		min-width: 0;
		padding: 0.25rem 0.4rem;
		border-radius: 6px;
		background: rgba(15, 23, 42, 0.7);
		border: 1px solid rgba(148, 163, 184, 0.2);
		color: #e2e8f0;
		font-size: 0.75rem;
	}

	.name-cell__btn {
		padding: 0.22rem 0.45rem;
		border-radius: 6px;
		background: rgba(148, 163, 184, 0.12);
		border: 1px solid rgba(148, 163, 184, 0.18);
		color: #e2e8f0;
		font-size: 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	.name-cell__btn:hover {
		background: rgba(148, 163, 184, 0.18);
	}

	.name-cell__btn:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.name-cell__btn--primary {
		background: rgba(34, 197, 94, 0.14);
		border-color: rgba(34, 197, 94, 0.25);
	}

	.name-cell__btn--primary:hover {
		background: rgba(34, 197, 94, 0.18);
	}

	.name-cell__error {
		margin-top: 0.2rem;
		color: rgba(248, 113, 113, 0.95);
		font-size: 0.7rem;
	}

	.spirits-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
		line-height: 1.3;
	}

	.spirits-table thead {
		position: sticky;
		top: 0;
		z-index: 10;
		background: rgba(30, 41, 59, 0.95);
		backdrop-filter: blur(8px);
	}

	.spirits-table thead tr {
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.spirits-table th {
		padding: 0.4rem;
		text-align: left;
		font-weight: 600;
		font-size: 0.8rem;
		color: #cbd5e1;
		white-space: nowrap;
		user-select: none;
	}

	.spirits-table th.sortable {
		cursor: pointer;
		transition: background-color 0.1s ease;
	}

	.spirits-table th.sortable:hover {
		background-color: rgba(99, 102, 241, 0.1);
	}

	.sort-indicator {
		margin-left: 0.25rem;
		color: #a5b4fc;
		font-size: 0.7rem;
	}

	.spirits-table tbody tr {
		border-bottom: 1px solid rgba(148, 163, 184, 0.08);
		transition: background-color 0.1s ease;
	}

	.spirits-table tbody tr:hover {
		background: rgba(99, 102, 241, 0.1);
		cursor: pointer;
	}

	.spirits-table td {
		padding: 0.4rem;
		color: #e2e8f0;
		vertical-align: middle;
	}

	.cell-name {
		font-weight: 500;
		color: #f1f5f9;
	}

	.cell-center {
		text-align: center;
	}

	.status-badge {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(248, 113, 113, 0.8);
	}

	.status-badge--yes {
		background: rgba(74, 222, 128, 0.8);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		text-align: center;
		min-height: 300px;
	}

	.empty-state__icon {
		font-size: 4rem;
		line-height: 1;
		margin-bottom: 1rem;
		opacity: 0.6;
	}

	.empty-state__message {
		margin: 0;
		color: #94a3b8;
		font-size: 1.05rem;
		max-width: 400px;
	}

	@media (max-width: 768px) {
		.spirits-table {
			font-size: 0.7rem;
		}

		.spirits-table th,
		.spirits-table td {
			padding: 0.3rem;
		}
	}
</style>
