<script lang="ts">
	import { processAndUploadImage, deleteStorageFile, publicAssetUrl } from '$lib/utils/storage';
	import type { Snippet } from 'svelte';

	interface Props {
		value?: string | null;
		bucket?: string;
		folder?: string;
		accept?: string;
		maxSizeMB?: number;
		aspectRatio?: string;
		/** Whether to crop transparent areas from images (default: true) */
		cropTransparent?: boolean;
		onupload?: (path: string) => void;
		onremove?: (previousPath: string) => void;
		onerror?: (error: string) => void;
		children?: Snippet;
	}

	let {
		value = $bindable<string | null>(null),
		bucket = 'game_assets',
		folder = 'uploads',
		accept = 'image/*',
		maxSizeMB = 5,
		aspectRatio,
		cropTransparent = true,
		onupload,
		onremove,
		onerror,
		children
	}: Props = $props();

	let uploading = $state(false);
	let removing = $state(false);
	let dragOver = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);

	const previewUrl = $derived(publicAssetUrl(value, { bucket }));
	const hasImage = $derived(!!value);

	function validateFile(file: File): string | null {
		if (!file.type.startsWith('image/')) {
			return 'Please select an image file.';
		}
		const maxBytes = maxSizeMB * 1024 * 1024;
		if (file.size > maxBytes) {
			return `Image must be smaller than ${maxSizeMB}MB.`;
		}
		return null;
	}

	async function handleUpload(file: File) {
		const error = validateFile(file);
		if (error) {
			onerror?.(error);
			return;
		}

		uploading = true;
		try {
			// Remove old file if exists
			if (value) {
				await deleteStorageFile(bucket, value);
			}

			// Process and upload using unified function (crops transparent areas by default)
			const { data, error: uploadError } = await processAndUploadImage(file, {
				bucket,
				folder,
				cropTransparent,
				upsert: false
			});

			if (uploadError) {
				throw uploadError;
			}

			if (data?.path) {
				value = data.path;
				onupload?.(data.path);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			onerror?.(message);
		} finally {
			uploading = false;
		}
	}

	async function handleRemove() {
		if (!value) return;

		removing = true;
		try {
			const previousPath = value;
			const { error } = await deleteStorageFile(bucket, value);
			if (error) {
				throw error;
			}
			value = null;
			onremove?.(previousPath);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			onerror?.(message);
		} finally {
			removing = false;
		}
	}

	function handleFileChange(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		if (file) {
			handleUpload(file);
		}
		target.value = '';
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		const file = event.dataTransfer?.files?.[0];
		if (file) {
			handleUpload(file);
		}
	}

	function triggerFileInput() {
		fileInput?.click();
	}
</script>

<div class="image-uploader">
	<div
		class="image-uploader__dropzone"
		class:has-image={hasImage}
		class:drag-over={dragOver}
		class:uploading
		role="button"
		tabindex="0"
		ondragover={handleDragOver}
		ondragleave={handleDragLeave}
		ondrop={handleDrop}
		onclick={triggerFileInput}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				triggerFileInput();
			}
		}}
		style={aspectRatio ? `aspect-ratio: ${aspectRatio};` : ''}
	>
		<input
			bind:this={fileInput}
			type="file"
			{accept}
			onchange={handleFileChange}
			class="image-uploader__input"
			aria-label="Upload image"
		/>
		{#if uploading}
			<div class="image-uploader__state">
				<div class="spinner"></div>
				<p>Uploading...</p>
			</div>
		{:else if previewUrl}
			<img src={previewUrl} alt="Preview" class="image-uploader__preview" />
			<div class="image-uploader__overlay">
				<button
					type="button"
					class="btn btn--small"
					onclick={(e) => {
						e.stopPropagation();
						triggerFileInput();
					}}
				>
					Change
				</button>
			</div>
		{:else}
			<div class="image-uploader__placeholder">
				<svg class="icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
					<polyline points="17 8 12 3 7 8"></polyline>
					<line x1="12" y1="3" x2="12" y2="15"></line>
				</svg>
				<p>Drop image here or click to upload</p>
				<small>Max {maxSizeMB}MB</small>
			</div>
		{/if}
	</div>

	{#if hasImage && !uploading}
		<div class="image-uploader__actions">
			<button type="button" class="btn btn--danger" onclick={handleRemove} disabled={removing}>
				{removing ? 'Removing...' : 'Remove Image'}
			</button>
		</div>
	{/if}

	{#if children}
		<div class="image-uploader__extra">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.image-uploader {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: relative;
	}

	.image-uploader__input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		cursor: pointer;
		z-index: 10;
	}

	.image-uploader__dropzone {
		position: relative;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		background: rgba(15, 23, 42, 0.4);
		min-height: 200px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		overflow: hidden;
	}

	.image-uploader__dropzone:hover {
		border-color: rgba(59, 130, 246, 0.5);
		background: rgba(15, 23, 42, 0.6);
	}

	.image-uploader__dropzone.drag-over {
		border-color: rgba(59, 130, 246, 0.7);
		background: rgba(59, 130, 246, 0.1);
	}

	.image-uploader__dropzone.uploading {
		cursor: wait;
	}

	.image-uploader__dropzone.has-image:hover .image-uploader__overlay {
		opacity: 1;
	}

	.image-uploader__state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		color: #cbd5f5;
		z-index: 5;
		pointer-events: none;
	}

	.image-uploader__placeholder {
		z-index: 5;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem;
		text-align: center;
	}

	.image-uploader__placeholder .icon {
		color: #94a3b8;
	}

	.image-uploader__placeholder p {
		margin: 0;
		color: #cbd5f5;
		font-size: 0.95rem;
	}

	.image-uploader__placeholder small {
		color: #94a3b8;
		font-size: 0.8rem;
	}

	.image-uploader__preview {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.image-uploader__overlay {
		position: absolute;
		inset: 0;
		background: rgba(15, 23, 42, 0.8);
		display: flex;
		align-items: center;
		z-index: 15;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.image-uploader__actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.image-uploader__extra {
		font-size: 0.85rem;
		color: #94a3b8;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(148, 163, 184, 0.2);
		border-top-color: #93c5fd;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(30, 41, 59, 0.7);
		color: #cbd5f5;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.15s ease;
	}

	.btn:hover {
		background: rgba(59, 130, 246, 0.2);
		border-color: rgba(59, 130, 246, 0.35);
	}

	.btn--small {
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
	}

	.btn--danger {
		background: rgba(248, 113, 113, 0.25);
		border-color: rgba(248, 113, 113, 0.45);
		color: #fecaca;
	}

	.btn--danger:hover {
		background: rgba(248, 113, 113, 0.35);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
