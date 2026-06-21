<script lang="ts">
	import type { GuardianRow } from '$lib/types/gameData';
	import { normalizeOptionalText, normalizeLanguageCode, getTranslationValue } from '$lib/i18n/translations';

	type GuardianLanguage = 'base' | string;
	const BASE_LANGUAGE: GuardianLanguage = 'base';

	interface Props {
		guardians: GuardianRow[];
		language?: GuardianLanguage;
		origins: Array<{ id: string; name: string }>;
		onEdit: (guardian: GuardianRow) => void;
	}

	let { guardians, origins, onEdit, language = BASE_LANGUAGE }: Props = $props();

	function guardianDisplayName(guardian: GuardianRow): string {
		if (language === BASE_LANGUAGE) return guardian.name;
		return getTranslationValue(guardian.name_translations, language) ?? guardian.name;
	}

	const originName = (originId: string) =>
		origins.find((o) => o.id === originId)?.name ?? 'Unknown';
</script>

<div class="table-container">
	<table class="data-table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Origin</th>
				<th>Images</th>
				<th>Actions</th>
			</tr>
		</thead>
		<tbody>
			{#each guardians as guardian (guardian.id)}
				{@const displayName = guardianDisplayName(guardian)}
				<tr>
					<td class="name-cell">{displayName}</td>
					<td class="origin-cell">{originName(guardian.origin_id)}</td>
					<td class="images-cell">
						{#if guardian.image_mat_path}✅{:else}⬜{/if}
						{#if guardian.chibi_image_path}✅{:else}⬜{/if}
						{#if guardian.icon_image_path}✅{:else}⬜{/if}
					</td>
					<td class="actions-cell">
						<button class="btn-edit" onclick={() => onEdit(guardian)}>Edit</button>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="4" class="empty">No guardians found.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.table-container {
		overflow-x: auto;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.7rem;
	}

	.data-table thead {
		background: rgba(15, 23, 42, 0.6);
		border-bottom: 1px solid rgba(148, 163, 184, 0.2);
	}

	.data-table th {
		padding: 0.5rem;
		text-align: left;
		font-weight: 600;
		color: #cbd5e1;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		font-size: 0.65rem;
	}

	.data-table td {
		padding: 0.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		color: #e2e8f0;
	}

	.data-table tbody tr:hover {
		background: rgba(30, 41, 59, 0.3);
	}

	.name-cell {
		font-weight: 600;
		color: #f8fafc;
	}

	.origin-cell {
		color: #a5b4fc;
	}

	.images-cell {
		font-size: 0.8rem;
		text-align: center;
	}

	.actions-cell {
		text-align: center;
	}

	.btn-edit {
		background: rgba(79, 70, 229, 0.15);
		border: 1px solid rgba(129, 140, 248, 0.25);
		border-radius: 6px;
		padding: 0.25rem 0.5rem;
		color: #c7d2fe;
		cursor: pointer;
		font-size: 0.7rem;
	}

	.btn-edit:hover {
		background: rgba(79, 70, 229, 0.25);
	}

	.muted {
		color: #64748b;
		font-style: italic;
	}

	.empty {
		text-align: center;
		color: #64748b;
		padding: 1rem;
	}
</style>
