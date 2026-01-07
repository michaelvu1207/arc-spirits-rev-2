<script lang="ts">
	import { supabase } from '$lib/api/supabaseClient';
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import {
		IconPoolGridView,
		AllIconsGridView,
		TTSGraphicsView,
		TokenExportView,
		IconEditor,
		IconGuideView
	} from '$lib/components/icons';
	import { processAndUploadImage } from '$lib/utils/storage';
	import { loadAllIcons, clearIconPoolCache } from '$lib/utils/iconPool';
	import type { IconPoolRow } from '$lib/types/gameData';

	const storage = supabase.storage.from('game_assets');

	// All icons from the central icon_pool table
	let allIcons: IconPoolRow[] = $state([]);
	let loading = $state(true);
	let uploading = $state(false);
	let error: string | null = $state(null);
	let filesToUpload: File[] = $state([]);
	let dragActive = $state(false);
	let editingIcon: IconPoolRow | null = $state(null);

	// Tab state
	const tabs: Tab[] = [
		{ id: 'all', label: 'All Icons', icon: '🎨' },
		{ id: 'uploaded', label: 'Uploaded', icon: '📤' },
		{ id: 'generated', label: 'Generated', icon: '⚙️' },
		{ id: 'icon-guide', label: 'Icon Guide', icon: '📖' },
		{ id: 'token-export', label: 'Token Export', icon: '🎯' },
		{ id: 'tts-graphics', label: 'TTS Graphics', icon: '🖼️' }
	];
	let activeTab = $state('all');

	// Filtered views derived from central pool
	const uploadedIcons = $derived(allIcons.filter(i => i.source_type === 'uploaded'));
	const poolIcons = $derived(allIcons.filter(i => ['origin', 'class', 'dice_side'].includes(i.source_type)));
	const runeIcons = $derived(allIcons.filter(i => i.source_type === 'rune'));

	// Stats from central pool
	const totalCount = $derived(allIcons.length);
	const uploadedCount = $derived(uploadedIcons.length);
	const originCount = $derived(allIcons.filter(i => i.source_type === 'origin').length);
	const classCount = $derived(allIcons.filter(i => i.source_type === 'class').length);
	const diceSideCount = $derived(allIcons.filter(i => i.source_type === 'dice_side').length);
	const runeCount = $derived(runeIcons.length);
	const tokenExportCount = $derived(allIcons.filter(i => i.export_as_token).length);
	const iconGuideCount = $derived(
		allIcons.filter((i) => Array.isArray(i.tags) && i.tags.includes('icon_guide')).length
	);

	const sanitize = (name: string) =>
		name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 80);

	const publicUrl = (path: string) => storage.getPublicUrl(path).data.publicUrl;

	onMount(async () => {
		await refreshIcons();
	});

	async function refreshIcons(forceRefresh = true) {
		loading = true;
		error = null;
		try {
			// Clear cache if forcing refresh to get latest from DB
			if (forceRefresh) {
				clearIconPoolCache();
			}
			// Load all icons from the central icon_pool table (single query)
			allIcons = await loadAllIcons(forceRefresh);
		} catch (e) {
			console.error('Failed to load icons:', e);
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	function onFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		filesToUpload = Array.from(input.files ?? []);
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragActive = false;
		const dropped = Array.from(event.dataTransfer?.files ?? []);
		filesToUpload = dropped;
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		dragActive = true;
	}

	function onDragLeave(event: DragEvent) {
		event.preventDefault();
		dragActive = false;
	}

	async function uploadBatch() {
		if (!filesToUpload.length) return;
		uploading = true;
		error = null;
		try {
			for (const file of filesToUpload) {
				const clean = sanitize(file.name.split('.')[0]) || 'icon';
				const folder = `icons/${crypto.randomUUID()}`;

				// Use unified processAndUploadImage which crops transparent areas
				const { data, error: upErr } = await processAndUploadImage(file, {
					folder,
					filename: clean,
					cropTransparent: true
				});
				if (upErr) throw upErr;
				if (!data?.path) throw new Error('Upload failed - no path returned');

				// Insert directly into icon_pool (misc_assets table has been removed)
				const { error: dbErr } = await supabase.from('icon_pool').insert({
					name: clean,
					source_type: 'uploaded',
					source_id: null,
					source_table: null,
					file_path: data.path,
					tags: ['icon'],
					metadata: {
						file_type: file.type,
						file_size: file.size
					}
				});
				if (dbErr) throw dbErr;
			}
			filesToUpload = [];
			await refreshIcons();
		} catch (e) {
			console.error(e);
			error = e instanceof Error ? e.message : String(e);
		} finally {
			uploading = false;
		}
	}

	async function deleteUploadedIcon(icon: IconPoolRow) {
		if (!confirm(`Delete icon "${icon.name}"?`)) return;
		try {
			await storage.remove([icon.file_path]);
			await supabase.from('icon_pool').delete().eq('id', icon.id);
			await refreshIcons();
		} catch (e) {
			alert('Failed to delete icon');
		}
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	function handleEditIcon(icon: IconPoolRow) {
		editingIcon = icon;
	}

	function handleIconSaved(updated: IconPoolRow) {
		// Update the icon in the central pool
		allIcons = allIcons.map((i) => (i.id === updated.id ? updated : i));
		editingIcon = null;
	}

	function handleIconDeleted(icon: IconPoolRow) {
		// Remove from central pool
		allIcons = allIcons.filter((i) => i.id !== icon.id);
		editingIcon = null;
	}

	function closeEditor() {
		editingIcon = null;
	}
</script>

<svelte:head>
	<title>Icons - Arc Spirits</title>
</svelte:head>

<PageLayout
	title="Icons"
	subtitle="Manage uploaded and generated icons"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		{#if activeTab === 'uploaded'}
			<Button variant="primary" onclick={uploadBatch} disabled={uploading || !filesToUpload.length}>
				{uploading ? 'Uploading...' : 'Upload'}
			</Button>
		{/if}
	{/snippet}

	{#snippet tabActions()}
		<div class="stats-row">
			{#if activeTab === 'all'}
				<span class="stat">{totalCount} total</span>
				<span class="stat">{uploadedCount} uploaded</span>
				<span class="stat">{poolIcons.length} generated</span>
				<span class="stat">{runeCount} runes</span>
			{:else if activeTab === 'uploaded'}
				<span class="stat">{uploadedCount} uploaded</span>
			{:else if activeTab === 'generated'}
				<span class="stat">{originCount} origin</span>
				<span class="stat">{classCount} class</span>
				<span class="stat">{diceSideCount} dice sides</span>
			{:else if activeTab === 'token-export'}
				<span class="stat">{tokenExportCount} selected for export</span>
			{:else if activeTab === 'icon-guide'}
				<span class="stat">{iconGuideCount} in guide</span>
			{/if}
		</div>
	{/snippet}

	{#if error}
		<div class="error-state">{error}</div>
	{/if}

	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading icons...</p>
		</div>
	{:else}
		{#if activeTab === 'uploaded'}
			<div
				class="upload-card"
				class:drag-active={dragActive}
				role="region"
				aria-label="Icon upload dropzone"
				ondrop={onDrop}
				ondragover={onDragOver}
				ondragleave={onDragLeave}
			>
				<div class="dropzone">
					<p>Drag & drop icons here or choose files</p>
					<input type="file" multiple accept="image/*" onchange={onFileChange} />
					{#if filesToUpload.length}
						<p class="file-count">{filesToUpload.length} file(s) selected</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if activeTab === 'all'}
			<AllIconsGridView {allIcons} {publicUrl} onEditIcon={handleEditIcon} />
		{:else if activeTab === 'uploaded'}
			<IconPoolGridView icons={uploadedIcons} {publicUrl} onEdit={handleEditIcon} />
		{:else if activeTab === 'generated'}
			<IconPoolGridView icons={poolIcons} {publicUrl} onEdit={handleEditIcon} />
		{:else if activeTab === 'icon-guide'}
			<IconGuideView bind:allIcons />
		{:else if activeTab === 'token-export'}
			<TokenExportView icons={allIcons} {publicUrl} onUpdate={refreshIcons} onEditIcon={handleEditIcon} />
		{:else if activeTab === 'tts-graphics'}
			<TTSGraphicsView icons={allIcons} {publicUrl} />
		{/if}
	{/if}
</PageLayout>

{#if editingIcon}
	<IconEditor
		icon={editingIcon}
		{publicUrl}
		onClose={closeEditor}
		onSave={handleIconSaved}
		onDelete={handleIconDeleted}
	/>
{/if}

<style>
	.stats-row {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.stat {
		font-size: 0.7rem;
		color: #64748b;
	}

	.error-state {
		padding: 0.5rem;
		text-align: center;
		color: #f87171;
		font-size: 0.75rem;
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.2);
		border-radius: 6px;
		margin-bottom: 0.5rem;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		color: #94a3b8;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(99, 102, 241, 0.2);
		border-top-color: #6366f1;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-state p {
		margin-top: 1rem;
		font-size: 0.85rem;
	}

	.upload-card {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.1);
		border-radius: 10px;
		padding: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.upload-card.drag-active {
		background: rgba(79, 70, 229, 0.08);
		border-color: rgba(129, 140, 248, 0.4);
	}

	.dropzone {
		border: 2px dashed rgba(148, 163, 184, 0.3);
		padding: 0.75rem;
		text-align: center;
		border-radius: 8px;
	}

	.dropzone p {
		margin: 0.25rem 0;
		color: #cbd5e1;
		font-size: 0.75rem;
	}

	.file-count {
		color: #a5b4fc;
		font-weight: 500;
	}

	.dropzone input[type='file'] {
		margin-top: 0.5rem;
		font-size: 0.7rem;
	}
</style>
