<script lang="ts">
	import type { AssetImage } from './types';
	import MultiSelectBar from '$lib/components/shared/MultiSelectBar.svelte';

	type Props = {
		originImages: AssetImage[];
		runeImages: AssetImage[];
		hexSpiritImages: AssetImage[];
		diceFaceImages: AssetImage[];
		miscAssetImages: AssetImage[];
		onDeleteMultiple?: (ids: string[]) => void;
	};

	let {
		originImages,
		runeImages,
		hexSpiritImages,
		diceFaceImages,
		miscAssetImages,
		onDeleteMultiple
	}: Props = $props();

	let selectedIds = $state<Set<string>>(new Set());

	// Combine all assets for total count
	const allAssets = $derived([
		...originImages,
		...runeImages,
		...hexSpiritImages,
		...diceFaceImages,
		...miscAssetImages
	]);

	function toggleSelect(id: string) {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	}

	function selectAll() {
		selectedIds = new Set(allAssets.map((asset) => asset.filename));
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function deleteSelected() {
		if (onDeleteMultiple && selectedIds.size > 0) {
			onDeleteMultiple(Array.from(selectedIds));
			selectedIds = new Set();
		}
	}
</script>

<MultiSelectBar
	selectedCount={selectedIds.size}
	totalCount={allAssets.length}
	onSelectAll={selectAll}
	onDeselectAll={deselectAll}
	onDeleteSelected={deleteSelected}
/>

<div class="list-view">
	<section class="asset-section">
		<h2>Origin Icons ({originImages.length})</h2>
		<div class="asset-list">
			{#each originImages as asset}
				<div class="asset-row" class:selected={selectedIds.has(asset.filename)}>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={selectedIds.has(asset.filename)}
							onchange={() => toggleSelect(asset.filename)}
						/>
					</div>
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No origin icons found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Rune Icons ({runeImages.length})</h2>
		<div class="asset-list">
			{#each runeImages as asset}
				<div class="asset-row" class:selected={selectedIds.has(asset.filename)}>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={selectedIds.has(asset.filename)}
							onchange={() => toggleSelect(asset.filename)}
						/>
					</div>
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No rune icons found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Hex Spirit Images ({hexSpiritImages.length})</h2>
		<div class="asset-list">
			{#each hexSpiritImages as asset}
				<div class="asset-row" class:selected={selectedIds.has(asset.filename)}>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={selectedIds.has(asset.filename)}
							onchange={() => toggleSelect(asset.filename)}
						/>
					</div>
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No hex spirit images found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Dice Faces ({diceFaceImages.length})</h2>
		<div class="asset-list">
			{#each diceFaceImages as asset}
				<div class="asset-row" class:selected={selectedIds.has(asset.filename)}>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={selectedIds.has(asset.filename)}
							onchange={() => toggleSelect(asset.filename)}
						/>
					</div>
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No dice faces found</p>
			{/each}
		</div>
	</section>

	<section class="asset-section">
		<h2>Misc Assets ({miscAssetImages.length})</h2>
		<div class="asset-list">
			{#each miscAssetImages as asset}
				<div class="asset-row" class:selected={selectedIds.has(asset.filename)}>
					<div class="checkbox-wrapper">
						<input
							type="checkbox"
							checked={selectedIds.has(asset.filename)}
							onchange={() => toggleSelect(asset.filename)}
						/>
					</div>
					<img src={asset.url} alt={asset.name} />
					<span class="asset-name">{asset.name}</span>
				</div>
			{:else}
				<p class="empty-message">No misc assets found</p>
			{/each}
		</div>
	</section>
</div>

<style>
	.list-view {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.asset-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 0.75rem;
	}

	.asset-section h2 {
		margin: 0 0 0.5rem 0;
		color: #f8fafc;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.asset-list {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.asset-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem;
		background: rgba(30, 41, 59, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		border-radius: 6px;
		transition: all 0.15s ease;
		cursor: pointer;
	}

	.asset-row:hover {
		background: rgba(30, 41, 59, 0.7);
		border-color: rgba(148, 163, 184, 0.25);
	}

	.asset-row.selected {
		background: rgba(59, 130, 246, 0.15);
		border-color: rgba(59, 130, 246, 0.3);
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.checkbox-wrapper input[type='checkbox'] {
		width: 16px;
		height: 16px;
		cursor: pointer;
		accent-color: #3b82f6;
	}

	.asset-row img {
		width: 32px;
		height: 32px;
		object-fit: contain;
		flex-shrink: 0;
	}

	.asset-name {
		font-size: 0.75rem;
		color: #cbd5e1;
	}

	.empty-message {
		color: #94a3b8;
		font-size: 0.7rem;
		font-style: italic;
		margin: 0.5rem 0;
	}
</style>
