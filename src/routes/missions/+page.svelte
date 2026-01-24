<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { TravelerQuestRow } from '$lib/types/gameData';
	import { getErrorMessage } from '$lib/utils';
	import { publicAssetUrl, processAndUploadImage } from '$lib/utils/storage';
	import { generateQuestCardPNG } from '$lib/generators/cards';
	import { loadIconPool } from '$lib/utils/iconPool';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button, FormField, Input, Textarea } from '$lib/components/ui';
	import TravelerQuestGrid from '$lib/components/travelers/TravelerQuestGrid.svelte';
	import TravelerQuestEditorModal from '$lib/components/travelers/TravelerQuestEditorModal.svelte';

	const tabs: Tab[] = [
		{ id: 'manage', label: 'Manage', icon: '🗺️' },
		{ id: 'gallery', label: 'Card Gallery', icon: '🖼️' }
	];
	let activeTab = $state('manage');

	let missions = $state<TravelerQuestRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let showRenderedPreview = $state(false);

	// Editor state
	let missionEditorOpen = $state(false);
	let missionDraft = $state<Partial<TravelerQuestRow>>({});
	let savingMission = $state(false);
	let deletingMissionIds = $state<Set<string>>(new Set());

	// Gallery state
	let searchQuery = $state('');
	let statusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
	let selectedMissionIds = $state(new Set<string>());
	let generatingMissionIds = $state(new Set<string>());
	let progressMessage = $state('');

	const VP_RAW_ICON_NAME = 'vp_raw';
	const MAX_VP_ICONS = 10;
	let vpRawIconId = $state<string | null>(null);

	// Inline "quick edit" state
	let quickEditMissionId = $state<string | null>(null);
	let quickEditDescriptionDraft = $state('');
	let quickEditVpDraft = $state<number | null>(null);
	let quickEditQuantityDraft = $state<number>(1);
	let quickEditSaving = $state(false);

	onMount(() => {
		// Preload reward icons so opening the icon picker is instant (matches Monster editor behavior).
		void (async () => {
			const icons = await loadIconPool();
			vpRawIconId = icons.find((i) => i.name === VP_RAW_ICON_NAME)?.id ?? null;
		})();
		void loadMissions();
	});

	const filteredMissions = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		return missions.filter((mission) => {
			if (statusFilter === 'generated' && !mission.card_image_path) return false;
			if (statusFilter === 'not-generated' && mission.card_image_path) return false;
			if (!query) return true;
			return mission.title.toLowerCase().includes(query);
		});
	});

	type MissionGroup = {
		key: string;
		label: string;
		missions: TravelerQuestRow[];
	};

	const missionGroups = $derived.by<MissionGroup[]>(() => {
		const groups = new Map<string, TravelerQuestRow[]>();
		for (const mission of missions) {
			const tag = Array.isArray(mission.tags) && mission.tags.length > 0 ? String(mission.tags[0] ?? '').trim() : '';
			const key = tag || 'untagged';
			const existing = groups.get(key);
			if (existing) existing.push(mission);
			else groups.set(key, [mission]);
		}

		const result = Array.from(groups.entries()).map(([key, items]) => ({
			key,
			label: key === 'untagged' ? 'Untagged' : key,
			missions: [...items].sort(
				(a, b) => (Number(a.order_num ?? 0) - Number(b.order_num ?? 0) || a.title.localeCompare(b.title))
			)
		}));

		result.sort((a, b) => {
			if (a.key === 'untagged') return 1;
			if (b.key === 'untagged') return -1;
			return a.label.localeCompare(b.label);
		});

		return result;
	});

	const selectedCount = $derived.by(() => selectedMissionIds.size);
	const totalCount = $derived.by(() => filteredMissions.length);
	const generatedCount = $derived.by(() => filteredMissions.filter((m) => !!m.card_image_path).length);

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	async function loadMissions() {
		loading = true;
		error = null;
		try {
			const { data, error: err } = await supabase.from('missions').select('*').order('order_num').order('title');
			if (err) throw err;

			missions = (data ?? []).map((row) => {
				const tags = Array.isArray((row as any).tags)
					? (row as any).tags.filter((tag: unknown): tag is string => typeof tag === 'string')
					: [];

				return {
					...row,
					reward_text: typeof (row as any).reward_text === 'string' ? (row as any).reward_text : null,
					reward_icon_ids: Array.isArray((row as any).reward_icon_ids) ? (row as any).reward_icon_ids : [],
					tags: tags.length > 0 ? [tags[0]] : [],
					quantity: Number.isFinite(Number((row as any).quantity))
						? Math.max(1, Math.trunc(Number((row as any).quantity)))
						: 1
				};
			});
		} catch (err) {
			error = getErrorMessage(err);
			missions = [];
		} finally {
			loading = false;
		}
	}

	function openCreateMission() {
		missionDraft = {
			title: '',
			description: null,
			reward_text: null,
			reward_icon_ids: [],
			tags: [],
			order_num: missions.length,
			quantity: 1
		};
		missionEditorOpen = true;
	}

	function openEditMission(mission: TravelerQuestRow) {
		missionDraft = JSON.parse(JSON.stringify(mission));
		missionEditorOpen = true;
	}

	async function saveMission(mission: Partial<TravelerQuestRow>) {
		const title = (mission.title ?? '').trim();
		if (!title) {
			alert('Title is required.');
			return;
		}

		const rewardText = (mission.reward_text ?? '').trim();
		const rewardIconIds = Array.isArray(mission.reward_icon_ids) ? mission.reward_icon_ids : [];
		const tags = Array.isArray(mission.tags) ? mission.tags.filter((t): t is string => typeof t === 'string') : [];
		const singleTag = tags.length > 0 ? [tags[0]] : [];
		const quantity = Number.isFinite(Number((mission as any).quantity))
			? Math.max(1, Math.trunc(Number((mission as any).quantity)))
			: 1;

		const payload = {
			title,
			description: (mission.description ?? null) || null,
			reward_text: rewardText ? rewardText : null,
			reward_icon_ids: rewardText ? [] : rewardIconIds,
			tags: singleTag,
			order_num: mission.order_num ?? 0,
			quantity,
			updated_at: new Date().toISOString()
		};

		savingMission = true;
		try {
			if (mission.id) {
				const { error: err } = await supabase.from('missions').update(payload).eq('id', mission.id);
				if (err) throw err;
			} else {
				const { error: err } = await supabase.from('missions').insert(payload);
				if (err) throw err;
			}

			await loadMissions();
		} catch (err) {
			alert(`Failed to save mission: ${getErrorMessage(err)}`);
		} finally {
			savingMission = false;
		}
	}

	async function deleteMission(mission: TravelerQuestRow) {
		if (!confirm(`Delete "${mission.title}"?`)) return;
		deletingMissionIds.add(mission.id);
		deletingMissionIds = new Set(deletingMissionIds);

		try {
			const { error: err } = await supabase.from('missions').delete().eq('id', mission.id);
			if (err) throw err;
			missions = missions.filter((m) => m.id !== mission.id);
		} catch (err) {
			alert(`Failed to delete mission: ${getErrorMessage(err)}`);
		} finally {
			deletingMissionIds.delete(mission.id);
			deletingMissionIds = new Set(deletingMissionIds);
		}
	}

	function getMissionCardImageUrl(mission: TravelerQuestRow): string | null {
		if (!mission.card_image_path) return null;
		return publicAssetUrl(mission.card_image_path, { updatedAt: mission.updated_at ?? undefined });
	}

	function openQuickEdit(mission: TravelerQuestRow) {
		quickEditMissionId = mission.id;
		quickEditDescriptionDraft = mission.description ?? '';
		quickEditQuantityDraft = Number.isFinite(Number(mission.quantity))
			? Math.max(1, Math.trunc(Number(mission.quantity)))
			: 1;

		if (!vpRawIconId) {
			quickEditVpDraft = null;
			return;
		}

		if (mission.reward_text && mission.reward_text.trim()) {
			quickEditVpDraft = null;
			return;
		}

		const count = (mission.reward_icon_ids ?? []).filter((id) => id === vpRawIconId).length;
		quickEditVpDraft = count;
	}

	function closeQuickEdit() {
		quickEditMissionId = null;
		quickEditDescriptionDraft = '';
		quickEditVpDraft = null;
		quickEditQuantityDraft = 1;
		quickEditSaving = false;
	}

	async function saveQuickEdit() {
		if (!quickEditMissionId) return;
		if (quickEditSaving) return;

		const mission = missions.find((m) => m.id === quickEditMissionId) ?? null;
		if (!mission) {
			closeQuickEdit();
			return;
		}

		quickEditSaving = true;
		try {
			const description = quickEditDescriptionDraft.trim() || null;
			const quantityRaw = Number(quickEditQuantityDraft ?? 1);
			const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.trunc(quantityRaw)) : 1;

			const patch: Partial<TravelerQuestRow> & Record<string, unknown> = {
				description,
				quantity,
				updated_at: new Date().toISOString()
			};

			if (quickEditVpDraft !== null) {
				const id = vpRawIconId;
				if (!id) {
					throw new Error(`Missing "${VP_RAW_ICON_NAME}" icon in icon_pool.`);
				}
				const raw = Number(quickEditVpDraft ?? 0);
				const count = Number.isFinite(raw) ? Math.max(0, Math.min(MAX_VP_ICONS, Math.trunc(raw))) : 0;
				patch.reward_text = null;
				patch.reward_icon_ids = Array.from({ length: count }, () => id);
			}

			const { error: err } = await supabase.from('missions').update(patch).eq('id', mission.id);
			if (err) throw err;

			missions = missions.map((m) => (m.id === mission.id ? ({ ...m, ...(patch as any) } as TravelerQuestRow) : m));
			closeQuickEdit();
		} catch (err) {
			alert(`Failed to save quick edits: ${getErrorMessage(err)}`);
		} finally {
			quickEditSaving = false;
		}
	}

	function toggleMissionSelection(id: string) {
		const next = new Set(selectedMissionIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedMissionIds = next;
	}

	function selectAll() {
		selectedMissionIds = new Set(filteredMissions.map((m) => m.id));
	}

	function deselectAll() {
		selectedMissionIds = new Set();
	}

	async function generateMissionCard(mission: TravelerQuestRow) {
		if (generatingMissionIds.has(mission.id)) return;

		const nextGenerating = new Set(generatingMissionIds);
		nextGenerating.add(mission.id);
		generatingMissionIds = nextGenerating;

		progressMessage = `Generating card for "${mission.title}"...`;
		try {
			const blob = await generateQuestCardPNG(mission);
			const { data, error: uploadError } = await processAndUploadImage(blob, {
				folder: 'traveler_quest_cards',
				filename: mission.id,
				cropTransparent: false,
				upsert: true
			});
			if (uploadError) throw uploadError;

			const uploadedPath = data?.path ?? '';
			const { error: updateErr } = await supabase
				.from('missions')
				.update({ card_image_path: uploadedPath, updated_at: new Date().toISOString() })
				.eq('id', mission.id);
			if (updateErr) throw updateErr;

			const idx = missions.findIndex((m) => m.id === mission.id);
			if (idx >= 0) {
				const next = [...missions];
				next[idx] = { ...next[idx], card_image_path: uploadedPath, updated_at: new Date().toISOString() };
				missions = next;
			}
			progressMessage = `✓ Generated card for "${mission.title}"`;
		} catch (err) {
			progressMessage = `✗ Failed to generate card for "${mission.title}"`;
			console.error('Failed to generate mission card:', err);
		} finally {
			const next = new Set(generatingMissionIds);
			next.delete(mission.id);
			generatingMissionIds = next;
		}
	}

	async function generateSelected() {
		const selected = filteredMissions.filter((m) => selectedMissionIds.has(m.id));
		if (selected.length === 0) {
			alert('No missions selected');
			return;
		}

		progressMessage = `Generating ${selected.length} mission cards...`;
		for (let i = 0; i < selected.length; i++) {
			const mission = selected[i];
			progressMessage = `Generating card ${i + 1}/${selected.length}: "${mission.title}"...`;
			await generateMissionCard(mission);
		}
		progressMessage = `✓ Generated ${selected.length} mission cards`;
		deselectAll();
	}

	async function generateAll() {
		if (!confirm(`Generate cards for all ${filteredMissions.length} missions?`)) return;
		progressMessage = `Generating ${filteredMissions.length} mission cards...`;
		for (let i = 0; i < filteredMissions.length; i++) {
			const mission = filteredMissions[i];
			progressMessage = `Generating card ${i + 1}/${filteredMissions.length}: "${mission.title}"...`;
			await generateMissionCard(mission);
		}
		progressMessage = `✓ Generated ${filteredMissions.length} mission cards`;
	}
</script>

<PageLayout
	title="Missions"
	subtitle="Mission cards and card generation"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		{#if activeTab === 'manage'}
			<Button variant="primary" onclick={openCreateMission}>+ Mission</Button>
		{/if}
	{/snippet}

	{#snippet tabActions()}
		{#if activeTab === 'manage'}
			<span class="count">{missions.length} missions</span>
		{:else if activeTab === 'gallery'}
			<span class="count">{generatedCount}/{totalCount} generated</span>
		{/if}
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'manage'}
		<section class="missions">
			<div class="missions-toolbar">
				<Button variant="secondary" size="sm" onclick={() => (showRenderedPreview = !showRenderedPreview)}>
					{showRenderedPreview ? 'Disable Preview' : 'Enable Preview'}
				</Button>
			</div>

			{#if missions.length === 0}
				<div class="empty-state">No missions yet. Click “+ Mission” to create one.</div>
			{:else}
				{#if showRenderedPreview}
					<TravelerQuestGrid
						quests={missions}
						on:edit={(e) => openEditMission(e.detail)}
						on:delete={(e) => deleteMission(e.detail)}
					/>
				{:else}
					<div class="mission-groups">
						{#each missionGroups as group (group.key)}
							<div class="mission-group">
								<div class="mission-group__header">
									<span class="mission-group__title">{group.label}</span>
									<span class="mission-group__count">{group.missions.length}</span>
								</div>

								<div class="mission-list" role="list">
									{#each group.missions as mission (mission.id)}
										{@const isDeleting = deletingMissionIds.has(mission.id)}
										{@const rewardSummary =
											mission.reward_text && mission.reward_text.trim()
												? `Reward: ${mission.reward_text}`
												: mission.reward_icon_ids && mission.reward_icon_ids.length > 0
													? `Reward: ${mission.reward_icon_ids.length} icon${mission.reward_icon_ids.length === 1 ? '' : 's'}`
													: 'Reward: none'}

										<div class="mission-row" role="listitem">
											<button type="button" class="mission-row__main" onclick={() => openEditMission(mission)}>
												<div class="mission-row__title-line">
													<span class="mission-row__order">#{mission.order_num}</span>
													{#if mission.quantity > 1}
														<span class="mission-row__qty">×{mission.quantity}</span>
													{/if}
													<span class="mission-row__title">{mission.title}</span>
												</div>
												<div class="mission-row__meta">
													<span class="mission-row__reward">{rewardSummary}</span>
													{#if mission.tags && mission.tags.length > 0}
														<span class="mission-row__tags">Tag: {mission.tags[0]}</span>
													{/if}
												</div>
											</button>

											<div class="mission-row__actions">
												<Button variant="secondary" size="sm" onclick={() => openEditMission(mission)}>Edit</Button>
												<Button
													variant="secondary"
													size="sm"
													onclick={() => (quickEditMissionId === mission.id ? closeQuickEdit() : openQuickEdit(mission))}
												>
													{quickEditMissionId === mission.id ? 'Close' : 'Quick'}
												</Button>
												<Button variant="danger" size="sm" onclick={() => deleteMission(mission)} loading={isDeleting}>
													Delete
												</Button>
											</div>
										</div>

										{#if quickEditMissionId === mission.id}
											<div class="mission-quick-edit" role="region" aria-label="Quick edit mission">
												<div class="mission-quick-edit__grid">
													<FormField
														label="VP (vp_raw)"
														helperText={`Replaces reward icons with ${VP_RAW_ICON_NAME} × N (max ${MAX_VP_ICONS}).`}
													>
														<Input
															type="number"
															min={0}
															max={MAX_VP_ICONS}
															step={1}
															bind:value={quickEditVpDraft}
															disabled={!vpRawIconId || quickEditSaving}
															onkeydown={(e) => {
																if (e.key === 'Enter') {
																	e.preventDefault();
																	void saveQuickEdit();
																}
															}}
														/>
													</FormField>
													<FormField label="Quantity" helperText="Copies to export (TTS)">
														<Input
															type="number"
															min={1}
															step={1}
															bind:value={quickEditQuantityDraft}
															disabled={quickEditSaving}
															onkeydown={(e) => {
																if (e.key === 'Enter') {
																	e.preventDefault();
																	void saveQuickEdit();
																}
															}}
														/>
													</FormField>
													<FormField label="Description">
														<Textarea rows={2} bind:value={quickEditDescriptionDraft} disabled={quickEditSaving} />
													</FormField>
												</div>

												<div class="mission-quick-edit__actions">
													<Button variant="secondary" size="sm" onclick={closeQuickEdit} disabled={quickEditSaving}>
														Cancel
													</Button>
													<Button variant="primary" size="sm" onclick={() => void saveQuickEdit()} loading={quickEditSaving}>
														Save
													</Button>
												</div>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			<TravelerQuestEditorModal
				bind:open={missionEditorOpen}
				bind:quest={missionDraft}
				onsave={(m) => void saveMission(m)}
				onclose={() => (missionEditorOpen = false)}
			/>

			{#if savingMission}
				<div class="saving-banner">Saving…</div>
			{/if}
		</section>
	{:else if activeTab === 'gallery'}
		<div class="gallery-container">
			<div class="controls-bar">
				<div class="filters">
					<input type="text" placeholder="Search missions..." bind:value={searchQuery} class="search-input" />

					<select bind:value={statusFilter} class="filter-select">
						<option value="all">All Status</option>
						<option value="generated">Generated</option>
						<option value="not-generated">Not Generated</option>
					</select>
				</div>

				<div class="actions">
					{#if selectedCount > 0}
						<Button variant="secondary" onclick={deselectAll}>Deselect All</Button>
						<Button variant="primary" onclick={generateSelected}>Generate Selected ({selectedCount})</Button>
					{:else}
						<Button variant="secondary" onclick={selectAll}>Select All ({filteredMissions.length})</Button>
					{/if}

					<Button variant="primary" onclick={generateAll}>Generate All</Button>
				</div>
			</div>

			{#if progressMessage}
				<div class="progress-message">{progressMessage}</div>
			{/if}

			<div class="cards-grid mission-cards-grid">
				{#each filteredMissions as mission (mission.id)}
					{@const isSelected = selectedMissionIds.has(mission.id)}
					{@const isGenerating = generatingMissionIds.has(mission.id)}
					{@const hasCardImage = !!mission.card_image_path}
					{@const cardImageUrl = getMissionCardImageUrl(mission)}

					<div class="card-item mission-card-item" class:selected={isSelected}>
						<div class="card-checkbox">
							<input type="checkbox" checked={isSelected} onchange={() => toggleMissionSelection(mission.id)} disabled={isGenerating} />
						</div>

						<div class="card-preview mission-card-preview">
							{#if hasCardImage && cardImageUrl}
								<img src={cardImageUrl} alt={mission.title} loading="lazy" />
								<div class="card-status generated">
									<span class="status-icon">✓</span>
								</div>
							{:else}
								<div class="card-placeholder mission-placeholder">
									<div class="placeholder-emoji">🗺️</div>
									<span class="placeholder-text">{mission.title}</span>
								</div>
							{/if}

							{#if isGenerating}
								<div class="card-generating">
									<div class="spinner"></div>
								</div>
							{/if}
						</div>

						<div class="card-info">
							<div class="card-header">
								<h3 class="card-name">{mission.title}</h3>
							</div>

							<div class="card-footer">
								<span class="card-order">#{mission.order_num}</span>
								<Button variant="secondary" size="sm" onclick={() => generateMissionCard(mission)} disabled={isGenerating}>
									{isGenerating ? 'Generating...' : hasCardImage ? 'Regenerate' : 'Generate'}
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if filteredMissions.length === 0}
				<div class="empty-state">No missions match the current filters</div>
			{/if}
		</div>
	{/if}
</PageLayout>

<style>
	.count {
		font-size: 0.7rem;
		color: #64748b;
	}

	.loading-state,
	.error-state {
		padding: 1rem;
		text-align: center;
		color: #64748b;
		font-size: 0.75rem;
	}

	.error-state {
		color: #f87171;
	}

	.missions {
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		padding: 0.75rem;
	}

	.missions-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 0.5rem;
	}

	.empty-state {
		font-size: 0.75rem;
		color: #94a3b8;
		text-align: center;
		padding: 0.5rem;
	}

	.saving-banner {
		margin-top: 0.75rem;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.mission-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.mission-groups {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mission-group__header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.15rem 0.25rem 0.35rem;
	}

	.mission-group__title {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.9);
	}

	.mission-group__count {
		font-size: 0.7rem;
		color: rgba(148, 163, 184, 0.8);
	}

	.mission-row {
		display: flex;
		align-items: stretch;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.6rem;
		background: rgba(2, 6, 23, 0.5);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
	}

	.mission-row__main {
		flex: 1;
		text-align: left;
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		min-width: 0;
	}

	.mission-row__title-line {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		white-space: nowrap;
	}

	.mission-row__order {
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.mission-row__qty {
		color: #93c5fd;
		font-size: 0.75rem;
	}

	.mission-row__title {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.mission-row__meta {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		margin-top: 0.25rem;
	}

	.mission-row__reward,
	.mission-row__tags {
		color: #94a3b8;
		font-size: 0.72rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mission-row__actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mission-quick-edit {
		margin-top: 0.5rem;
		padding: 0.75rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.16);
		background: rgba(15, 23, 42, 0.45);
	}

	.mission-quick-edit__grid {
		display: grid;
		gap: 0.75rem;
	}

	.mission-quick-edit__actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.gallery-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.controls-bar {
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.search-input {
		flex: 1;
		min-width: 200px;
		padding: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		background: rgba(2, 6, 23, 0.6);
		color: #e2e8f0;
	}

	.filter-select {
		padding: 0.5rem;
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 4px;
		background: rgba(2, 6, 23, 0.6);
		color: #e2e8f0;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.progress-message {
		padding: 0.5rem;
		background: rgba(30, 41, 59, 0.4);
		border-radius: 4px;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.card-item {
		position: relative;
		background: rgba(2, 6, 23, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 10px;
		overflow: hidden;
		transition: border-color 0.15s ease;
	}

	.card-item.selected {
		border-color: rgba(59, 130, 246, 0.55);
	}

	.card-checkbox {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 2;
	}

	.card-preview {
		position: relative;
		aspect-ratio: 600 / 437;
		background: rgba(15, 23, 42, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.card-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-placeholder {
		padding: 0.75rem;
		text-align: center;
		color: #94a3b8;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.placeholder-text {
		font-size: 0.75rem;
		font-weight: 600;
	}

	.card-status {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 24px;
		height: 24px;
		border-radius: 999px;
		background: rgba(34, 197, 94, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		color: #052e16;
		font-weight: 900;
	}

	.card-generating {
		position: absolute;
		inset: 0;
		background: rgba(2, 6, 23, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 3px solid rgba(148, 163, 184, 0.2);
		border-top-color: rgba(59, 130, 246, 0.9);
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.card-info {
		padding: 0.6rem 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-name {
		margin: 0;
		font-size: 0.85rem;
	}

	.card-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.card-order {
		font-size: 0.72rem;
		color: #94a3b8;
	}
</style>
