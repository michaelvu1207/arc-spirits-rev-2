<script lang="ts">
	import type { ClassRow } from '$lib/types/gameData';
	import type { Effect, EffectBreakpoint } from '$lib/types/effects';
	import { parseEffectSchema, formatEffectSummary } from '$lib/features/classes/classes';
	import { BASE_LANGUAGE, type TranslationLanguage, getTranslationValue } from '$lib/i18n/translations';

	interface Props {
		classes: ClassRow[];
		diceNameById: Map<string, string>;
		onEdit: (cls: ClassRow) => void;
		language?: TranslationLanguage;
	}

	let { classes, diceNameById, onEdit, language = BASE_LANGUAGE }: Props = $props();

	function getClassName(entry: ClassRow): string {
		if (language === BASE_LANGUAGE) return entry.name;
		return getTranslationValue(entry.name_translations, String(language)) ?? entry.name;
	}

	const resolveDiceLabel = (id: string | null | undefined, fallback?: string) => {
		if (id && diceNameById.has(id)) return diceNameById.get(id) ?? fallback ?? 'Custom Dice';
		return fallback ?? (id ?? 'Custom Dice');
	};

	const summarizeEffect = (effect: Effect) => formatEffectSummary(effect, resolveDiceLabel, language);

	function getBreakpointCount(bp: EffectBreakpoint): string | number {
		if (language === BASE_LANGUAGE) return bp.count;
		if (typeof bp.count !== 'string') return bp.count;
		return getTranslationValue((bp as any).count_translations, String(language)) ?? bp.count;
	}

	function getEffectSummary(schema: EffectBreakpoint[]): string {
		if (!schema.length) return 'No effects';
		return schema
			.map((bp) => {
				const effects = bp.effects.map(summarizeEffect).join(', ');
				return `(${getBreakpointCount(bp)}) ${effects}`;
			})
			.join(' | ');
	}

	let sortColumn = $state<keyof ClassRow | null>(null);
	let sortAsc = $state(true);

	function toggleSort(column: keyof ClassRow) {
		if (sortColumn === column) {
			sortAsc = !sortAsc;
		} else {
			sortColumn = column;
			sortAsc = true;
		}
	}

	const sortedClasses = $derived(() => {
		if (!sortColumn) return classes;
		const col = sortColumn;
		return [...classes].sort((a, b) => {
			if (col === 'name') {
				const aName = getClassName(a);
				const bName = getClassName(b);
				return sortAsc ? aName.localeCompare(bName) : bName.localeCompare(aName);
			}
			const aVal = a[col];
			const bVal = b[col];
			if (aVal == null && bVal == null) return 0;
			if (aVal == null) return sortAsc ? 1 : -1;
			if (bVal == null) return sortAsc ? -1 : 1;

			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			}
			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return sortAsc ? aVal - bVal : bVal - aVal;
			}
			return 0;
		});
	});
</script>

<div class="table-container">
	<table class="classes-table">
		<thead>
			<tr>
				<th onclick={() => toggleSort('name')} class:sorted={sortColumn === 'name'}>
					Name {language === BASE_LANGUAGE ? '' : `(${language})`} {sortColumn === 'name' ? (sortAsc ? '▲' : '▼') : ''}
				</th>
				<th onclick={() => toggleSort('position')} class:sorted={sortColumn === 'position'}>
					Position {sortColumn === 'position' ? (sortAsc ? '▲' : '▼') : ''}
				</th>
				<th>Icon</th>
				<th>Tags</th>
				<th>Effects</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedClasses() as cls (cls.id)}
				{@const effectSchema = parseEffectSchema(cls.effect_schema)}
				<tr>
					<td class="name-cell">{getClassName(cls)}</td>
					<td class="position-cell">{cls.position}</td>
					<td class="icon-cell">{cls.icon_emoji ?? '🛡️'}</td>
					<td class="tags-cell">
						{#if Array.isArray(cls.tags) && cls.tags.length}
							{cls.tags.join(', ')}
						{:else}
							<span class="empty">No tags</span>
						{/if}
					</td>
					<td class="effects-cell">{getEffectSummary(effectSchema)}</td>
					<td class="actions-cell">
						<button class="edit-btn" onclick={() => onEdit(cls)}>Edit</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-container {
		width: 100%;
		overflow-x: auto;
	}

	.classes-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
	}

	.classes-table thead {
		background: rgba(15, 23, 42, 0.8);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.classes-table th {
		padding: 0.4rem;
		text-align: left;
		font-weight: 600;
		color: #cbd5e1;
		border-bottom: 2px solid rgba(148, 163, 184, 0.3);
		cursor: pointer;
		user-select: none;
		white-space: nowrap;
	}

	.classes-table th:hover {
		background: rgba(59, 130, 246, 0.1);
	}

	.classes-table th.sorted {
		color: #60a5fa;
	}

	.classes-table tbody tr {
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
	}

	.classes-table tbody tr:hover {
		background: rgba(59, 130, 246, 0.05);
	}

	.classes-table td {
		padding: 0.4rem;
		color: #e2e8f0;
	}

	.name-cell {
		font-weight: 600;
		color: #cbd5e1;
		white-space: nowrap;
	}

	.position-cell {
		text-align: center;
		color: #94a3b8;
	}

	.icon-cell {
		text-align: center;
		font-size: 1rem;
	}

	.tags-cell {
		color: #94a3b8;
		font-size: 0.65rem;
	}

	.tags-cell .empty {
		font-style: italic;
		color: #64748b;
	}

	.effects-cell {
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 0.7rem;
		color: #cbd5e1;
	}

	.actions-cell {
		text-align: right;
		white-space: nowrap;
	}

	.edit-btn {
		padding: 0.2rem 0.4rem;
		background: rgba(59, 130, 246, 0.2);
		border: 1px solid rgba(59, 130, 246, 0.3);
		border-radius: 4px;
		color: #93c5fd;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.edit-btn:hover {
		background: rgba(59, 130, 246, 0.35);
		border-color: rgba(59, 130, 246, 0.5);
	}
</style>
