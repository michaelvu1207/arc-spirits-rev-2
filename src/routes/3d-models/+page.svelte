<script lang="ts">
	import { onMount } from 'svelte';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button, FormField, Input } from '$lib/components/ui';
	import { uploadStorageFile, sanitizeFilename } from '$lib/utils/storage';
	import { fetchAll, upsertById, deleteById, removeFiles } from '$lib/services/dataService';
	import type { ThreeDModelRow } from '$lib/types/gameData';

	const BUCKET = 'game_assets';
	const FOLDER = '3d_models';
	const TABLE = 'three_d_models';

	const tabs: Tab[] = [{ id: 'models', label: '3D Models', icon: '🧊' }];
	let activeTab = $state('models');

	let name = $state('');
	let objFile = $state<File | null>(null);
	let mtlFile = $state<File | null>(null);
	let pngFile = $state<File | null>(null);

	let uploading = $state(false);
	let error = $state<string | null>(null);
	let models = $state<ThreeDModelRow[]>([]);
	let loading = $state(true);

	async function loadModels() {
		try {
			models = await fetchAll<ThreeDModelRow>(TABLE, '*', { column: 'created_at', ascending: false });
		} catch (e) {
			console.error('Failed to load models', e);
		} finally {
			loading = false;
		}
	}

	onMount(loadModels);

	async function upload() {
		error = null;

		const trimmed = name.trim();
		if (!trimmed) {
			error = 'Enter a model name.';
			return;
		}
		if (!objFile && !mtlFile && !pngFile) {
			error = 'Select at least one file to upload.';
			return;
		}

		uploading = true;
		try {
			const safeName = sanitizeFilename(trimmed).slice(0, 120);
			if (!safeName) {
				error = 'Name produces an empty filename after sanitization.';
				return;
			}

			const prefix = `${FOLDER}/${safeName}`;
			let objPath: string | null = null;
			let mtlPath: string | null = null;
			let pngPath: string | null = null;

			if (objFile) {
				const { data, error: e } = await uploadStorageFile(BUCKET, `${prefix}/${safeName}.obj`, objFile, { upsert: true });
				if (e) throw e;
				objPath = data?.path ?? null;
			}
			if (mtlFile) {
				const { data, error: e } = await uploadStorageFile(BUCKET, `${prefix}/${safeName}.mtl`, mtlFile, { upsert: true });
				if (e) throw e;
				mtlPath = data?.path ?? null;
			}
			if (pngFile) {
				const { data, error: e } = await uploadStorageFile(BUCKET, `${prefix}/${safeName}.png`, pngFile, { upsert: true });
				if (e) throw e;
				pngPath = data?.path ?? null;
			}

			const payload = {
				id: undefined as string | undefined,
				name: trimmed,
				obj_path: objPath,
				mtl_path: mtlPath,
				png_path: pngPath
			};
			await upsertById(TABLE, payload);

			name = '';
			objFile = null;
			mtlFile = null;
			pngFile = null;
			await loadModels();
		} catch (e) {
			console.error(e);
			error = e instanceof Error ? e.message : String(e);
		} finally {
			uploading = false;
		}
	}

	async function deleteModel(model: ThreeDModelRow) {
		if (!confirm(`Delete model "${model.name}"?`)) return;
		try {
			const paths = [model.obj_path, model.mtl_path, model.png_path].filter(
				(p): p is string => !!p
			);
			if (paths.length) await removeFiles(BUCKET, paths);
			await deleteById(TABLE, model.id);
			models = models.filter((m) => m.id !== model.id);
		} catch (e) {
			console.error(e);
			alert('Failed to delete model.');
		}
	}

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<PageLayout
	title="3D Models"
	subtitle="Upload and manage OBJ/MTL/PNG model assets"
	{tabs}
	{activeTab}
	onTabChange={(tabId) => (activeTab = tabId)}
>
	{#snippet children()}
		<div class="layout">
			<!-- Upload form -->
			<form class="panel" onsubmit={(e) => (e.preventDefault(), upload())}>
				<FormField label="Model Name" required>
					<Input placeholder="e.g. guardian_fire" bind:value={name} required />
				</FormField>

				<FormField label="OBJ File" helperText=".obj mesh file">
					<input
						class="file-input"
						type="file"
						accept=".obj"
						disabled={uploading}
						onchange={(e) => {
							const input = e.currentTarget as HTMLInputElement;
							objFile = input.files?.[0] ?? null;
						}}
					/>
				</FormField>

				<FormField label="MTL File" helperText=".mtl material file">
					<input
						class="file-input"
						type="file"
						accept=".mtl"
						disabled={uploading}
						onchange={(e) => {
							const input = e.currentTarget as HTMLInputElement;
							mtlFile = input.files?.[0] ?? null;
						}}
					/>
				</FormField>

				<FormField label="PNG Texture" helperText=".png texture map">
					<input
						class="file-input"
						type="file"
						accept=".png"
						disabled={uploading}
						onchange={(e) => {
							const input = e.currentTarget as HTMLInputElement;
							pngFile = input.files?.[0] ?? null;
						}}
					/>
				</FormField>

				<div class="actions">
					<Button
						variant="primary"
						type="submit"
						loading={uploading}
						disabled={!name.trim() || (!objFile && !mtlFile && !pngFile)}
					>
						{#snippet children()}Upload{/snippet}
					</Button>
				</div>

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}
			</form>

			<!-- Models list -->
			<div class="panel">
				<h2 class="list-title">Uploaded Models</h2>
				{#if loading}
					<p class="empty">Loading…</p>
				{:else if models.length === 0}
					<p class="empty">No models uploaded yet.</p>
				{:else}
					<div class="model-list">
						{#each models as model (model.id)}
							<div class="model-card">
								<div class="model-info">
									<span class="model-name">{model.name}</span>
									<div class="badges">
										{#if model.obj_path}<span class="badge badge--obj">OBJ</span>{/if}
										{#if model.mtl_path}<span class="badge badge--mtl">MTL</span>{/if}
										{#if model.png_path}<span class="badge badge--png">PNG</span>{/if}
									</div>
									<span class="model-date">{formatDate(model.created_at)}</span>
								</div>
								<Button variant="danger" size="sm" onclick={() => deleteModel(model)}>
									{#snippet children()}Delete{/snippet}
								</Button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/snippet}
</PageLayout>

<style>
	.layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		align-items: start;
	}

	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.panel {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.file-input {
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.3);
		background: rgba(15, 23, 42, 0.65);
		color: #cbd5f5;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.error {
		margin: 0;
		color: #fca5a5;
		font-size: 0.9rem;
	}

	.list-title {
		margin: 0;
		font-size: 1rem;
		color: #f8fafc;
	}

	.empty {
		margin: 0;
		color: rgba(148, 163, 184, 0.7);
	}

	.model-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.model-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		border-radius: 8px;
		background: rgba(2, 6, 23, 0.45);
		border: 1px solid rgba(148, 163, 184, 0.12);
	}

	.model-info {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.model-name {
		color: #f8fafc;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 160px;
	}

	.badges {
		display: flex;
		gap: 0.3rem;
	}

	.badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.badge--obj {
		background: rgba(59, 130, 246, 0.3);
		color: #93c5fd;
	}

	.badge--mtl {
		background: rgba(139, 92, 246, 0.3);
		color: #c4b5fd;
	}

	.badge--png {
		background: rgba(16, 185, 129, 0.3);
		color: #6ee7b7;
	}

	.model-date {
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.7);
		white-space: nowrap;
	}
</style>
