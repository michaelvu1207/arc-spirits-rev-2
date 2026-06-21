<script lang="ts">
	import type { MatItemRow, LookupService } from '$lib/types/gameData';

	type Props = {
		mats: MatItemRow[];
		originLookup: LookupService;
		publicUrl: (path: string) => string;
		onEdit?: (mat: MatItemRow) => void;
		onDelete?: (mat: MatItemRow) => void;
	};

	let { mats, originLookup, publicUrl, onEdit, onDelete }: Props = $props();

	function getMatCategory(mat: MatItemRow): string {
		if (mat.origin_id) return originLookup.getLabel(mat.origin_id, 'Unknown Origin');
		return 'Unassigned';
	}

	function getMatKindLabel(mat: MatItemRow): string {
		return mat.kind === 'relic' ? 'Relic' : 'Rune';
	}

	function getMatColor(mat: MatItemRow): string {
		if (mat.origin_id) {
			const origin = originLookup.get(mat.origin_id);
			return origin?.color ?? '#a5b4fc';
		}
		return mat.kind === 'relic' ? '#fbbf24' : '#64748b';
	}
</script>

{#if mats.length === 0}
	<div class="empty-state">No mats available.</div>
{:else}
	<div class="gallery-grid">
		{#each mats as mat (mat.id)}
			{@const color = getMatColor(mat)}
			<article class="mat-card" style="--accent-color: {color}">
				<div class="image-container">
					{#if mat.icon_path}
						<img src={publicUrl(mat.icon_path)} alt={mat.name} />
					{:else}
						<div class="no-image">No Icon</div>
					{/if}
				</div>
				<div class="info">
					<h3 class="name">{mat.name}</h3>
					<div class="category">
						<span class="kind-badge {mat.kind}">
							{getMatKindLabel(mat)}
						</span>
						<span class="category-name" style="color: {color}">{getMatCategory(mat)}</span>
					</div>
				</div>
				{#if onEdit || onDelete}
					<div class="actions">
						{#if onEdit}
							<button class="btn-action" onclick={() => onEdit(mat)} title="Edit">
								✏️
							</button>
						{/if}
						{#if onDelete}
							<button class="btn-action btn-delete" onclick={() => onDelete(mat)} title="Delete">
								🗑️
							</button>
						{/if}
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}

<style>
	.empty-state {
		padding: 2rem;
		text-align: center;
		color: #64748b;
		font-size: 0.85rem;
	}

	.gallery-grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	}

	.mat-card {
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 10px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		transition: all 0.2s;
		position: relative;
	}

	.mat-card:hover {
		border-color: var(--accent-color, rgba(148, 163, 184, 0.3));
		background: rgba(15, 23, 42, 0.7);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.image-container {
		width: 100%;
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6));
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.1);
		overflow: hidden;
	}

	.image-container img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		padding: 0.25rem;
	}

	.no-image {
		color: #475569;
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.name {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: #f1f5f9;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.category {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-wrap: wrap;
	}

	.kind-badge {
		display: inline-block;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.55rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.kind-badge.rune {
		background: rgba(165, 180, 252, 0.2);
		color: #a5b4fc;
	}

	.kind-badge.relic {
		background: rgba(251, 191, 36, 0.2);
		color: #fbbf24;
	}

	.category-name {
		font-size: 0.6rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		gap: 0.25rem;
		position: absolute;
		top: 0.35rem;
		right: 0.35rem;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.mat-card:hover .actions {
		opacity: 1;
	}

	.btn-action {
		background: rgba(15, 23, 42, 0.9);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		padding: 0.2rem 0.35rem;
		cursor: pointer;
		font-size: 0.65rem;
		transition: all 0.15s;
	}

	.btn-action:hover {
		background: rgba(30, 41, 59, 0.95);
		border-color: rgba(148, 163, 184, 0.4);
	}

	.btn-delete:hover {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.4);
	}
</style>
