<script lang="ts">
	import type { GuardianRow, ArtifactRow } from '$lib/types/gameData';

	type ArtifactSummary = Pick<ArtifactRow, 'id' | 'name' | 'benefit' | 'recipe_box' | 'guardian_id'>;

	type GuardianLanguage = 'base' | string;
	const BASE_LANGUAGE: GuardianLanguage = 'base';

	interface Props {
		guardians: GuardianRow[];
		language?: GuardianLanguage;
		origins: Array<{ id: string; name: string }>;
		artifactsByGuardian: Record<string, ArtifactSummary[]>;
		onEdit: (guardian: GuardianRow) => void;
	}

	let { guardians, origins, artifactsByGuardian, onEdit, language = BASE_LANGUAGE }: Props = $props();

	function normalizeOptionalText(value: string | null | undefined): string | null {
		const trimmed = (value ?? '').trim();
		return trimmed.length > 0 ? trimmed : null;
	}

	function normalizeLanguageCode(value: string): string {
		return value.trim().replace(/_/g, '-').toLowerCase();
	}

	function getTranslationValue(input: unknown, lang: string): string | null {
		if (!lang || lang === BASE_LANGUAGE) return null;
		if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
		const record = input as Record<string, unknown>;
		const direct = record[lang];
		if (typeof direct === 'string') return normalizeOptionalText(direct);
		for (const [key, value] of Object.entries(record)) {
			if (normalizeLanguageCode(key) !== lang) continue;
			if (typeof value !== 'string') continue;
			return normalizeOptionalText(value);
		}
		return null;
	}

	function guardianDisplayName(guardian: GuardianRow): string {
		if (language === BASE_LANGUAGE) return guardian.name;
		return getTranslationValue(guardian.name_translations, language) ?? guardian.name;
	}

	const originName = (originId: string) =>
		origins.find((o) => o.id === originId)?.name ?? 'Unknown';

	const artifactsFor = (guardianId: string) => artifactsByGuardian[guardianId] ?? [];
</script>

<div class="table-container">
	<table class="data-table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Origin</th>
				<th>Artifacts</th>
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
					<td class="artifacts-cell">
						{#if artifactsFor(guardian.id).length}
							<ul>
								{#each artifactsFor(guardian.id) as artifact}
									<li>{artifact.name}</li>
								{/each}
							</ul>
						{:else}
							<span class="muted">None</span>
						{/if}
					</td>
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
					<td colspan="5" class="empty">No guardians found.</td>
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

	.artifacts-cell ul {
		margin: 0;
		padding: 0 0 0 1rem;
		font-size: 0.65rem;
	}

	.artifacts-cell li {
		margin: 0.1rem 0;
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
