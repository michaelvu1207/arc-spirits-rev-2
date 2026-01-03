<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { GameLocationRewardRow, GameLocationRow, GameLocationRowCompositionRow, OriginRow } from '$lib/types/gameData';
	import { fetchGameLocationRows } from '$lib/api/gameLocationRows';
	import { getErrorMessage } from '$lib/utils';
	import { loadAllIcons, getIconPoolUrl } from '$lib/utils/iconPool';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { PageLayout, Modal, type Tab } from '$lib/components/layout';
	import { ConfirmDialog, DataGrid, FilterBar, ImageUploader } from '$lib/components/shared';
	import { LocationPlacerModal, LocationRewardRowsEditor } from '$lib/components/game-locations';
	import { Button, FormField, Input, Select } from '$lib/components/ui';

	const tabs: Tab[] = [{ id: 'locations', label: 'Locations', icon: '📍' }];
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
		reward_rows: normalizeRewardRows([]),
		background_image_path: null as string | null
	});

	let showDeleteConfirm = $state(false);
	let deleting = $state(false);
	let deleteTarget = $state<Location | null>(null);

	let iconPlacerOpen = $state(false);
	let locationRows = $state<GameLocationRowCompositionRow[]>([]);
	let locationRowsLoading = $state(false);
	let locationRowsError = $state<string | null>(null);

	const originNameById = $derived.by(() => new Map(origins.map((o) => [o.id, o.name])));

	const filteredLocations = $derived.by(() => {
		const term = searchQuery.trim().toLowerCase();
		return locations.filter((loc) => {
			if (originFilter !== 'all' && loc.origin_id !== originFilter) return false;
			if (!term) return true;
			return loc.name.toLowerCase().includes(term);
		});
	});

	onMount(loadData);

	async function loadData() {
		loading = true;
		error = null;
		try {
			await loadAllIcons();
			await Promise.all([loadOrigins(), loadLocations()]);
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadOrigins() {
		const { data, error: err } = await supabase.from('origins').select('id, name').order('name');
		if (err) throw new Error(err.message);
		origins = (data ?? []) as OriginOption[];
	}

	function normalizeRewardRows(rows: any): GameLocationRewardRow[] {
		if (!Array.isArray(rows)) return [];
		return rows.map((row) => {
			if (!row || typeof row !== 'object') {
				return { type: 'gain', gain_icon_ids: [] } satisfies GameLocationRewardRow;
			}

			// Back-compat for earlier shape: { icon_ids: [...] }
			if (Array.isArray((row as any).icon_ids)) {
				return {
					type: 'gain',
					gain_icon_ids: (row as any).icon_ids.filter((id: any) => typeof id === 'string')
				} satisfies GameLocationRewardRow;
			}

			const rawType = (row as any).type;
			if (rawType === 'text') {
				return {
					type: 'text',
					text: typeof (row as any).text === 'string' ? (row as any).text : ''
				} satisfies GameLocationRewardRow;
			}

			const type = rawType === 'trade' ? 'trade' : 'gain';

			const gain_icon_ids = Array.isArray((row as any).gain_icon_ids)
				? (row as any).gain_icon_ids.filter((id: any) => typeof id === 'string')
				: [];

			if (type === 'trade') {
				const cost_icon_ids = Array.isArray((row as any).cost_icon_ids)
					? (row as any).cost_icon_ids.filter((id: any) => typeof id === 'string')
					: [];

				return {
					type: 'trade',
					cost_icon_ids,
					gain_icon_ids
				} satisfies GameLocationRewardRow;
			}

			return { type: 'gain', gain_icon_ids } satisfies GameLocationRewardRow;
		});
	}

	async function loadLocations() {
		const { data, error: err } = await supabase.from('game_locations').select('*').order('name');
		if (err) throw new Error(err.message);

		locations = (data ?? []).map((row: any) => ({
			...row,
			reward_rows: normalizeRewardRows(row.reward_rows)
		})) as Location[];
	}

	function resetForm() {
		formData = { name: '', origin_id: null, reward_rows: normalizeRewardRows([]), background_image_path: null };
		formError = null;
		nameError = null;
	}

	function openCreate() {
		editingLocation = null;
		resetForm();
		locationRows = [];
		locationRowsError = null;
		locationRowsLoading = false;
		showForm = true;
	}

	function openEdit(location: Location) {
		editingLocation = location;
		formData = {
			name: location.name,
			origin_id: location.origin_id,
			reward_rows: normalizeRewardRows(location.reward_rows),
			background_image_path: location.background_image_path
		};
		locationRows = [];
		locationRowsError = null;
		locationRowsLoading = false;
		void loadLocationRows(location.id);
		formError = null;
		nameError = null;
		showForm = true;
	}

	async function loadLocationRows(locationId: string) {
		locationRowsLoading = true;
		locationRowsError = null;
		try {
			locationRows = await fetchGameLocationRows(locationId);
		} catch (err) {
			locationRows = [];
			locationRowsError = getErrorMessage(err);
		} finally {
			locationRowsLoading = false;
		}
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
			reward_rows: normalizeRewardRows(formData.reward_rows),
			background_image_path: formData.background_image_path
		};

		saving = true;
		try {
			if (editingLocation) {
				const { error: err } = await supabase
					.from('game_locations')
					.update(payload)
					.eq('id', editingLocation.id);
				if (err) throw new Error(err.message);
			} else {
				const { error: err } = await supabase.from('game_locations').insert(payload);
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
			return (row.cost_icon_ids?.length ?? 0) > 0 || (row.gain_icon_ids?.length ?? 0) > 0;
		}
		return (row.gain_icon_ids?.length ?? 0) > 0;
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
</script>

<PageLayout
	title="Game Locations"
	subtitle={`${filteredLocations.length} locations`}
	{tabs}
	{activeTab}
>
	{#snippet headerActions()}
		<Button variant="primary" onclick={openCreate}>+ Location</Button>
			<Button
				variant="secondary"
				onclick={() => (iconPlacerOpen = true)}
				disabled={locations.length === 0}
			>
				Icon Placer
			</Button>
		{/snippet}
	{#snippet children()}
		{#if error}
			<div class="banner banner--error">{error}</div>
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
		{:else}
			<DataGrid items={filteredLocations} columns={3} emptyIcon="📍" emptyMessage="No locations yet">
				{#snippet item({ item })}
					{@const previewUrl = publicAssetUrl(item.image_with_icons_path ?? item.background_image_path, {
						updatedAt: item.updated_at ?? undefined
					})}
					{@const displayRows = (item.reward_rows ?? []).filter(hasRewardContent)}
					<div class="location-card">
						{#if previewUrl}
							<div class="location-card__preview">
								<img src={previewUrl} alt={`Preview for ${item.name}`} loading="lazy" />
								{#if item.image_with_icons_path}
									<span class="location-card__badge">With Icons</span>
								{:else}
									<span class="location-card__badge">Background</span>
								{/if}
							</div>
						{/if}
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
								<Button size="sm" onclick={() => openEdit(item)}>Edit</Button>
								<Button size="sm" variant="danger" onclick={() => requestDelete(item)}>Delete</Button>
							</div>
						</header>

							<div class="location-card__rewards">
								{#if displayRows.length === 0}
									<p class="location-card__empty-rewards">No rewards set</p>
								{:else}
									{#each displayRows as row, idx (idx)}
										<div
											class="reward-row"
											class:reward-row--trade={row.type === 'trade'}
											class:reward-row--text={row.type === 'text'}
										>
											<span class="reward-row__label">
												{row.type === 'trade' ? 'Trade' : row.type === 'text' ? 'Text' : 'Gain Reward'}
											</span>

											{#if row.type === 'trade'}
												<div class="reward-row__trade">
													<div class="reward-row__icons">
														{#each row.cost_icon_ids as iconId, iconIdx (iconIdx)}
															{@const url = getIconPoolUrl(iconId)}
															<div class="reward-row__icon">
																{#if url}
																	<img src={url} alt="Cost icon" />
																{:else}
																	<span class="reward-row__icon-placeholder">?</span>
																{/if}
															</div>
														{/each}
													</div>
													<span class="reward-row__arrow">→</span>
													<div class="reward-row__icons">
														{#each row.gain_icon_ids as iconId, iconIdx (iconIdx)}
															{@const url = getIconPoolUrl(iconId)}
															<div class="reward-row__icon">
																{#if url}
																	<img src={url} alt="Gain icon" />
																{:else}
																	<span class="reward-row__icon-placeholder">?</span>
																{/if}
															</div>
														{/each}
													</div>
												</div>
											{:else if row.type === 'gain'}
												<div class="reward-row__icons">
													{#each row.gain_icon_ids as iconId, iconIdx (iconIdx)}
														{@const url = getIconPoolUrl(iconId)}
														<div class="reward-row__icon">
															{#if url}
																<img src={url} alt="Reward icon" />
															{:else}
																<span class="reward-row__icon-placeholder">?</span>
															{/if}
														</div>
													{/each}
												</div>
											{:else}
												<div class="reward-row__text">{row.text}</div>
											{/if}
										</div>
									{/each}
								{/if}
							</div>
					</div>
				{/snippet}
			</DataGrid>
		{/if}
	{/snippet}
</PageLayout>

<style>
	.banner {
		padding: 0.75rem 1rem;
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
		position: relative;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
		aspect-ratio: 16 / 9;
	}

	.location-card__preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.location-card__badge {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		padding: 0.25rem 0.5rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.5);
		color: #e2e8f0;
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

	.reward-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.65rem;
		border-radius: 10px;
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.12);
	}

	.reward-row--trade {
		align-items: flex-start;
	}

	.reward-row--text {
		align-items: flex-start;
	}

	.reward-row__label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.reward-row__icons {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.reward-row__text {
		flex: 1;
		text-align: right;
		font-size: 0.85rem;
		color: #e2e8f0;
		line-height: 1.2;
		white-space: pre-wrap;
	}

	.reward-row__trade {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: flex-end;
		flex: 1;
	}

	.reward-row__arrow {
		color: #94a3b8;
		font-weight: 800;
	}

	.reward-row__icon {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		overflow: hidden;
		background: rgba(15, 23, 42, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.15);
		display: grid;
		place-items: center;
	}

	.reward-row__icon img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.reward-row__icon-placeholder {
		font-size: 0.85rem;
		color: #64748b;
	}

	.image-uploads {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1rem;
		padding: 0.75rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(15, 23, 42, 0.35);
	}

	.image-upload-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.upload-label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: rgba(148, 163, 184, 0.85);
	}

	.generated-preview {
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
	}

	.generated-preview img {
		display: block;
		width: 100%;
		height: auto;
	}

	.generated-rows {
		display: grid;
		gap: 0.6rem;
		max-height: 320px;
		overflow: auto;
		padding-right: 0.2rem;
	}

	.generated-row {
		display: grid;
		gap: 0.35rem;
		padding: 0.5rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
	}

	.generated-row__label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: rgba(148, 163, 184, 0.9);
	}

	.generated-row img {
		display: block;
		width: 100%;
		height: auto;
		border-radius: 8px;
	}

	.generated-row__missing {
		display: grid;
		place-items: center;
		min-height: 120px;
		border-radius: 8px;
		border: 1px dashed rgba(148, 163, 184, 0.25);
		color: #94a3b8;
		background: rgba(2, 6, 23, 0.2);
		font-size: 0.8rem;
	}

	.generated-placeholder {
		display: grid;
		place-items: center;
		min-height: 200px;
		border-radius: 10px;
		border: 1px dashed rgba(148, 163, 184, 0.25);
		color: #94a3b8;
		background: rgba(2, 6, 23, 0.2);
	}

	.image-note {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.75);
	}

	@media (max-width: 1200px) {
		.image-uploads {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 860px) {
		.image-uploads {
			grid-template-columns: 1fr;
		}
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
			<div class="image-uploads">
				<div class="image-upload-section">
					<div class="upload-label">Background Image</div>
					<ImageUploader
						bind:value={formData.background_image_path}
						folder={`game_locations/${editingLocation.id}/background`}
						maxSizeMB={50}
						cropTransparent={false}
						onupload={(path) => {
							formData.background_image_path = path;
						}}
						onerror={(err) => alert(`Upload failed: ${err}`)}
					/>
				</div>
				<div class="image-upload-section">
					<div class="upload-label">Generated Rows</div>
					{#if locationRowsLoading}
						<div class="generated-placeholder">
							<span>Loading rows…</span>
						</div>
					{:else if locationRows.length === 0}
						<div class="generated-placeholder">
							<span>Not yet generated</span>
							<p class="image-note">Render rows in Icon Placer.</p>
						</div>
					{:else}
						<div class="generated-rows">
							{#each locationRows as row (row.id)}
								{@const rowUrl = row.row_image_path
									? publicAssetUrl(row.row_image_path, { updatedAt: row.updated_at ?? undefined })
									: null}
								<div class="generated-row">
									<div class="generated-row__label">{row.type} row {row.row_index + 1}</div>
									{#if rowUrl}
										<img src={rowUrl} alt={`Generated ${row.type} row ${row.row_index + 1}`} loading="lazy" />
									{:else}
										<div class="generated-row__missing">Not yet generated</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
					{#if locationRowsError}
						<p class="image-note">Failed to load rows: {locationRowsError}</p>
					{:else if locationRows.length > 0}
						<p class="image-note">Generated by Icon Placer</p>
					{/if}
				</div>
				<div class="image-upload-section">
					<div class="upload-label">Generated Location</div>
					{#if editingLocation.image_with_icons_path}
						{@const generatedUrl = publicAssetUrl(editingLocation.image_with_icons_path, {
							updatedAt: editingLocation.updated_at ?? undefined
						})}
						{#if generatedUrl}
							<div class="generated-preview">
								<img src={generatedUrl} alt="Generated location" />
							</div>
						{/if}
						<p class="image-note">Generated by Icon Placer</p>
					{:else}
						<div class="generated-placeholder">
							<span>Not yet generated</span>
							<p class="image-note">Use Icon Placer to generate</p>
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<p class="image-note">Save the location first to upload a background image.</p>
		{/if}

		<LocationRewardRowsEditor bind:rewardRows={formData.reward_rows} />
	{/snippet}

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (showForm = false)} disabled={saving}>Cancel</Button>
		<Button variant="primary" onclick={saveLocation} loading={saving}>Save</Button>
	{/snippet}
</Modal>

<ConfirmDialog
	bind:open={showDeleteConfirm}
	variant="danger"
	title="Delete Location"
	message={deleteTarget ? `Delete "${deleteTarget.name}"? This cannot be undone.` : 'Delete this location?'}
	confirmLabel={deleting ? 'Deleting…' : 'Delete'}
	onconfirm={confirmDelete}
	oncancel={() => (deleteTarget = null)}
/>

	<LocationPlacerModal
		bind:isOpen={iconPlacerOpen}
		locations={locations}
		onClose={() => (iconPlacerOpen = false)}
		onUpdated={loadLocations}
	/>
