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

	function getClassTypeLabel(entry: ClassRow): string {
		const type = entry.class_type ?? (entry.is_special ? 'special' : 'normal');
		if (type === 'human') return 'Human';
		if (type === 'special') return 'Special';
		return 'Normal';
	}

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

	// Maps a subtag to its parent tag. Subtags roll up into the parent's bar and
	// render indented beneath it in the distribution chart.
	const TAG_HIERARCHY: Record<string, string> = {
		'Augment Economy': 'Economic'
	};

	const tagDistribution = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const cls of classes) {
			if (!Array.isArray(cls.tags)) continue;
			for (const raw of cls.tags) {
				const tag = String(raw).trim();
				if (!tag) continue;
				counts.set(tag, (counts.get(tag) ?? 0) + 1);
			}
		}

		const childrenByParent = new Map<string, string[]>();
		for (const [child, parent] of Object.entries(TAG_HIERARCHY)) {
			if (!childrenByParent.has(parent)) childrenByParent.set(parent, []);
			childrenByParent.get(parent)!.push(child);
		}

		// Top-level tags: every counted tag that isn't a subtag, plus any parent
		// referenced in the hierarchy (so a parent shows even with no direct uses).
		const topNames = new Set<string>();
		for (const tag of counts.keys()) if (!(tag in TAG_HIERARCHY)) topNames.add(tag);
		for (const parent of childrenByParent.keys()) topNames.add(parent);

		const rows: { tag: string; value: number; own: number; depth: number }[] = [];
		const tops = Array.from(topNames)
			.map((tag) => {
				const own = counts.get(tag) ?? 0;
				const children = (childrenByParent.get(tag) ?? [])
					.filter((c) => (counts.get(c) ?? 0) > 0)
					.sort((a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b));
				const childTotal = children.reduce((sum, c) => sum + (counts.get(c) ?? 0), 0);
				return { tag, own, total: own + childTotal, children };
			})
			.filter((t) => t.total > 0)
			.sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));

		for (const t of tops) {
			rows.push({ tag: t.tag, value: t.total, own: t.own, depth: 0 });
			for (const child of t.children) {
				rows.push({ tag: child, value: counts.get(child)!, own: counts.get(child)!, depth: 1 });
			}
		}
		return rows;
	});

	const maxTagCount = $derived(
		tagDistribution.reduce((max, entry) => Math.max(max, entry.value), 0)
	);

	const untaggedCount = $derived(
		classes.filter((cls) => !Array.isArray(cls.tags) || cls.tags.filter((t) => String(t).trim()).length === 0).length
	);

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

<section class="tag-chart" aria-label="Tag distribution">
	<header class="tag-chart__header">
		<h3>Tag Distribution</h3>
		<span class="tag-chart__meta">
			{tagDistribution.length} tag{tagDistribution.length === 1 ? '' : 's'} across {classes.length} class{classes.length === 1 ? '' : 'es'}
			{#if untaggedCount > 0}
				· {untaggedCount} untagged
			{/if}
		</span>
	</header>
	{#if tagDistribution.length === 0}
		<p class="tag-chart__empty">No tags have been assigned to any class yet.</p>
	{:else}
		<ul class="tag-chart__bars">
			{#each tagDistribution as row (row.tag)}
				<li class="tag-chart__row" class:is-sub={row.depth > 0}>
					<span class="tag-chart__label" title={row.tag}>
						{#if row.depth > 0}<span class="tag-chart__branch" aria-hidden="true">↳</span>{/if}{row.tag}
					</span>
					<span class="tag-chart__track">
						<span
							class="tag-chart__fill"
							class:is-sub={row.depth > 0}
							style="width: {maxTagCount ? (row.value / maxTagCount) * 100 : 0}%"
						></span>
					</span>
					<span class="tag-chart__count">{row.value}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<div class="table-container">
	<table class="classes-table">
		<thead>
				<tr>
					<th onclick={() => toggleSort('name')} class:sorted={sortColumn === 'name'}>
						Name {language === BASE_LANGUAGE ? '' : `(${language})`} {sortColumn === 'name' ? (sortAsc ? '▲' : '▼') : ''}
					</th>
					<th onclick={() => toggleSort('class_type')} class:sorted={sortColumn === 'class_type'}>
						Type {sortColumn === 'class_type' ? (sortAsc ? '▲' : '▼') : ''}
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
						<td>{getClassTypeLabel(cls)}</td>
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

	.tag-chart {
		margin-bottom: 1rem;
		padding: 0.75rem 1rem;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 8px;
	}

	.tag-chart__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}

	.tag-chart__header h3 {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.tag-chart__meta {
		font-size: 0.7rem;
		color: #94a3b8;
	}

	.tag-chart__empty {
		margin: 0;
		font-size: 0.75rem;
		font-style: italic;
		color: #64748b;
	}

	.tag-chart__bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.tag-chart__row {
		display: grid;
		grid-template-columns: minmax(80px, 160px) 1fr auto;
		align-items: center;
		gap: 0.6rem;
	}

	.tag-chart__label {
		font-size: 0.7rem;
		color: #e2e8f0;
		text-align: right;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tag-chart__row.is-sub .tag-chart__label {
		color: #94a3b8;
		font-size: 0.65rem;
	}

	.tag-chart__branch {
		margin-right: 0.25rem;
		color: #64748b;
	}

	.tag-chart__fill.is-sub {
		background: linear-gradient(90deg, rgba(94, 234, 212, 0.35), rgba(45, 212, 191, 0.75));
	}

	.tag-chart__track {
		height: 0.7rem;
		background: rgba(148, 163, 184, 0.12);
		border-radius: 4px;
		overflow: hidden;
	}

	.tag-chart__fill {
		display: block;
		height: 100%;
		min-width: 2px;
		background: linear-gradient(90deg, rgba(59, 130, 246, 0.5), rgba(96, 165, 250, 0.9));
		border-radius: 4px;
		transition: width 0.2s ease;
	}

	.tag-chart__count {
		font-size: 0.7rem;
		font-weight: 600;
		color: #93c5fd;
		min-width: 1.5rem;
		text-align: right;
	}
</style>
