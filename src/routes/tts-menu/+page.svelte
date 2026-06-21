<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import { Button } from '$lib/components/ui';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { processAndUploadImage } from '$lib/utils/storage';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import type { GuardianRow, OriginRow } from '$lib/types/gameData';

	const storage = supabase.storage.from('game_assets');

	// Player colors configuration
	const PLAYER_COLORS = [
		{ id: 'red', label: 'Red', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' },
		{ id: 'orange', label: 'Orange', color: '#f97316', borderColor: 'rgba(249, 115, 22, 0.4)' },
		{ id: 'yellow', label: 'Yellow', color: '#eab308', borderColor: 'rgba(234, 179, 8, 0.4)' },
		{ id: 'green', label: 'Green', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.4)' },
		{ id: 'blue', label: 'Blue', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)' },
		{ id: 'purple', label: 'Purple', color: '#a855f7', borderColor: 'rgba(168, 85, 247, 0.4)' },
	] as const;

	type PlayerColorId = typeof PLAYER_COLORS[number]['id'];
	type GuardianImageType = 'char_select' | `${PlayerColorId}_selected`;

	const tabs: Tab[] = [];
	const activeTab = '';

	// State
	let guardians: GuardianRow[] = $state([]);
	let origins: OriginRow[] = $state([]);
	let loading = $state(true);
	let error: string | null = $state(null);

	// Background image state
	let backgroundUrl: string | null = $state(null);
	let uploadingBackground = $state(false);

	// Guardian image states (keyed by guardian id)
	let guardianImages = $state<Record<string, Record<string, string | null>>>({});
	let uploadingGuardian = $state<Record<string, string | null>>({});

	// Image paths
	const BACKGROUND_PATH = 'tts_menu/background.png';
	const getGuardianImagePath = (guardianId: string, type: GuardianImageType) =>
		`tts_menu/guardians/${guardianId}/${type}.png`;

	onMount(loadData);

	function getPublicUrl(path: string): string | null {
		const { data } = storage.getPublicUrl(path);
		return data?.publicUrl ?? null;
	}

	function getCacheBustedUrl(path: string): string | null {
		const url = getPublicUrl(path);
		return url ? `${url}?t=${Date.now()}` : null;
	}

	async function checkFileExists(path: string): Promise<boolean> {
		try {
			const { data, error } = await storage.list(path.split('/').slice(0, -1).join('/'), {
				search: path.split('/').pop()
			});
			if (error) return false;
			return data?.some(f => f.name === path.split('/').pop()) ?? false;
		} catch {
			return false;
		}
	}

	async function loadData() {
		loading = true;
		error = null;
		try {
			// Fetch guardians and origins
			const [guardiansRes, originsRes] = await Promise.all([
				supabase.from('guardians').select('*').order('name'),
				fetchOriginRecords()
			]);

			if (guardiansRes.error) throw guardiansRes.error;

			guardians = guardiansRes.data ?? [];
			origins = originsRes.filter((origin) => origin.is_enabled !== false);

			// Check for existing background image
			const bgExists = await checkFileExists(BACKGROUND_PATH);
			backgroundUrl = bgExists ? getCacheBustedUrl(BACKGROUND_PATH) : null;

			// Check for existing guardian images
			const imageStates: typeof guardianImages = {};
			for (const guardian of guardians) {
				// Build list of all image types to check
				const imageTypes: GuardianImageType[] = [
					'char_select',
					...PLAYER_COLORS.map(c => `${c.id}_selected` as GuardianImageType)
				];

				const existsResults = await Promise.all(
					imageTypes.map(type => checkFileExists(getGuardianImagePath(guardian.id, type)))
				);

				const state: Record<string, string | null> = {};
				imageTypes.forEach((type, i) => {
					state[type] = existsResults[i] ? getCacheBustedUrl(getGuardianImagePath(guardian.id, type)) : null;
				});

				imageStates[guardian.id] = state;
			}
			guardianImages = imageStates;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			loading = false;
		}
	}

	async function uploadBackground(file: File) {
		uploadingBackground = true;
		try {
			const { error: uploadError } = await storage.upload(BACKGROUND_PATH, file, {
				upsert: true,
				contentType: file.type
			});
			if (uploadError) throw uploadError;
			backgroundUrl = getCacheBustedUrl(BACKGROUND_PATH);
		} catch (err) {
			alert(`Failed to upload background: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			uploadingBackground = false;
		}
	}

	async function removeBackground() {
		if (!confirm('Remove background image?')) return;
		try {
			await storage.remove([BACKGROUND_PATH]);
			backgroundUrl = null;
		} catch (err) {
			alert(`Failed to remove background: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function uploadGuardianImage(guardianId: string, type: GuardianImageType, file: File) {
		uploadingGuardian[guardianId] = type;
		try {
			const path = getGuardianImagePath(guardianId, type);
			const { error: uploadError } = await storage.upload(path, file, {
				upsert: true,
				contentType: file.type
			});
			if (uploadError) throw uploadError;

			// Update local state
			if (!guardianImages[guardianId]) {
				guardianImages[guardianId] = {};
			}
			guardianImages[guardianId][type] = getCacheBustedUrl(path);
		} catch (err) {
			alert(`Failed to upload image: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			uploadingGuardian[guardianId] = null;
		}
	}

	async function removeGuardianImage(guardianId: string, type: GuardianImageType) {
		if (!confirm('Remove this image?')) return;
		try {
			const path = getGuardianImagePath(guardianId, type);
			await storage.remove([path]);

			// Update local state
			if (guardianImages[guardianId]) {
				guardianImages[guardianId][type] = null;
			}
		} catch (err) {
			alert(`Failed to remove image: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function getOriginName(originId: string): string {
		return origins.find(o => o.id === originId)?.name ?? 'Unknown';
	}

	function getOriginColor(originId: string): string {
		return origins.find(o => o.id === originId)?.color ?? '#8b5cf6';
	}
</script>

<PageLayout
	title="TTS Menu"
	subtitle="Configure character selection menu graphics for Tabletop Simulator"
	{tabs}
	{activeTab}
>
	{#if loading}
		<div class="loading-state">Loading...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else}
		<div class="tts-menu-content">
			<!-- Background Section -->
			<section class="section">
				<h2 class="section-title">Background Layout</h2>
				<p class="section-description">Upload the main background image for the character selection menu.</p>

				<div class="background-upload-area">
					{#if backgroundUrl}
						<div class="background-preview">
							<img src={backgroundUrl} alt="Menu background" />
							<div class="background-actions">
								<label class="btn btn--small">
									{uploadingBackground ? 'Uploading...' : 'Replace'}
									<input
										type="file"
										accept="image/*"
										onchange={(e) => {
											const file = (e.target as HTMLInputElement).files?.[0];
											if (file) uploadBackground(file);
										}}
										disabled={uploadingBackground}
										hidden
									/>
								</label>
								<button class="btn btn--small btn--danger" onclick={removeBackground}>Remove</button>
							</div>
						</div>
					{:else}
						<label class="upload-placeholder">
							<span class="upload-icon">🖼️</span>
							<span class="upload-text">{uploadingBackground ? 'Uploading...' : 'Click to upload background'}</span>
							<input
								type="file"
								accept="image/*"
								onchange={(e) => {
									const file = (e.target as HTMLInputElement).files?.[0];
									if (file) uploadBackground(file);
								}}
								disabled={uploadingBackground}
								hidden
							/>
						</label>
					{/if}
				</div>
			</section>

			<!-- Guardians Section -->
			<section class="section">
				<h2 class="section-title">Guardian Character Select Images</h2>
				<p class="section-description">Upload character select images for each guardian. Each guardian needs a base image, plus variants for each player color (Red, Orange, Yellow, Green, Blue, Purple).</p>

				<div class="guardians-grid">
					{#each guardians as guardian (guardian.id)}
						{@const images = guardianImages[guardian.id] ?? {}}
						{@const uploading = uploadingGuardian[guardian.id]}
						<article class="guardian-card" style="border-left-color: {getOriginColor(guardian.origin_id)}">
							<header class="guardian-header">
								<h3 class="guardian-name">{guardian.name}</h3>
								<span class="guardian-origin">{getOriginName(guardian.origin_id)}</span>
							</header>

							<div class="image-slots">
								<!-- Character Select (Base) -->
								<div class="image-slot">
									<span class="slot-label">Base</span>
									{#if images.char_select}
										<div class="slot-preview">
											<img src={images.char_select} alt="{guardian.name} character select" />
											<div class="slot-actions">
												<label class="btn btn--tiny">
													{uploading === 'char_select' ? '...' : 'Replace'}
													<input
														type="file"
														accept="image/*"
														onchange={(e) => {
															const file = (e.target as HTMLInputElement).files?.[0];
															if (file) uploadGuardianImage(guardian.id, 'char_select', file);
														}}
														disabled={!!uploading}
														hidden
													/>
												</label>
												<button class="btn btn--tiny btn--danger" onclick={() => removeGuardianImage(guardian.id, 'char_select')}>X</button>
											</div>
										</div>
									{:else}
										<label class="slot-upload">
											<span>{uploading === 'char_select' ? '...' : '+'}</span>
											<input
												type="file"
												accept="image/*"
												onchange={(e) => {
													const file = (e.target as HTMLInputElement).files?.[0];
													if (file) uploadGuardianImage(guardian.id, 'char_select', file);
												}}
												disabled={!!uploading}
												hidden
											/>
										</label>
									{/if}
								</div>

								<!-- Player Color Selected Variants -->
								{#each PLAYER_COLORS as playerColor (playerColor.id)}
									{@const imageType = `${playerColor.id}_selected` as GuardianImageType}
									{@const imageUrl = images[imageType]}
									<div class="image-slot" style="--slot-color: {playerColor.color}; --slot-border: {playerColor.borderColor}">
										<span class="slot-label" style="color: {playerColor.color}">{playerColor.label}</span>
										{#if imageUrl}
											<div class="slot-preview slot-preview--colored">
												<img src={imageUrl} alt="{guardian.name} {playerColor.label} selected" />
												<div class="slot-actions">
													<label class="btn btn--tiny">
														{uploading === imageType ? '...' : 'Replace'}
														<input
															type="file"
															accept="image/*"
															onchange={(e) => {
																const file = (e.target as HTMLInputElement).files?.[0];
																if (file) uploadGuardianImage(guardian.id, imageType, file);
															}}
															disabled={!!uploading}
															hidden
														/>
													</label>
													<button class="btn btn--tiny btn--danger" onclick={() => removeGuardianImage(guardian.id, imageType)}>X</button>
												</div>
											</div>
										{:else}
											<label class="slot-upload slot-upload--colored">
												<span>{uploading === imageType ? '...' : '+'}</span>
												<input
													type="file"
													accept="image/*"
													onchange={(e) => {
														const file = (e.target as HTMLInputElement).files?.[0];
														if (file) uploadGuardianImage(guardian.id, imageType, file);
													}}
													disabled={!!uploading}
													hidden
												/>
											</label>
										{/if}
									</div>
								{/each}
							</div>
						</article>
					{/each}
				</div>
			</section>
		</div>
	{/if}
</PageLayout>

<style>
	.loading-state,
	.error-state {
		padding: 2rem;
		text-align: center;
		color: #64748b;
		font-size: 0.85rem;
	}

	.error-state {
		color: #f87171;
	}

	.tts-menu-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.section {
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 12px;
		padding: 1.5rem;
	}

	.section-title {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
		color: #f8fafc;
	}

	.section-description {
		margin: 0 0 1rem;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	/* Background upload area */
	.background-upload-area {
		max-width: 600px;
	}

	.background-preview {
		position: relative;
		border-radius: 8px;
		overflow: hidden;
		border: 2px solid rgba(148, 163, 184, 0.2);
	}

	.background-preview img {
		width: 100%;
		height: auto;
		display: block;
	}

	.background-actions {
		position: absolute;
		bottom: 0.5rem;
		right: 0.5rem;
		display: flex;
		gap: 0.5rem;
	}

	.upload-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		background: rgba(30, 41, 59, 0.4);
		cursor: pointer;
		transition: all 0.2s;
	}

	.upload-placeholder:hover {
		border-color: rgba(148, 163, 184, 0.5);
		background: rgba(30, 41, 59, 0.6);
	}

	.upload-icon {
		font-size: 2.5rem;
	}

	.upload-text {
		font-size: 0.85rem;
		color: #94a3b8;
	}

	/* Guardians grid */
	.guardians-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.guardian-card {
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-left: 4px solid #8b5cf6;
		border-radius: 8px;
		padding: 1rem;
	}

	.guardian-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}

	.guardian-name {
		margin: 0;
		font-size: 0.95rem;
		color: #f8fafc;
	}

	.guardian-origin {
		font-size: 0.7rem;
		color: #64748b;
		background: rgba(100, 116, 139, 0.2);
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	/* Image slots */
	.image-slots {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.image-slot {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.slot-label {
		font-size: 0.65rem;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-align: center;
	}

	.slot-preview {
		position: relative;
		aspect-ratio: 1;
		border-radius: 6px;
		overflow: hidden;
		border: 2px solid rgba(148, 163, 184, 0.2);
	}

	.slot-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.slot-actions {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		gap: 0.25rem;
		padding: 0.25rem;
		background: rgba(0, 0, 0, 0.7);
		opacity: 0;
		transition: opacity 0.2s;
	}

	.slot-preview:hover .slot-actions {
		opacity: 1;
	}

	.slot-upload {
		aspect-ratio: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px dashed rgba(148, 163, 184, 0.3);
		border-radius: 6px;
		background: rgba(30, 41, 59, 0.3);
		cursor: pointer;
		font-size: 1.5rem;
		color: #64748b;
		transition: all 0.2s;
	}

	.slot-upload:hover {
		border-color: rgba(148, 163, 184, 0.5);
		background: rgba(30, 41, 59, 0.5);
		color: #94a3b8;
	}

	.slot-upload--colored {
		border-color: var(--slot-border, rgba(148, 163, 184, 0.3));
	}

	.slot-upload--colored:hover {
		border-color: var(--slot-color, rgba(148, 163, 184, 0.6));
		background: color-mix(in srgb, var(--slot-color, #94a3b8) 10%, transparent);
	}

	.slot-preview--colored {
		border-color: var(--slot-border, rgba(148, 163, 184, 0.4));
	}

	/* Buttons */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem 0.75rem;
		font-size: 0.75rem;
		border: 1px solid rgba(148, 163, 184, 0.3);
		border-radius: 4px;
		background: rgba(30, 41, 59, 0.8);
		color: #e2e8f0;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn:hover {
		background: rgba(51, 65, 85, 0.8);
		border-color: rgba(148, 163, 184, 0.5);
	}

	.btn--small {
		padding: 0.35rem 0.6rem;
		font-size: 0.7rem;
	}

	.btn--tiny {
		padding: 0.2rem 0.4rem;
		font-size: 0.65rem;
	}

	.btn--danger {
		background: rgba(239, 68, 68, 0.2);
		border-color: rgba(239, 68, 68, 0.4);
		color: #fca5a5;
	}

	.btn--danger:hover {
		background: rgba(239, 68, 68, 0.3);
	}
</style>
