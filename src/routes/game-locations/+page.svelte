		<script lang="ts">
			import { onMount } from 'svelte';
			import { supabase } from '$lib/api/supabaseClient';
			import type { GameLocationRewardRow, GameLocationRow, GameLocationRowCompositionRow, RewardRowAssignment, OriginRow } from '$lib/types/gameData';
			import { configToRewardRow } from '$lib/types/gameData';
			import { generateFinalLocationCardFromLayout } from '$lib/generators/game-locations/locationCardIconPlacer';
			import { getErrorMessage } from '$lib/utils';
			import { loadAllIcons } from '$lib/utils/iconPool';
			import { rewardIconTokensHaveAnyIcons } from '$lib/utils/rewardIconTokens';
			import { publicAssetUrl } from '$lib/utils/storage';
			import { fetchAll } from '$lib/services/dataService';
			import { fetchOriginRecords } from '$lib/features/origins/origins';
			import { PageLayout, Modal, type Tab } from '$lib/components/layout';
			import { ConfirmDialog, DataGrid, FilterBar, ImageUploader, RewardRowPreview } from '$lib/components/shared';
			import { LocationCardLayoutConfigurator } from '$lib/components/game-locations';
			import { Button, FormField, Input, Select } from '$lib/components/ui';

			const tabs: Tab[] = [
				{ id: 'locations', label: 'Locations', icon: '📍' },
				{ id: 'cards', label: 'Card Gallery', icon: '🖼️' }
			];
			let activeTab = $state('locations');

		type OriginOption = Pick<OriginRow, 'id' | 'name'>;
		type Location = GameLocationRow;

		let locations = $state<Location[]>([]);
	let origins = $state<OriginOption[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let searchQuery = $state('');
	let originFilter = $state<string>('all');

	let showForm = $state(false);
	let saving = $state(false);
		let formError = $state<string | null>(null);
		let nameError = $state<string | null>(null);

		let editingLocation = $state<Location | null>(null);
		let formData = $state({
			name: '',
			origin_id: null as string | null,
			background_image_path: null as string | null
		});

		let showDeleteConfirm = $state(false);
		let deleting = $state(false);
		let deleteTarget = $state<Location | null>(null);

	let generatingLocationIds = $state(new Set<string>());

	// Standalone reward rows + assignments
	let rewardRowRecords = $state<GameLocationRowCompositionRow[]>([]);
	let rewardRowAssignments = $state<RewardRowAssignment[]>([]);

	/** Get resolved reward rows for a location from junction table. */
	function getLocationRewardRows(locationId: string): GameLocationRewardRow[] {
		const assigned = rewardRowAssignments
			.filter((a) => a.location_id === locationId)
			.sort((a, b) => a.row_index - b.row_index);

		return assigned.map((a) => {
			const row = rewardRowRecords.find((r) => r.id === a.row_id);
			if (!row) return { type: 'gain', gain_icon_ids: [] } as GameLocationRewardRow;
			return configToRewardRow(row.type, row.config);
		});
	}
	let progressMessage = $state<string | null>(null);
	let showLayoutConfigurator = $state(false);
	let bulkGenerating = $state(false);
	let bulkCancelRequested = $state(false);

			const originNameById = $derived.by(() => new Map(origins.map((o) => [o.id, o.name])));

	const filteredLocations = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		return locations.filter((loc) => {
			if (originFilter !== 'all' && loc.origin_id !== originFilter) return false;
			if (!term) return true;
			return loc.name.toLowerCase().includes(term);
		});
		});

			const subtitleText = $derived.by(() => `${filteredLocations.length} locations`);

			function handleTabChange(tabId: string) {
				activeTab = tabId;
			}

			function getLocationBackgroundUrl(location: Location): string | null {
				return publicAssetUrl(location.background_image_path, { updatedAt: location.updated_at ?? 0 });
			}

			function getLocationCardImageUrl(location: Location): string | null {
				return publicAssetUrl(location.image_with_icons_path, { updatedAt: location.updated_at ?? 0 });
			}

			function getRewardRowsHref(location: Location): string {
				return `/reward-rows?location_id=${location.id}`;
			}

			onMount(() => {
				const params = new URLSearchParams(window.location.search);
				const create = params.get('create');
				const editId = params.get('edit');

			void loadData().finally(() => {
				if (create === '1') {
					openCreate();

					try {
						const url = new URL(window.location.href);
						url.searchParams.delete('create');
					window.history.replaceState(null, '', url.toString());
				} catch {
					// ignore
				}
				return;
			}

			if (editId) {
				activeTab = 'locations';
				const location = locations.find((l) => l.id === editId) ?? null;
				if (location) {
					openEdit(location);
				} else {
					alert('Location not found.');
				}

				try {
					const url = new URL(window.location.href);
					url.searchParams.delete('edit');
					window.history.replaceState(null, '', url.toString());
				} catch {
					// ignore
				}
			}
		});
	});

	async function loadData() {
		loading = true;
		error = null;
		try {
			await loadAllIcons();
			await Promise.all([loadOrigins(), loadLocations(), loadRewardRowData()]);
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadRewardRowData() {
		const [rows, assignments] = await Promise.all([
			fetchAll<GameLocationRowCompositionRow>('game_location_rows', '*'),
			fetchAll<RewardRowAssignment>('reward_row_assignments', '*')
		]);
		rewardRowRecords = rows;
		rewardRowAssignments = assignments;
	}

	async function loadOrigins() {
		const originRecords = await fetchOriginRecords();
		origins = originRecords
			.filter((origin) => origin.is_enabled !== false)
			.filter((origin) => Boolean(origin.id) && Boolean(origin.name))
			.map((origin) => ({ id: origin.id, name: origin.name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

		async function loadLocations() {
			const { data, error: err } = await supabase.from('game_locations').select('*').order('name');
			if (err) throw new Error(err.message);
		locations = (data ?? []) as Location[];
	}

		function resetForm() {
			formData = {
				name: '',
				origin_id: null,
				background_image_path: null
			};
			formError = null;
			nameError = null;
	}

	function openCreate() {
		editingLocation = null;
		resetForm();
		showForm = true;
	}

		function openEdit(location: Location) {
			editingLocation = location;
			formData = {
				name: location.name,
				origin_id: location.origin_id,
				background_image_path: location.background_image_path ?? null
			};
			formError = null;
			nameError = null;
		showForm = true;
	}

	async function saveLocation() {
		formError = null;
		nameError = null;

		const name = formData.name.trim();
			if (!name) {
				nameError = 'Name is required.';
				return;
			}

			const payload = {
				name,
				origin_id: formData.origin_id,
				background_image_path: formData.background_image_path
			};

		saving = true;
		try {
			const now = new Date().toISOString();
			if (editingLocation) {
				const { error: err } = await supabase
						.from('game_locations')
						.update({ ...payload, updated_at: now })
						.eq('id', editingLocation.id);
				if (err) throw new Error(err.message);
			} else {
				const { error: err } = await supabase.from('game_locations').insert({ ...payload, updated_at: now });
				if (err) throw new Error(err.message);
			}

			showForm = false;
			await loadLocations();
		} catch (err) {
			formError = getErrorMessage(err);
		} finally {
			saving = false;
		}
	}

	function hasRewardContent(row: GameLocationRewardRow): boolean {
		if (row.type === 'text') {
			return row.text.trim().length > 0;
		}
		if (row.type === 'trade') {
			return rewardIconTokensHaveAnyIcons(row.cost_icon_ids) || rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
			}
			return rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
		}

		function requestDelete(location: Location) {
			deleteTarget = location;
			showDeleteConfirm = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;

		deleting = true;
		try {
			const { error: err } = await supabase.from('game_locations').delete().eq('id', deleteTarget.id);
			if (err) throw new Error(err.message);
			await loadLocations();
		} catch (err) {
			alert(`Failed to delete location: ${getErrorMessage(err)}`);
		} finally {
			deleting = false;
			showDeleteConfirm = false;
			deleteTarget = null;
		}
	}

	async function generateLocationCardInternal(location: Location, opts?: { label?: string }): Promise<boolean> {
		if (generatingLocationIds.has(location.id)) return false;

		const nextGenerating = new Set(generatingLocationIds);
		nextGenerating.add(location.id);
		generatingLocationIds = nextGenerating;

		progressMessage = opts?.label ?? `Generating card for "${location.name}"...`;
		try {
			if (!location.background_image_path) throw new Error('Location is missing a base image.');
			const { path: uploadedPath, updated_at: updatedAt } = await generateFinalLocationCardFromLayout(location, {
				configKey: 'base',
				rewardRows: getLocationRewardRows(location.id)
			});

			const idx = locations.findIndex((l) => l.id === location.id);
			if (idx >= 0) {
				const nextLocations = [...locations];
				nextLocations[idx] = { ...nextLocations[idx], image_with_icons_path: uploadedPath, updated_at: updatedAt };
				locations = nextLocations;
			}
			progressMessage = `✓ Generated card for "${location.name}"`;
			return true;
		} catch (err) {
			progressMessage = `✗ Failed to generate card for "${location.name}": ${getErrorMessage(err)}`;
			console.error('Failed to generate game location card:', err);
			return false;
		} finally {
			const next = new Set(generatingLocationIds);
			next.delete(location.id);
			generatingLocationIds = next;
		}
	}

	async function generateLocationCard(location: Location) {
		await generateLocationCardInternal(location);
	}

	function requestCancelBulkGeneration() {
		if (!bulkGenerating) return;
		bulkCancelRequested = true;
		progressMessage = 'Cancelling after current card…';
	}

	async function generateAllFilteredLocationCards() {
		if (bulkGenerating) return;

		const targets = filteredLocations.filter((loc) => !!loc.background_image_path);
		if (targets.length === 0) {
			alert('No locations with background images in the current filter.');
			return;
		}

		if (targets.length > 25) {
			const ok = confirm(`Generate ${targets.length} location cards? This will overwrite existing PNGs.`);
			if (!ok) return;
		}

		bulkGenerating = true;
		bulkCancelRequested = false;

		let okCount = 0;
		let failCount = 0;

		try {
			for (let i = 0; i < targets.length; i++) {
				if (bulkCancelRequested) break;
				const loc = targets[i]!;
				const label = `Generating (${i + 1}/${targets.length}) "${loc.name}"…`;
				const ok = await generateLocationCardInternal(loc, { label });
				if (ok) okCount++;
				else failCount++;
			}

			if (bulkCancelRequested) {
				progressMessage = `⏹ Cancelled: generated ${okCount}/${targets.length} cards (${failCount} failed).`;
			} else if (failCount > 0) {
				progressMessage = `✓ Generated ${okCount}/${targets.length} cards (${failCount} failed).`;
			} else {
				progressMessage = `✓ Generated ${okCount}/${targets.length} cards.`;
			}
		} finally {
			bulkGenerating = false;
			bulkCancelRequested = false;
		}
	}
	</script>

<PageLayout
		title="Game Locations"
		subtitle={subtitleText}
		{tabs}
		{activeTab}
		onTabChange={handleTabChange}
	>
		{#snippet headerActions()}
			<Button variant="primary" onclick={openCreate}>+ Location</Button>
			<Button variant="secondary" onclick={() => (showLayoutConfigurator = true)}>Layout Template</Button>
			{#if activeTab === 'cards'}
				<Button variant="secondary" onclick={generateAllFilteredLocationCards} loading={bulkGenerating} disabled={bulkGenerating}>
					Generate All (Filtered)
				</Button>
				{#if bulkGenerating}
					<Button variant="danger" onclick={requestCancelBulkGeneration}>Cancel</Button>
				{/if}
			{/if}
		{/snippet}
		{#snippet children()}
			{#if error}
				<div class="banner banner--error">{error}</div>
			{/if}
			{#if progressMessage}
				<div class="banner" class:banner--error={progressMessage.startsWith('✗')}>{progressMessage}</div>
			{/if}

		<FilterBar
			bind:searchValue={searchQuery}
			searchPlaceholder="Search locations…"
			filters={[
				{
					key: 'origin_id',
					label: 'Origin',
					value: originFilter === 'all' ? null : originFilter,
					options: origins.map((o) => ({ value: o.id, label: o.name }))
				}
			]}
			onfilterchange={(key, value) => {
				if (key === 'origin_id') originFilter = value ? String(value) : 'all';
			}}
			/>

				{#if loading}
					<div class="placeholder">
						<p>Loading…</p>
					</div>
				{:else if activeTab === 'locations'}
					<DataGrid items={filteredLocations} columns={3} emptyIcon="📍" emptyMessage="No locations yet">
							{#snippet item({ item })}
								{@const displayRows = getLocationRewardRows(item.id).filter(hasRewardContent)}
								<div class="location-card">
									<header class="location-card__header">
										<div class="location-card__title">
											<h3>{item.name}</h3>
											<p class="location-card__subtitle">
												{#if item.origin_id}
													Origin: {originNameById.get(item.origin_id) ?? 'Unknown'}
												{:else}
													Origin: None
												{/if}
											</p>
								</div>
								<div class="location-card__actions">
									<a class="location-card__link" href={getRewardRowsHref(item)} data-sveltekit-preload-data>Rows</a>
									<Button size="sm" onclick={() => openEdit(item)}>Edit</Button>
									<Button size="sm" variant="danger" onclick={() => requestDelete(item)}>Delete</Button>
								</div>
						</header>

						<div class="location-card__rewards">
							{#if displayRows.length === 0}
								<p class="location-card__empty-rewards">No rewards set</p>
							{:else}
								{#each displayRows as row, idx (idx)}
									<RewardRowPreview {row} iconSize={24} />
								{/each}
							{/if}
						</div>
						</div>
						{/snippet}
					</DataGrid>
				{:else}
					<DataGrid items={filteredLocations} columns={3} emptyIcon="🖼️" emptyMessage="No locations yet">
						{#snippet item({ item })}
							{@const bgUrl = getLocationBackgroundUrl(item)}
							{@const cardUrl = getLocationCardImageUrl(item)}
							<div class="location-card location-card--gallery">
								<div class="location-card__preview" aria-label="Location card preview">
									{#if cardUrl}
										<img src={cardUrl} alt={`${item.name} card`} loading="lazy" />
									{:else if bgUrl}
										<img src={bgUrl} alt={`${item.name} background`} loading="lazy" />
										<div class="location-card__preview-overlay">No card PNG</div>
									{:else}
										<div class="location-card__preview-placeholder">No image</div>
									{/if}
								</div>

								<header class="location-card__header">
									<div class="location-card__title">
										<h3>{item.name}</h3>
										<p class="location-card__subtitle">
											{#if item.origin_id}
												Origin: {originNameById.get(item.origin_id) ?? 'Unknown'}
											{:else}
												Origin: None
											{/if}
										</p>
									</div>
									<div class="location-card__actions">
										<a class="location-card__link" href={getRewardRowsHref(item)} data-sveltekit-preload-data>Rows</a>
										<Button size="sm" onclick={() => openEdit(item)}>Edit</Button>
										<Button
											size="sm"
											variant="primary"
											disabled={!bgUrl}
											loading={generatingLocationIds.has(item.id)}
											onclick={() => generateLocationCard(item)}
										>
											{cardUrl ? 'Regenerate' : 'Generate'}
										</Button>
										<Button size="sm" variant="danger" onclick={() => requestDelete(item)}>Delete</Button>
									</div>
								</header>
							</div>
						{/snippet}
					</DataGrid>
				{/if}
			{/snippet}
	</PageLayout>

<style>
	.banner {
		padding: 0.75rem 1rem;
		margin: 0 0 0.5rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(15, 23, 42, 0.55);
		color: #cbd5f5;
	}

	.banner--error {
		border-color: rgba(248, 113, 113, 0.35);
		background: rgba(248, 113, 113, 0.12);
		color: #fecaca;
	}

	.placeholder {
		display: grid;
		place-items: center;
		min-height: 240px;
		color: #94a3b8;
	}

		.location-card {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			padding: 1rem;
			border-radius: 12px;
			border: 1px solid rgba(148, 163, 184, 0.15);
			background: rgba(15, 23, 42, 0.5);
			box-shadow: 0 10px 20px rgba(2, 6, 23, 0.25);
		}

	.location-card__preview {
		width: 100%;
		aspect-ratio: 600 / 437;
		border-radius: 12px;
		overflow: hidden;
		position: relative;
		background: rgba(2, 6, 23, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
	}

	.location-card__preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.location-card__preview-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 0.4rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: rgba(226, 232, 240, 0.95);
		background: linear-gradient(to top, rgba(2, 6, 23, 0.85), rgba(2, 6, 23, 0));
	}

	.location-card__preview-placeholder {
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		color: #94a3b8;
		font-weight: 600;
	}

	.location-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.location-card__title {
		min-width: 0;
	}

	.location-card__title h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #f8fafc;
	}

	.location-card__subtitle {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: #94a3b8;
	}

	.location-card__actions {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.location-card__link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.35rem 0.55rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-decoration: none;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.35);
		color: #e2e8f0;
		background: rgba(15, 23, 42, 0.55);
	}

	.location-card__rewards {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.location-card__empty-rewards {
		margin: 0;
		color: #64748b;
		font-size: 0.875rem;
	}

	.image-note {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.75);
	}
	</style>

		<Modal bind:open={showForm} title={editingLocation ? 'Edit Location' : 'New Location'} size="lg">
			{#snippet children()}
				{#if formError}
					<div class="banner banner--error">{formError}</div>
		{/if}

		<FormField label="Name" required={true} error={nameError ?? undefined}>
			{#snippet children()}
				<Input bind:value={formData.name} placeholder="Location name" />
			{/snippet}
		</FormField>

				<FormField label="Origin (optional)">
					{#snippet children()}
						<Select
							value={formData.origin_id ?? ''}
							options={[
								{ value: '', label: 'None' },
								...origins.map((o) => ({ value: o.id, label: o.name }))
							]}
							onchange={(e) => {
								const v = (e.target as HTMLSelectElement).value;
								formData.origin_id = v === '' ? null : v;
							}}
						/>
					{/snippet}
					</FormField>

			{#if editingLocation}
					{@const editRewardRows = getLocationRewardRows(editingLocation.id).filter(hasRewardContent)}
					<FormField label="Reward Rows (read-only)" helperText="Edit reward rows on the Reward Rows page.">
						{#if editRewardRows.length === 0}
							<p style="color: #64748b; font-size: 0.85rem; margin: 0;">No reward rows assigned.</p>
						{:else}
							<div style="display: flex; flex-direction: column; gap: 0.5rem;">
								{#each editRewardRows as row, idx (idx)}
									<RewardRowPreview {row} iconSize={28} />
								{/each}
							</div>
						{/if}
						<a class="location-card__link" href={getRewardRowsHref(editingLocation)} style="margin-top: 0.5rem; width: fit-content;">
							Edit Reward Rows
						</a>
					</FormField>
				{/if}
				<FormField label="Background Art (optional)" helperText="Used as the default background for this location (and stage location cards).">
					<ImageUploader
						bind:value={formData.background_image_path}
						folder="game_locations"
						maxSizeMB={20}
						cropTransparent={false}
						onerror={(err) => alert(`Upload failed: ${err}`)}
				/>
			</FormField>
		<p class="image-note">
			Spirit World v2 can use generated location card images (final-with-icons) or raw background art when building a map.
		</p>
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showForm = false)} disabled={saving}>Cancel</Button>
		<Button variant="primary" onclick={saveLocation} loading={saving}>Save</Button>
	{/snippet}
</Modal>

<LocationCardLayoutConfigurator
	isOpen={showLayoutConfigurator}
	locations={locations}
	getRewardRows={getLocationRewardRows}
	onClose={() => (showLayoutConfigurator = false)}
/>

<ConfirmDialog
	bind:open={showDeleteConfirm}
	variant="danger"
	title="Delete Location"
	message={deleteTarget ? `Delete "${deleteTarget.name}"? This cannot be undone.` : 'Delete this location?'}
	confirmLabel={deleting ? 'Deleting…' : 'Delete'}
	onconfirm={confirmDelete}
	oncancel={() => (deleteTarget = null)}
/>
