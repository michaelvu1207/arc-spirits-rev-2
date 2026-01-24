<script lang="ts">
	import { onDestroy } from 'svelte';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button, FormField, Input } from '$lib/components/ui';
	import { getPublicUrl, sanitizeFilename, uploadStorageFile } from '$lib/utils/storage';

	const BUCKET = 'game_assets';
	const FOLDER = 'screenshots';

	const tabs: Tab[] = [{ id: 'upload', label: 'Upload', icon: '📤' }];
	let activeTab = $state('upload');

	let name = $state('');
	let file = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);

	let overwrite = $state(false);
	let uploading = $state(false);
	let error = $state<string | null>(null);

	let uploadedPath = $state<string | null>(null);
	let uploadedUrl = $state<string | null>(null);

	function sanitizeBaseName(raw: string): string {
		const trimmed = raw.trim();
		const withoutExt = trimmed.replace(/\.[^.]+$/, '');
		const safe = sanitizeFilename(withoutExt).replace(/\.+$/g, '').slice(0, 120);
		return safe;
	}

	function extensionForFile(input: File): string {
		const type = input.type || '';
		if (type.startsWith('image/')) return (type.split('/')[1] || 'png').split('+')[0] || 'png';
		const fromName = input.name.split('.').pop();
		return fromName ? fromName.toLowerCase() : 'png';
	}

	function setFile(next: File | null) {
		file = next;
		error = null;
		uploadedPath = null;
		uploadedUrl = null;

		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = next ? URL.createObjectURL(next) : null;

		if (next && !name.trim()) {
			name = next.name.replace(/\.[^.]+$/, '');
		}
	}

	function clear() {
		setFile(null);
		name = '';
		overwrite = false;
	}

	onDestroy(() => {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
	});

	async function upload() {
		error = null;
		uploadedPath = null;
		uploadedUrl = null;

		if (!file) {
			error = 'Choose an image to upload.';
			return;
		}

		const baseName = sanitizeBaseName(name);
		if (!baseName) {
			error = 'Enter a name.';
			return;
		}

		uploading = true;
		try {
			const ext = extensionForFile(file);
			const path = `${FOLDER}/${baseName}.${ext}`;

			const { data, error: upErr } = await uploadStorageFile(BUCKET, path, file, {
				upsert: overwrite,
				contentType: file.type || undefined
			});
			if (upErr) throw upErr;
			if (!data?.path) throw new Error('Upload failed (no path returned).');

			uploadedPath = data.path;
			uploadedUrl = getPublicUrl(BUCKET, data.path, true);
		} catch (e) {
			console.error(e);
			error = e instanceof Error ? e.message : String(e);
		} finally {
			uploading = false;
		}
	}

	function copyUrl() {
		if (!uploadedUrl) return;
		navigator.clipboard?.writeText(uploadedUrl).catch(() => {});
	}
</script>

<PageLayout
	title="Screenshot Upload"
	subtitle={`Uploads to Supabase Storage: ${BUCKET}/${FOLDER}/…`}
	{tabs}
	{activeTab}
	onTabChange={(tabId) => (activeTab = tabId)}
>
	{#snippet children()}
		<div class="layout">
			<form class="panel" onsubmit={(e) => (e.preventDefault(), upload())}>
				<FormField label="Name" required helperText={`Saved as ${FOLDER}/<name>.<ext>`}>
					<Input placeholder="e.g. boss_fight_01" bind:value={name} required />
				</FormField>

				<FormField label="Image" required>
					<input
						class="file-input"
						type="file"
						accept="image/*"
						disabled={uploading}
						onchange={(event) => {
							const input = event.currentTarget as HTMLInputElement;
							setFile(input.files?.[0] ?? null);
						}}
					/>
				</FormField>

				<label class="checkbox">
					<input type="checkbox" bind:checked={overwrite} disabled={uploading} />
					Overwrite if the filename already exists
				</label>

				<div class="actions">
					<Button variant="primary" type="submit" loading={uploading} disabled={!file || !name.trim()}>
						{#snippet children()}Upload{/snippet}
					</Button>
					<Button variant="secondary" type="button" onclick={clear} disabled={uploading}>
						{#snippet children()}Clear{/snippet}
					</Button>
				</div>

				{#if error}
					<p class="error" role="alert">{error}</p>
				{/if}

				{#if uploadedPath}
					<div class="result">
						<div class="result__row">
							<span class="result__label">Saved</span>
							<code class="result__value">{uploadedPath}</code>
						</div>
						{#if uploadedUrl}
							<div class="result__row">
								<span class="result__label">Public URL</span>
								<a class="result__link" href={uploadedUrl} target="_blank" rel="noreferrer">
									{uploadedUrl}
								</a>
							</div>
							<div class="result__actions">
								<Button variant="ghost" size="sm" type="button" onclick={copyUrl}>
									{#snippet children()}Copy URL{/snippet}
								</Button>
							</div>
						{/if}
					</div>
				{/if}
			</form>

			<div class="panel preview">
				<h2>Preview</h2>
				{#if previewUrl}
					<img class="preview__image" src={previewUrl} alt="Selected screenshot preview" />
				{:else}
					<p class="preview__empty">Choose an image to see a preview.</p>
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

	.checkbox {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: rgba(203, 213, 245, 0.9);
		font-size: 0.92rem;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.error {
		margin: 0;
		color: #fca5a5;
		font-size: 0.9rem;
	}

	.result {
		border-top: 1px solid rgba(148, 163, 184, 0.14);
		padding-top: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.result__row {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		flex-wrap: wrap;
	}

	.result__label {
		color: rgba(148, 163, 184, 0.8);
		font-size: 0.85rem;
		min-width: 5.5rem;
	}

	.result__value {
		color: #f8fafc;
		background: rgba(2, 6, 23, 0.55);
		border: 1px solid rgba(148, 163, 184, 0.14);
		border-radius: 8px;
		padding: 0.2rem 0.45rem;
	}

	.result__link {
		color: #93c5fd;
		text-decoration: none;
		word-break: break-all;
	}

	.result__link:hover {
		text-decoration: underline;
	}

	.result__actions {
		display: flex;
		gap: 0.5rem;
	}

	.preview h2 {
		margin: 0;
		font-size: 1rem;
		color: #f8fafc;
	}

	.preview__image {
		width: 100%;
		height: auto;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.4);
	}

	.preview__empty {
		margin: 0;
		color: rgba(148, 163, 184, 0.7);
	}
	</style>
