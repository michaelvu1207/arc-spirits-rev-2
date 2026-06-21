<script lang="ts">
	import type { GuardianRow } from '$lib/types/gameData';
	import CardActionMenu from '$lib/components/CardActionMenu.svelte';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';
	import { Button } from '$lib/components/ui';
	import { publicAssetUrl } from '$lib/utils';
	import { normalizeOptionalText, normalizeLanguageCode, getTranslationValue } from '$lib/i18n/translations';

	type GuardianLanguage = 'base' | string;
	const BASE_LANGUAGE: GuardianLanguage = 'base';

	interface Props {
		guardians: GuardianRow[];
		language?: GuardianLanguage;
		origins: Array<{ id: string; name: string }>;
		onEdit: (guardian: GuardianRow) => void;
		onDelete: (guardian: GuardianRow) => void;
		onDeleteMultiple: (ids: string[]) => void;
		onUploadImage: (guardian: GuardianRow, type: 'image_mat' | 'chibi' | 'icon') => void;
		onRemoveImage: (guardian: GuardianRow, type: 'image_mat' | 'chibi' | 'icon') => void;
		uploadingId: string | null;
	}

	let { guardians, origins, onEdit, onDelete, onDeleteMultiple, onUploadImage, onRemoveImage, uploadingId, language = BASE_LANGUAGE }: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());

	function guardianDisplayName(guardian: GuardianRow): string {
		if (language === BASE_LANGUAGE) return guardian.name;
		return getTranslationValue(guardian.name_translations, language) ?? guardian.name;
	}

	const originName = (originId: string) =>
		origins.find((o) => o.id === originId)?.name ?? 'Unknown';

	const getImageUrl = (path: string | null | undefined) =>
		publicAssetUrl(path, { bucket: 'game_assets' });

	const toggleSelect = (id: string) => {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	};

	const selectAll = () => {
		selectedIds = new Set(guardians.map((g) => g.id));
	};

	const deselectAll = () => {
		selectedIds = new Set();
	};

	const deleteSelected = () => {
		onDeleteMultiple(Array.from(selectedIds));
		selectedIds = new Set();
	};
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={guardians.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

<section class="list-view">
	{#each guardians as guardian (guardian.id)}
		{@const displayName = guardianDisplayName(guardian)}
		<article class="guardian-card" class:selected={selectedIds.has(guardian.id)}>
			<header>
				<div class="checkbox-wrapper">
					<input
						type="checkbox"
						checked={selectedIds.has(guardian.id)}
						onchange={() => toggleSelect(guardian.id)}
						aria-label="Select {displayName}"
					/>
				</div>
				<div class="header-content">
					<h2>{displayName}</h2>
					<CardActionMenu
						onEdit={() => onEdit(guardian)}
						onDelete={() => onDelete(guardian)}
						onGenerate={null}
					/>
				</div>
			</header>
			<p class="meta">{originName(guardian.origin_id)}</p>

			<div class="image-section">
				<h3>Image Mat</h3>
				{#if getImageUrl(guardian.image_mat_path)}
					<div class="image-preview">
						<img src={getImageUrl(guardian.image_mat_path)} alt="{displayName} image mat" />
						<Button
							class="btn-remove"
							onclick={() => onRemoveImage(guardian, 'image_mat')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? '...' : '🗑️'}
						</Button>
					</div>
				{:else}
					<div class="image-upload">
						<Button
							onclick={() => onUploadImage(guardian, 'image_mat')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? 'Uploading...' : '📤 Upload'}
						</Button>
					</div>
				{/if}
			</div>

			<div class="image-section">
				<h3>Chibi</h3>
				{#if getImageUrl(guardian.chibi_image_path)}
					<div class="image-preview">
						<img src={getImageUrl(guardian.chibi_image_path)} alt="{displayName} chibi" />
						<Button
							class="btn-remove"
							onclick={() => onRemoveImage(guardian, 'chibi')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? '...' : '🗑️'}
						</Button>
					</div>
				{:else}
					<div class="image-upload">
						<Button
							onclick={() => onUploadImage(guardian, 'chibi')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? 'Uploading...' : '📤 Upload'}
						</Button>
					</div>
				{/if}
			</div>

			<div class="image-section">
				<h3>Icon</h3>
				{#if getImageUrl(guardian.icon_image_path)}
					<div class="image-preview">
						<img src={getImageUrl(guardian.icon_image_path)} alt="{displayName} icon" />
						<Button
							class="btn-remove"
							onclick={() => onRemoveImage(guardian, 'icon')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? '...' : '🗑️'}
						</Button>
					</div>
				{:else}
					<div class="image-upload">
						<Button
							onclick={() => onUploadImage(guardian, 'icon')}
							disabled={uploadingId === guardian.id}
						>
							{uploadingId === guardian.id ? 'Uploading...' : '📤 Upload'}
						</Button>
					</div>
				{/if}
			</div>

		</article>
	{:else}
		<div class="empty">No guardians found.</div>
	{/each}
</section>

<style>
	.list-view {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
	}

	.guardian-card {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 10px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.guardian-card header {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		padding-top: 0.15rem;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
	}

	.header-content {
		flex: 1;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.guardian-card.selected {
		border-color: rgba(99, 102, 241, 0.5);
		background: rgba(99, 102, 241, 0.1);
	}

	.guardian-card h2 {
		margin: 0;
		font-size: 0.8rem;
		color: #f8fafc;
	}

	.guardian-card .meta {
		margin: 0;
		color: #a5b4fc;
		font-weight: 500;
		font-size: 0.7rem;
	}

	.image-section {
		padding-top: 0.5rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
	}

	.image-section h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.7rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.image-preview {
		position: relative;
		width: 100%;
		max-width: 200px;
		margin: 0 auto;
	}

	.image-preview img {
		width: 100%;
		height: auto;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.image-preview :global(.btn-remove) {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		background: rgba(239, 68, 68, 0.8);
		border: 1px solid rgba(239, 68, 68, 0.9);
		padding: 0.15rem 0.35rem;
		font-size: 0.7rem;
		color: #fee2e2;
	}

	.image-preview :global(.btn-remove:hover:not(:disabled)) {
		background: rgba(239, 68, 68, 0.95);
	}

	.image-preview :global(.btn-remove:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.image-upload {
		display: flex;
		justify-content: center;
	}

	.empty {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.7rem;
	}
</style>
