<script lang="ts">
	import type { OriginRow } from '$lib/types/gameData';
	import { publicAssetUrl } from '$lib/utils';

	type Props = {
		origins: OriginRow[];
		onEdit: (origin: OriginRow) => void;
		onToggleEnabled?: (origin: OriginRow, enabled: boolean) => void;
	};

	let { origins, onEdit, onToggleEnabled }: Props = $props();

	type SortKey = 'name' | 'position' | 'color';
	type SortDirection = 'asc' | 'desc';

	let sortKey = $state<SortKey>('position');
	let sortDirection = $state<SortDirection>('asc');

	const sortedOrigins = $derived(
		[...origins].sort((a, b) => {
			let aVal: string | number = a[sortKey] ?? '';
			let bVal: string | number = b[sortKey] ?? '';

			if (sortKey === 'position') {
				aVal = Number(aVal);
				bVal = Number(bVal);
			}

			if (typeof aVal === 'string' && typeof bVal === 'string') {
				aVal = aVal.toLowerCase();
				bVal = bVal.toLowerCase();
			}

			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		})
	);

	function handleSort(key: SortKey) {
		if (sortKey === key) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDirection = 'asc';
		}
	}

	function getIconUrl(path: string | null | undefined, updatedAt?: string | number | null): string | null {
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}
</script>

<div class="table-container">
	<table class="data-table">
		<thead>
			<tr>
				<th>Icon</th>
				<th class="sortable" onclick={() => handleSort('name')}>
					Name {sortKey === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
				</th>
				<th class="sortable" onclick={() => handleSort('position')}>
					Position {sortKey === 'position' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
				</th>
				<th class="sortable" onclick={() => handleSort('color')}>
					Color {sortKey === 'color' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
				</th>
				<th>Description</th>
				<th class="actions-col">Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedOrigins as origin (origin.id)}
				<tr onclick={() => onEdit(origin)}>
					<td class="icon-col">
						{#if getIconUrl(origin.icon_png, origin.updated_at)}
							<img
								class="icon-image"
								src={getIconUrl(origin.icon_png, origin.updated_at)}
								alt={`${origin.name} icon`}
							/>
						{:else if origin.icon_emoji}
							<span class="icon-emoji">{origin.icon_emoji}</span>
						{/if}
					</td>
					<td class="name-col">{origin.name}</td>
					<td class="position-col">{origin.position}</td>
					<td class="color-col">
						{#if origin.color}
							<span class="color-preview">
								<span class="swatch" style={`background:${origin.color}`}></span>
								{origin.color}
							</span>
						{/if}
					</td>
					<td class="description-col">{origin.description || ''}</td>
					<td class="actions-col">
						<button class="edit-btn" onclick={(e) => { e.stopPropagation(); onEdit(origin); }}>
							Edit
						</button>
						{#if onToggleEnabled}
							<button
								class="toggle-btn"
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									onToggleEnabled(origin, origin.is_enabled === false);
								}}
							>
								{origin.is_enabled === false ? 'Enable' : 'Disable'}
							</button>
						{/if}
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="empty">No origins found</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-container {
		width: 100%;
		overflow-x: auto;
		background: rgba(30, 41, 59, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 8px;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.75rem;
	}

	thead {
		background: rgba(15, 23, 42, 0.5);
		position: sticky;
		top: 0;
		z-index: 1;
	}

	th {
		padding: 0.4rem 0.5rem;
		text-align: left;
		font-weight: 600;
		color: #94a3b8;
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	th.sortable {
		cursor: pointer;
		user-select: none;
	}

	th.sortable:hover {
		color: #cbd5e1;
	}

	tbody tr {
		border-bottom: 1px solid rgba(148, 163, 184, 0.08);
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	tbody tr:hover {
		background: rgba(59, 130, 246, 0.08);
	}

	td {
		padding: 0.4rem 0.5rem;
		color: #e2e8f0;
	}

	.icon-col {
		width: 40px;
		text-align: center;
	}

	.icon-image {
		width: 20px;
		height: 20px;
		object-fit: contain;
		border-radius: 3px;
	}

	.icon-emoji {
		font-size: 1.2rem;
	}

	.name-col {
		font-weight: 500;
		min-width: 120px;
	}

	.position-col {
		width: 80px;
		color: #94a3b8;
	}

	.color-col {
		width: 120px;
	}

	.color-preview {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		color: #cbd5e1;
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid rgba(148, 163, 184, 0.4);
	}

	.description-col {
		color: #cbd5e1;
		max-width: 300px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions-col {
		width: 130px;
		text-align: center;
		display: flex;
		gap: 0.3rem;
		justify-content: center;
		align-items: center;
	}

	.edit-btn {
		padding: 0.2rem 0.4rem;
		background: rgba(59, 130, 246, 0.3);
		border: 1px solid rgba(59, 130, 246, 0.5);
		border-radius: 4px;
		color: #93c5fd;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.edit-btn:hover {
		background: rgba(59, 130, 246, 0.4);
		border-color: rgba(59, 130, 246, 0.7);
	}

	.toggle-btn {
		padding: 0.2rem 0.4rem;
		background: rgba(100, 116, 139, 0.25);
		border: 1px solid rgba(148, 163, 184, 0.5);
		border-radius: 4px;
		color: #cbd5e1;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-btn:hover {
		background: rgba(100, 116, 139, 0.35);
		border-color: rgba(148, 163, 184, 0.75);
	}

	.empty {
		text-align: center;
		padding: 1.5rem;
		color: #64748b;
	}
</style>
