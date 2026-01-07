<script lang="ts">
	import type { HexSpiritRow, RuneRow } from '$lib/types/gameData';

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

	function getNameTranslation(spirit: HexSpiritRow, lang: string): string | null {
		if (lang === 'primary') return spirit.name;
		const translations = (spirit as { name_translations?: unknown }).name_translations;
		if (!translations || typeof translations !== 'object' || Array.isArray(translations)) return null;
		const v = (translations as Record<string, unknown>)[lang];
		return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
	}

	function getDisplayName(spirit: HexSpiritRow): string {
		return getNameTranslation(spirit, nameLanguage) ?? spirit.name;
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
						<td class="cell-name">{getDisplayName(spirit)}</td>
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
