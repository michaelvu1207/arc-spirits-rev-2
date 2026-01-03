<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { supabase } from '$lib/api/supabaseClient';
	import { processAndUploadImage } from '$lib/utils/storage';
	import { generateQuestCardPNG } from '$lib/generators/cards';
	import type { TravelerQuestRow } from '$lib/types/gameData';
	import { Button } from '$lib/components/ui';

	interface Props {
		isOpen?: boolean;
		quests?: TravelerQuestRow[];
		onClose?: () => void;
		onQuestUpdated?: () => void;
	}

	let { isOpen = $bindable(false), quests = [], onClose, onQuestUpdated }: Props = $props();

	// Gallery state
	let selectedIds = $state(new Set<string>());
	let generatingIds = $state(new Set<string>());
	let progressMessage = $state('');

	const questsWithImages = $derived(
		quests.filter((q) => q.card_image_path).sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999))
	);

	const questsWithoutImages = $derived(
		quests.filter((q) => !q.card_image_path).sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999))
	);

	const allQuests = $derived([...questsWithImages, ...questsWithoutImages]);

	const selectedCount = $derived(selectedIds.size);
	const generatedCount = $derived(questsWithImages.length);
	const totalCount = $derived(quests.length);

	function getCardImageUrl(quest: TravelerQuestRow): string | null {
		if (!quest.card_image_path) return null;
		const { data } = supabase.storage.from('game_assets').getPublicUrl(quest.card_image_path);
		return data?.publicUrl || null;
	}

	function close() {
		isOpen = false;
		onClose?.();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}

	function toggleSelection(questId: string) {
		if (selectedIds.has(questId)) {
			selectedIds.delete(questId);
		} else {
			selectedIds.add(questId);
		}
		selectedIds = new Set(selectedIds);
	}

	function selectAll() {
		selectedIds = new Set(allQuests.map((q) => q.id));
	}

	function deselectAll() {
		selectedIds.clear();
		selectedIds = new Set(selectedIds);
	}

	async function generateCard(quest: TravelerQuestRow) {
		generatingIds.add(quest.id);
		generatingIds = new Set(generatingIds);
		progressMessage = `Generating card for "${quest.title}"...`;

		try {
			const blob = await generateQuestCardPNG(quest);
			const folder = 'traveler_quest_cards';

			const { data, error: uploadError } = await processAndUploadImage(blob, {
				folder,
				filename: quest.id,
				cropTransparent: false,
				upsert: true
			});

			if (uploadError) throw uploadError;

			const uploadedPath = data?.path ?? '';
			const { error: updateError } = await supabase
				.from('traveler_quests')
				.update({ card_image_path: uploadedPath, updated_at: new Date().toISOString() })
				.eq('id', quest.id);

			if (updateError) throw updateError;

			progressMessage = `Generated card for "${quest.title}"`;
			onQuestUpdated?.();
		} catch (err) {
			console.error('Failed to generate quest card:', err);
			progressMessage = `Failed to generate card for "${quest.title}"`;
		} finally {
			generatingIds.delete(quest.id);
			generatingIds = new Set(generatingIds);
		}
	}

	async function generateSelected() {
		const selected = allQuests.filter((q) => selectedIds.has(q.id));
		if (selected.length === 0) {
			alert('No quests selected');
			return;
		}

		progressMessage = `Generating ${selected.length} cards...`;

		for (let i = 0; i < selected.length; i++) {
			const quest = selected[i];
			progressMessage = `Generating card ${i + 1}/${selected.length}: "${quest.title}"...`;
			await generateCard(quest);
		}

		progressMessage = `Generated ${selected.length} cards`;
		deselectAll();
	}

	async function generateAll() {
		if (!confirm(`Generate cards for all ${totalCount} quests?`)) return;

		progressMessage = `Generating ${totalCount} cards...`;

		for (let i = 0; i < allQuests.length; i++) {
			const quest = allQuests[i];
			progressMessage = `Generating card ${i + 1}/${totalCount}: "${quest.title}"...`;
			await generateCard(quest);
		}

		progressMessage = `Generated ${totalCount} cards`;
	}

	async function downloadCard(quest: TravelerQuestRow) {
		const url = getCardImageUrl(quest);
		if (!url) return;

		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = blobUrl;
			a.download = `quest-${quest.title.toLowerCase().replace(/\s+/g, '-')}.png`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(blobUrl);
		} catch (err) {
			console.error('Failed to download card:', err);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<div
		class="gallery-backdrop"
		role="button"
		tabindex="0"
		onclick={handleBackdropClick}
		onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleBackdropClick(e as unknown as MouseEvent)}
		transition:fade={{ duration: 200 }}
	>
		<div class="gallery-panel" transition:fly={{ y: 20, duration: 300 }}>
			<div class="gallery-header">
				<h2>Quest Card Gallery</h2>
				<button class="close-btn" onclick={close}>&times;</button>
			</div>

			<div class="gallery-toolbar">
				<div class="toolbar-left">
					<span class="count-badge">{generatedCount}/{totalCount} generated</span>
					{#if selectedCount > 0}
						<Button variant="secondary" size="sm" onclick={deselectAll}>
							Deselect All
						</Button>
						<Button variant="primary" size="sm" onclick={generateSelected}>
							Generate Selected ({selectedCount})
						</Button>
					{:else}
						<Button variant="secondary" size="sm" onclick={selectAll}>
							Select All
						</Button>
					{/if}
				</div>
				<div class="toolbar-right">
					<Button variant="primary" size="sm" onclick={generateAll}>
						Generate All
					</Button>
				</div>
			</div>

			{#if progressMessage}
				<div class="progress-message">{progressMessage}</div>
			{/if}

			<div class="gallery-content">
				{#if allQuests.length === 0}
					<div class="empty-state">
						<p>No quests available.</p>
						<p class="hint">Create quests in the Quests tab to generate cards.</p>
					</div>
				{:else}
					<div class="gallery-grid">
						{#each allQuests as quest (quest.id)}
							{@const imageUrl = getCardImageUrl(quest)}
							{@const isSelected = selectedIds.has(quest.id)}
							{@const isGenerating = generatingIds.has(quest.id)}
							{@const hasImage = !!quest.card_image_path}

							<div class="card-item" class:selected={isSelected} class:has-image={hasImage}>
								<div class="card-checkbox">
									<input
										type="checkbox"
										checked={isSelected}
										onchange={() => toggleSelection(quest.id)}
										disabled={isGenerating}
									/>
								</div>

								<div class="card-image-wrapper">
									{#if hasImage && imageUrl}
										<img src={imageUrl} alt={quest.title} loading="lazy" />
										<div class="card-status generated">
											<span class="status-icon">&#10003;</span>
										</div>
									{:else}
										<div class="card-placeholder">
											<div class="placeholder-icon">📜</div>
											<span class="placeholder-text">{quest.title}</span>
										</div>
									{/if}

									{#if isGenerating}
										<div class="card-generating">
											<div class="spinner"></div>
										</div>
									{/if}
								</div>

								<div class="card-info">
									<h3 class="card-name">{quest.title}</h3>
									<div class="card-actions">
										{#if hasImage}
											<Button
												variant="secondary"
												size="sm"
												onclick={() => downloadCard(quest)}
											>
												Download
											</Button>
										{/if}
										<Button
											variant={hasImage ? 'secondary' : 'primary'}
											size="sm"
											onclick={() => generateCard(quest)}
											disabled={isGenerating}
										>
											{isGenerating ? 'Generating...' : hasImage ? 'Regenerate' : 'Generate'}
										</Button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.gallery-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
	}

	.gallery-panel {
		background: #0f172a;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 12px;
		width: 100%;
		max-width: 1400px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
	}

	.gallery-header {
		padding: 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(15, 23, 42, 0.8);
		flex-shrink: 0;
	}

	.gallery-header h2 {
		margin: 0;
		font-size: 1.5rem;
		color: #f8fafc;
	}

	.close-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 2rem;
		cursor: pointer;
		padding: 0;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: rgba(148, 163, 184, 0.1);
		color: #f8fafc;
	}

	.gallery-toolbar {
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
		background: rgba(30, 41, 59, 0.4);
		flex-shrink: 0;
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.count-badge {
		padding: 0.25rem 0.5rem;
		background: rgba(168, 85, 247, 0.1);
		border: 1px solid rgba(168, 85, 247, 0.3);
		border-radius: 4px;
		font-size: 0.75rem;
		color: #c084fc;
	}

	.progress-message {
		padding: 0.75rem 1.5rem;
		background: rgba(59, 130, 246, 0.1);
		border-bottom: 1px solid rgba(59, 130, 246, 0.2);
		color: #60a5fa;
		font-size: 0.85rem;
		flex-shrink: 0;
	}

	.gallery-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
		min-height: 0;
	}

	.empty-state {
		text-align: center;
		padding: 4rem 2rem;
		color: #94a3b8;
	}

	.empty-state p {
		margin: 0.5rem 0;
	}

	.empty-state .hint {
		font-size: 0.9rem;
		color: #64748b;
	}

	.gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.card-item {
		display: flex;
		flex-direction: column;
		background: rgba(15, 23, 42, 0.6);
		border: 2px solid rgba(148, 163, 184, 0.15);
		border-radius: 10px;
		overflow: hidden;
		transition: all 0.2s;
		position: relative;
	}

	.card-item:hover {
		transform: translateY(-4px);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
		border-color: rgba(148, 163, 184, 0.3);
	}

	.card-item.selected {
		border-color: #a855f7;
		background: rgba(168, 85, 247, 0.05);
	}

	.card-item.has-image {
		border-color: rgba(34, 197, 94, 0.3);
	}

	.card-item.has-image:hover {
		border-color: rgba(34, 197, 94, 0.5);
	}

	.card-checkbox {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 10;
	}

	.card-checkbox input[type='checkbox'] {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
		accent-color: #a855f7;
	}

	.card-image-wrapper {
		width: 100%;
		aspect-ratio: 7 / 5;
		overflow: hidden;
		background: #1e293b;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}

	.card-image-wrapper img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.card-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 1rem;
		text-align: center;
		background: linear-gradient(135deg, rgba(42, 35, 24, 0.8), rgba(26, 22, 16, 0.9));
	}

	.placeholder-icon {
		font-size: 3rem;
	}

	.placeholder-text {
		color: #94a3b8;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.card-status {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.7rem;
		font-weight: 600;
	}

	.card-status.generated {
		background: rgba(34, 197, 94, 0.2);
		color: #4ade80;
		border: 1px solid rgba(34, 197, 94, 0.3);
	}

	.card-generating {
		position: absolute;
		inset: 0;
		background: rgba(15, 23, 42, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(148, 163, 184, 0.2);
		border-top-color: #a855f7;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.card-info {
		padding: 0.75rem;
		border-top: 1px solid rgba(148, 163, 184, 0.1);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-name {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: #f8fafc;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	@media (max-width: 768px) {
		.gallery-panel {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.gallery-grid {
			grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
			gap: 1rem;
		}
	}
</style>
