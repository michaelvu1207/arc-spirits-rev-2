<script lang="ts">
	import type { MatItemRow, LookupService } from '$lib/types/gameData';
	import Button from '$lib/components/ui/Button.svelte';

	type Props = {
		mats: MatItemRow[];
		originLookup: LookupService;
		onEdit: (mat: MatItemRow) => void;
	};

	let { mats, originLookup, onEdit }: Props = $props();

	type SortKey = 'name' | 'kind' | 'category';
	let sortKey = $state<SortKey>('name');
	let sortAsc = $state(true);

	function getMatCategory(mat: MatItemRow): string {
		if (mat.origin_id) return originLookup.getLabel(mat.origin_id, 'Unknown Origin');
		return 'Unassigned';
	}

	function getMatKindLabel(mat: MatItemRow): string {
		return mat.kind === 'relic' ? 'Relic' : 'Rune';
	}

	const sortedMats = $derived(() => {
		const sorted = [...mats];
		sorted.sort((a, b) => {
			let aVal: string;
			let bVal: string;

			if (sortKey === 'name') {
				aVal = a.name.toLowerCase();
				bVal = b.name.toLowerCase();
			} else if (sortKey === 'kind') {
				aVal = getMatKindLabel(a);
				bVal = getMatKindLabel(b);
			} else {
				aVal = getMatCategory(a).toLowerCase();
				bVal = getMatCategory(b).toLowerCase();
			}

			if (aVal < bVal) return sortAsc ? -1 : 1;
			if (aVal > bVal) return sortAsc ? 1 : -1;
			return 0;
		});
		return sorted;
	});

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = true;
		}
	}

	function getSortIcon(key: SortKey): string {
		if (sortKey !== key) return '⇅';
		return sortAsc ? '↑' : '↓';
	}
</script>

{#if mats.length === 0}
	<div class="empty-state">No mats match the current filters.</div>
{:else}
	<div class="table-container">
		<table class="mat-table">
			<thead>
				<tr>
					<th>
						<button class="sort-btn" onclick={() => toggleSort('name')}>
							Name {getSortIcon('name')}
						</button>
					</th>
					<th>
						<button class="sort-btn" onclick={() => toggleSort('kind')}>
							Kind {getSortIcon('kind')}
						</button>
					</th>
					<th>
						<button class="sort-btn" onclick={() => toggleSort('category')}>
							Category {getSortIcon('category')}
						</button>
					</th>
					<th class="actions-col">Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedMats() as mat (mat.id)}
					<tr>
						<td class="name-col">{mat.name}</td>
						<td class="kind-col">
							<span class="kind-badge {mat.kind}">
								{getMatKindLabel(mat)}
							</span>
						</td>
						<td class="category-col">{getMatCategory(mat)}</td>
						<td class="actions-col">
							<Button variant="ghost" size="sm" onclick={() => onEdit(mat)}>Edit</Button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.empty-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.table-container {
		overflow-x: auto;
		background: rgba(30, 41, 59, 0.2);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 6px;
	}

	.mat-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	.mat-table thead {
		background: rgba(15, 23, 42, 0.6);
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.mat-table th {
		padding: 0.4rem 0.5rem;
		text-align: left;
		font-weight: 600;
		color: #94a3b8;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.mat-table td {
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.05);
		color: #cbd5e1;
	}

	.mat-table tbody tr:hover {
		background: rgba(30, 41, 59, 0.4);
	}

	.sort-btn {
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		padding: 0;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		transition: color 0.2s;
	}

	.sort-btn:hover {
		color: #e2e8f0;
	}

	.name-col {
		font-weight: 500;
		color: #e2e8f0;
	}

	.kind-col,
	.category-col {
		font-size: 0.7rem;
	}

	.kind-badge {
		display: inline-block;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
	}

	.kind-badge.rune {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.kind-badge.relic {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.actions-col {
		width: 80px;
		text-align: right;
	}
</style>
