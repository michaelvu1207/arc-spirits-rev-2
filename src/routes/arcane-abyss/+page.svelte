<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import type { GameLocationRow, SpecialEffectRow, SpecialEffectType } from '$lib/types/gameData';
	import { generateMonsterCardPNG } from '$lib/generators/cards';
	import { getErrorMessage } from '$lib/utils';
	import { processAndUploadImage, publicAssetUrl } from '$lib/utils/storage';
	import { getIconPoolUrl, loadIconPool } from '$lib/utils/iconPool';
	import { Modal, PageLayout, type Tab } from '$lib/components/layout';
	import { Button, FormField, Input, Select, Textarea } from '$lib/components/ui';
	import type { Monster } from '$lib/components/abyss-deck';
	import AbyssDeckWorkspace from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
	import type { MonsterFormData as AbyssMonsterFormData } from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';

	type InvadeLocationOption = Pick<GameLocationRow, 'id' | 'name'>;

	const tabs: Tab[] = [
		{ id: 'monsters', label: 'Monsters', icon: '👹' },
		{ id: 'gallery', label: 'Card Gallery', icon: '🖼️' },
		{ id: 'special-effects', label: 'Special Effects', icon: '✨' }
	];
	let activeTab = $state('monsters');

	let monsters = $state<Monster[]>([]);
	let invadeLocations = $state<InvadeLocationOption[]>([]);
	let specialEffects = $state<SpecialEffectRow[]>([]);
	let monsterSpecialEffects = $state<Record<string, string[]>>({});

	let loading = $state(true);
	let error = $state<string | null>(null);

	let gallerySearchQuery = $state('');
	let galleryStageFilter = $state<'all' | Monster['stage']>('all');
	let galleryStatusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
	let selectedMonsterIds = $state<Set<string>>(new Set());
	let generatingMonsterIds = $state<Set<string>>(new Set());
	let galleryProgressMessage = $state<string | null>(null);

	const filteredGalleryMonsters = $derived.by(() => {
		const term = gallerySearchQuery.trim().toLowerCase();
			return monsters
				.filter((monster) => {
					if (galleryStageFilter !== 'all' && monster.stage !== galleryStageFilter) return false;
					if (galleryStatusFilter === 'generated' && !monster.card_image_path) return false;
					if (galleryStatusFilter === 'not-generated' && monster.card_image_path) return false;
					if (!term) return true;
					return monster.name.toLowerCase().includes(term);
				})
			.sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999));
	});

	const selectedGalleryCount = $derived.by(() => selectedMonsterIds.size);

	const effectTypeOptions: { value: SpecialEffectType; label: string }[] = [
		{ value: 'before_combat', label: 'Before Combat' },
		{ value: 'during_combat', label: 'During Combat' },
		{ value: 'after_combat', label: 'After Combat' },
		{ value: 'combat_type', label: 'Combat Type' }
	];

	let effectModalOpen = $state(false);
	let effectModalSaving = $state(false);
	let editingEffectId = $state<string | null>(null);
	let effectFormData = $state({
		name: '',
		description: '',
		icon: '',
		color: '#a855f7',
		effect_type: 'during_combat' as SpecialEffectType
	});

	const isEditingEffect = $derived(editingEffectId !== null);

	onMount(loadData);

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	async function loadData() {
		loading = true;
		error = null;
		try {
			await Promise.all([loadInvadeLocations(), loadSpecialEffects(), loadMonsterSpecialEffects(), loadIconPool()]);
			await loadMonsters();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadInvadeLocations() {
		const { data, error: err } = await supabase.from('game_locations').select('id, name').order('name');
		if (err) throw err;
		invadeLocations = (data ?? []) as InvadeLocationOption[];
	}

	async function loadSpecialEffects() {
		const { data, error: err } = await supabase.from('special_effects').select('*').order('name');
		if (err) throw err;
		specialEffects = (data ?? []) as SpecialEffectRow[];
	}

	async function loadMonsterSpecialEffects() {
		const { data, error: err } = await supabase
			.from('monster_special_effects')
			.select('monster_id, special_effect_id');
		if (err) throw err;

		monsterSpecialEffects = (data ?? []).reduce((acc, row) => {
			if (!acc[row.monster_id]) acc[row.monster_id] = [];
			acc[row.monster_id].push(row.special_effect_id);
			return acc;
		}, {} as Record<string, string[]>);
	}

	function getMonsterIconUrl(icon: string | null | undefined, updatedAt?: string | null): string | null {
		if (!icon) return null;
		if (icon.includes('/')) {
			const path = icon.startsWith('monster_icons/') ? icon : `monster_icons/${icon}`;
			return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
		}
		return null;
	}

	function getMonsterImageUrl(imagePath: string | null | undefined, updatedAt?: string | null): string | null {
		if (!imagePath) return null;
		const path = imagePath.startsWith('monsters/') ? imagePath : `monsters/${imagePath}`;
		return publicAssetUrl(path, { updatedAt: updatedAt ?? undefined });
	}

	function normalizeRewardTrack(barrierValue: number, track: unknown): string[][] {
		const barrier = Math.max(0, Math.round(barrierValue));
		const killedIndex = Math.max(1, barrier);
		const targetLen = killedIndex + 1; // includes slot0 participation

		const safe: string[][] = Array.isArray(track)
			? track.map((slot) =>
					Array.isArray(slot)
						? slot
								.filter((id): id is string => typeof id === 'string')
								.map((id) => id.trim())
								.filter(Boolean)
						: []
				)
			: [];

		while (safe.length < targetLen) safe.push([]);
		return safe.slice(0, targetLen);
	}

	async function loadMonsters() {
		const { data, error: err } = await supabase.from('monsters').select('*').order('order_num', { ascending: true });
		if (err) throw err;

		const invadeById = new Map(invadeLocations.map((loc) => [loc.id, loc.name]));
		const effectById = new Map(specialEffects.map((effect) => [effect.id, effect]));

		monsters = (data ?? []).map((monster: any) => {
			const effectIds = monsterSpecialEffects[monster.id] ?? [];
			const effects = effectIds.map((id) => effectById.get(id)).filter(Boolean) as SpecialEffectRow[];

			return {
				...monster,
				quantity: 1,
				icon_url: getMonsterIconUrl(monster.icon, monster.updated_at),
				art_url: getMonsterImageUrl(monster.image_path, monster.updated_at),
				effects,
				invade_location_name: monster.invade_location_id ? invadeById.get(monster.invade_location_id) ?? null : null
			} as Monster;
		});
	}

	function getMonsterCardImageUrl(monster: Monster): string | null {
		return publicAssetUrl(monster.card_image_path, { updatedAt: monster.updated_at ?? undefined });
	}

	function getMonsterStageColor(stage: string | null | undefined): string {
		switch (stage) {
			case 'stage_1':
				return '#c084fc';
			case 'stage_2':
				return '#6b21a8';
			case 'stage_3':
				return '#065f46';
			case 'final_stage':
				return '#a855f7';
			case 'inactive':
				return '#64748b';
			default:
				return '#94a3b8';
		}
	}

	function toggleMonsterGallerySelection(monsterId: string) {
		const next = new Set(selectedMonsterIds);
		if (next.has(monsterId)) next.delete(monsterId);
		else next.add(monsterId);
		selectedMonsterIds = next;
	}

	function selectAllGalleryMonsters() {
		selectedMonsterIds = new Set(filteredGalleryMonsters.map((m) => m.id));
	}

	function deselectAllGalleryMonsters() {
		selectedMonsterIds = new Set();
	}

	async function generateMonsterCard(monster: Monster) {
		const monsterId = monster.id;
		if (!monsterId) return;

		generatingMonsterIds = new Set([...generatingMonsterIds, monsterId]);
		galleryProgressMessage = `Generating card for ${monster.name}...`;

		try {
			await loadIconPool();

			const rewardTrackIconUrls = (monster.reward_track ?? []).map((slot) =>
				(slot ?? []).map((iconId) => getIconPoolUrl(iconId))
			);

			const blob = await generateMonsterCardPNG(
				monster,
				monster.art_url,
				monster.icon_url,
				rewardTrackIconUrls,
				'base'
			);

			const folder = 'card_images/monsters/en';
			const { data, error: uploadError } = await processAndUploadImage(blob, {
				folder,
				filename: monsterId,
				cropTransparent: false,
				upsert: true
			});
			if (uploadError) throw uploadError;

			const uploadedPath = data?.path ?? '';
			const updatedAt = new Date().toISOString();
			const { error: updateError } = await supabase
				.from('monsters')
				.update({ card_image_path: uploadedPath, updated_at: updatedAt })
				.eq('id', monsterId);
			if (updateError) throw updateError;

			monsters = monsters.map((m) =>
				m.id === monsterId
					? {
							...m,
							card_image_path: uploadedPath,
							updated_at: updatedAt,
							icon_url: getMonsterIconUrl(m.icon, updatedAt),
							art_url: getMonsterImageUrl(m.image_path, updatedAt)
						}
					: m
			);

			galleryProgressMessage = `✓ Generated card for ${monster.name}`;
		} catch (err) {
			console.error('Failed to generate monster card', err);
			galleryProgressMessage = `✗ Failed to generate card for ${monster.name}`;
		} finally {
			const next = new Set(generatingMonsterIds);
			next.delete(monsterId);
			generatingMonsterIds = next;
		}
	}

	async function generateSelectedMonsterCards() {
		const targets = filteredGalleryMonsters.filter((m) => selectedMonsterIds.has(m.id));
		if (targets.length === 0) {
			alert('No monsters selected.');
			return;
		}

		if (!confirm(`Generate card images for ${targets.length} selected monster${targets.length === 1 ? '' : 's'}?`)) {
			return;
		}

		for (let i = 0; i < targets.length; i++) {
			const monster = targets[i];
			galleryProgressMessage = `Generating ${i + 1}/${targets.length}: ${monster.name}...`;
			await generateMonsterCard(monster);
		}

		galleryProgressMessage = `✓ Generated ${targets.length} card${targets.length === 1 ? '' : 's'}`;
		deselectAllGalleryMonsters();
	}

	async function generateAllMonsterCards() {
		const targets = filteredGalleryMonsters;
		if (targets.length === 0) return;

		if (!confirm(`Generate card images for all ${targets.length} monster${targets.length === 1 ? '' : 's'}?`)) {
			return;
		}

		for (let i = 0; i < targets.length; i++) {
			const monster = targets[i];
			galleryProgressMessage = `Generating ${i + 1}/${targets.length}: ${monster.name}...`;
			await generateMonsterCard(monster);
		}

		galleryProgressMessage = `✓ Generated ${targets.length} card${targets.length === 1 ? '' : 's'}`;
	}

	async function handleMonsterSave(formData: AbyssMonsterFormData, id: string | null): Promise<string> {
		if (!formData.name.trim()) {
			throw new Error('Monster name is required.');
		}

		const rewardTrack = normalizeRewardTrack(formData.barrier ?? 0, (formData as any).reward_track);
		const now = new Date().toISOString();

		let monsterId: string;
			if (id) {
				const { error: err } = await supabase
					.from('monsters')
					.update({
						name: formData.name,
						damage: formData.damage,
						barrier: formData.barrier,
						stage: formData.stage,
						monster_classification: formData.monster_classification,
						icon: formData.icon,
						image_path: formData.image_path,
						card_image_path: formData.card_image_path ?? null,
						show_tutorial: (formData as any).show_tutorial ?? true,
						invade_location_id: formData.invade_location_id,
						reward_track: rewardTrack,
						order_num: Math.max(0, Math.trunc(Number(formData.order_num ?? 0))),
						updated_at: now
					})
					.eq('id', id);
			if (err) throw err;
			monsterId = id;
		} else {
			const nextOrderNum = monsters.reduce((max, m) => Math.max(max, m.order_num ?? 0), -1) + 1;
				const { data, error: err } = await supabase
					.from('monsters')
					.insert({
						name: formData.name,
						damage: formData.damage,
						barrier: formData.barrier,
						stage: formData.stage,
						monster_classification: formData.monster_classification,
						icon: formData.icon,
						image_path: formData.image_path,
						card_image_path: formData.card_image_path ?? null,
						show_tutorial: (formData as any).show_tutorial ?? true,
						invade_location_id: formData.invade_location_id,
						reward_track: rewardTrack,
						order_num: nextOrderNum,
					updated_at: now
				})
				.select('id')
				.single();
			if (err) throw err;
			monsterId = data.id as string;
		}

		const { error: deleteErr } = await supabase
			.from('monster_special_effects')
			.delete()
			.eq('monster_id', monsterId);
		if (deleteErr) throw deleteErr;

		if (formData.special_effect_ids.length > 0) {
			const effectRecords = formData.special_effect_ids.map((effectId) => ({
				monster_id: monsterId,
				special_effect_id: effectId
			}));
			const { error: insertErr } = await supabase.from('monster_special_effects').insert(effectRecords);
			if (insertErr) throw insertErr;
		}

		await Promise.all([loadMonsterSpecialEffects(), loadMonsters()]);
		return monsterId;
	}

	async function handleMonsterDelete(monsterId: string) {
		const { error: scenarioErr } = await supabase
			.from('scenario_cards')
			.delete()
			.eq('card_type', 'monster')
			.eq('card_id', monsterId);
		if (scenarioErr) throw scenarioErr;

		const { error: effectsErr } = await supabase
			.from('monster_special_effects')
			.delete()
			.eq('monster_id', monsterId);
		if (effectsErr) throw effectsErr;

		const { error: monsterErr } = await supabase.from('monsters').delete().eq('id', monsterId);
		if (monsterErr) throw monsterErr;

		await Promise.all([loadMonsterSpecialEffects(), loadMonsters()]);
	}

	async function saveNoOrder() {
		// Monster catalog ordering is intentionally disabled.
	}

	function openNewEffect() {
		editingEffectId = null;
		effectFormData = {
			name: '',
			description: '',
			icon: '',
			color: '#a855f7',
			effect_type: 'during_combat'
		};
		effectModalOpen = true;
	}

	function openEditEffect(effect: SpecialEffectRow) {
		editingEffectId = effect.id;
		effectFormData = {
			name: effect.name ?? '',
			description: effect.description ?? '',
			icon: effect.icon ?? '',
			color: effect.color || '#a855f7',
			effect_type: effect.effect_type || 'during_combat'
		};
		effectModalOpen = true;
	}

	async function saveEffect() {
		if (!effectFormData.name.trim()) {
			alert('Effect name is required.');
			return;
		}
		if (effectModalSaving) return;

		effectModalSaving = true;
		try {
			const payload = {
				name: effectFormData.name.trim(),
				description: effectFormData.description.trim() ? effectFormData.description.trim() : null,
				icon: effectFormData.icon.trim() ? effectFormData.icon.trim() : null,
				color: effectFormData.color,
				effect_type: effectFormData.effect_type,
				updated_at: new Date().toISOString()
			};

			if (editingEffectId) {
				const { error: err } = await supabase.from('special_effects').update(payload).eq('id', editingEffectId);
				if (err) throw err;
			} else {
				const { error: err } = await supabase.from('special_effects').insert(payload);
				if (err) throw err;
			}

			await Promise.all([loadSpecialEffects(), loadMonsterSpecialEffects(), loadMonsters()]);
			effectModalOpen = false;
			editingEffectId = null;
		} catch (err) {
			alert(`Failed to save special effect: ${getErrorMessage(err)}`);
		} finally {
			effectModalSaving = false;
		}
	}

	async function deleteEffect(effectId: string) {
		if (!confirm('Delete this special effect?')) return;
		try {
			const { error: err } = await supabase.from('special_effects').delete().eq('id', effectId);
			if (err) throw err;
			await Promise.all([loadSpecialEffects(), loadMonsterSpecialEffects(), loadMonsters()]);
		} catch (err) {
			alert(`Failed to delete special effect: ${getErrorMessage(err)}`);
		}
	}
</script>

<PageLayout
	title="Monster Cards"
	subtitle="Manage monster card definitions (grouped by stage)"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		{#if activeTab === 'special-effects'}
			<Button variant="primary" onclick={openNewEffect}>+ Effect</Button>
		{/if}
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading…</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'monsters'}
		<AbyssDeckWorkspace
			{monsters}
			events={[]}
			locations={invadeLocations}
			{specialEffects}
			{monsterSpecialEffects}
			onMonsterSave={handleMonsterSave}
			onMonsterDelete={handleMonsterDelete}
			onSaveDeckOrder={saveNoOrder}
			defaultShowCardPreviews={false}
			showEvents={false}
			enableOrdering={false}
			enableQuantities={false}
			showImageUpload={true}
			imageUploadFolder="monsters"
			imageUploadCropTransparent={false}
		/>
	{:else if activeTab === 'gallery'}
		<div class="gallery-container">
			<div class="controls-bar">
				<div class="filters">
					<input
						type="text"
						placeholder="Search monsters..."
						bind:value={gallerySearchQuery}
						class="search-input"
					/>

					<select bind:value={galleryStageFilter} class="filter-select">
						<option value="all">All Stages</option>
						<option value="stage_1">Stage 1</option>
						<option value="stage_2">Stage 2</option>
						<option value="stage_3">Stage 3</option>
						<option value="final_stage">Final Stage</option>
						<option value="inactive">Inactive</option>
					</select>

					<select bind:value={galleryStatusFilter} class="filter-select">
						<option value="all">All Status</option>
						<option value="generated">Generated</option>
						<option value="not-generated">Not Generated</option>
					</select>
				</div>

				<div class="actions">
					{#if selectedGalleryCount > 0}
						<Button variant="secondary" onclick={deselectAllGalleryMonsters}>
							Deselect All
						</Button>
						<Button variant="primary" onclick={generateSelectedMonsterCards} disabled={generatingMonsterIds.size > 0}>
							Generate Selected ({selectedGalleryCount})
						</Button>
					{:else}
						<Button variant="secondary" onclick={selectAllGalleryMonsters}>
							Select All ({filteredGalleryMonsters.length})
						</Button>
					{/if}

					<Button
						variant="primary"
						onclick={generateAllMonsterCards}
						disabled={filteredGalleryMonsters.length === 0 || generatingMonsterIds.size > 0}
					>
						Generate All
					</Button>
				</div>
			</div>

			{#if galleryProgressMessage}
				<div class="progress-message">{galleryProgressMessage}</div>
			{/if}

			<div class="cards-grid">
				{#each filteredGalleryMonsters as monster (monster.id)}
					{@const isSelected = selectedMonsterIds.has(monster.id)}
					{@const isGenerating = generatingMonsterIds.has(monster.id)}
					{@const hasCardImage = !!monster.card_image_path}
					{@const cardImageUrl = getMonsterCardImageUrl(monster)}

					<div class="card-item" class:selected={isSelected}>
						<div class="card-checkbox">
							<input
								type="checkbox"
								checked={isSelected}
								onchange={() => toggleMonsterGallerySelection(monster.id)}
								disabled={isGenerating}
							/>
						</div>

						<div class="card-preview">
							{#if hasCardImage && cardImageUrl}
								<img src={cardImageUrl} alt={monster.name} loading="lazy" />
								<div class="card-status generated">
									<span class="status-icon">✓</span>
								</div>
							{:else}
								<div class="card-placeholder">
									{#if monster.icon_url}
										<img src={monster.icon_url} alt={monster.name} class="placeholder-icon" />
									{:else if monster.icon}
										<div class="placeholder-emoji">{monster.icon}</div>
									{:else}
										<div class="placeholder-emoji">👹</div>
									{/if}
									<span class="placeholder-text">{monster.name}</span>
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
								<h3 class="card-name">{monster.name}</h3>
									<span class="card-badge state-badge" style="--state-color: {getMonsterStageColor(monster.stage)}">
										{monster.stage}
									</span>
								</div>

							<div class="card-footer">
								<span class="card-order">#{(monster.order_num ?? 0) + 1}</span>
								<Button
									variant="secondary"
									size="sm"
									onclick={() => generateMonsterCard(monster)}
									disabled={isGenerating}
								>
									{isGenerating ? 'Generating...' : hasCardImage ? 'Regenerate' : 'Generate'}
								</Button>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if filteredGalleryMonsters.length === 0}
				<div class="empty-state">No monsters match the current filters.</div>
			{/if}
		</div>
	{:else if activeTab === 'special-effects'}
		<div class="effects-grid">
			{#each specialEffects as effect (effect.id)}
				{@const typeLabel = effectTypeOptions.find((o) => o.value === effect.effect_type)?.label ?? 'During Combat'}
				<div class="effect-card">
					<div class="effect-card__header">
						<div class="effect-card__title">
							{#if effect.icon}
								<span class="effect-card__icon">{effect.icon}</span>
							{/if}
							<span class="effect-card__name">{effect.name}</span>
						</div>
						<div class="effect-card__actions">
							<button class="btn" onclick={() => openEditEffect(effect)}>Edit</button>
							<button class="btn danger" onclick={() => deleteEffect(effect.id)}>Delete</button>
						</div>
					</div>
					<div class="effect-card__meta">
						<span class="pill">{typeLabel}</span>
						<span class="pill" style={`border-color:${effect.color ?? '#a855f7'}; color:${effect.color ?? '#a855f7'};`}>
							{effect.color ?? '#a855f7'}
						</span>
					</div>
					{#if effect.description}
						<p class="effect-card__desc">{effect.description}</p>
					{/if}
				</div>
			{/each}
			{#if specialEffects.length === 0}
				<div class="empty-state">No special effects yet. Click “+ Effect” to create one.</div>
			{/if}
		</div>
	{/if}
</PageLayout>

<Modal bind:open={effectModalOpen} title={isEditingEffect ? 'Edit Special Effect' : 'Create Special Effect'}>
	<FormField label="Name" required>
		<Input bind:value={effectFormData.name} disabled={effectModalSaving} />
	</FormField>
	<FormField label="Type">
		<Select bind:value={effectFormData.effect_type} options={effectTypeOptions} disabled={effectModalSaving} />
	</FormField>
	<div class="grid-2">
		<FormField label="Icon (emoji)">
			<Input bind:value={effectFormData.icon} placeholder="✨" disabled={effectModalSaving} />
		</FormField>
		<FormField label="Color">
			<Input type="color" bind:value={effectFormData.color} disabled={effectModalSaving} />
		</FormField>
	</div>
	<FormField label="Description">
		<Textarea rows={3} bind:value={effectFormData.description} disabled={effectModalSaving} />
	</FormField>

	{#snippet footer()}
		<Button variant="secondary" onclick={() => (effectModalOpen = false)} disabled={effectModalSaving}>Cancel</Button>
		<Button variant="primary" onclick={saveEffect} disabled={effectModalSaving}>
			{effectModalSaving ? 'Saving…' : 'Save'}
		</Button>
	{/snippet}
</Modal>

<style>
	.loading-state,
	.error-state {
		padding: 1rem;
		color: #cbd5e1;
	}

	.error-state {
		color: #fecaca;
	}

	/* Gallery Tab Styles (restored) */
	.gallery-container {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.controls-bar {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.75rem;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
		flex-wrap: wrap;
	}

	.filters {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.search-input {
		padding: 0.5rem 0.75rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
		min-width: 220px;
	}

	.filter-select {
		padding: 0.5rem 0.6rem;
		border-radius: 8px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.35);
		color: #e2e8f0;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.progress-message {
		padding: 0.5rem 0.75rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.25);
		color: #cbd5e1;
		font-size: 0.85rem;
	}

	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.card-item {
		position: relative;
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		overflow: hidden;
		transition: border-color 0.15s ease, transform 0.15s ease;
	}

	.card-item:hover {
		border-color: rgba(148, 163, 184, 0.25);
		transform: translateY(-1px);
	}

	.card-item.selected {
		border-color: rgba(96, 165, 250, 0.6);
		box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.18);
	}

	.card-checkbox {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 3;
	}

	.card-checkbox input {
		width: 16px;
		height: 16px;
		accent-color: #60a5fa;
	}

	.card-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 600 / 437;
		background: rgba(15, 23, 42, 0.5);
		display: grid;
		place-items: center;
	}

	.card-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.card-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.75rem;
		text-align: center;
		color: #cbd5e1;
	}

	.placeholder-icon {
		width: 72px;
		height: 72px;
		object-fit: contain;
		filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.4));
	}

	.placeholder-emoji {
		font-size: 2.25rem;
	}

	.placeholder-text {
		font-weight: 700;
		font-size: 0.9rem;
		color: #e2e8f0;
	}

	.card-status {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 22px;
		height: 22px;
		border-radius: 999px;
		display: grid;
		place-items: center;
		font-size: 0.75rem;
		font-weight: 900;
	}

	.card-status.generated {
		background: rgba(34, 197, 94, 0.18);
		border: 1px solid rgba(34, 197, 94, 0.35);
		color: #bbf7d0;
	}

	.card-generating {
		position: absolute;
		inset: 0;
		background: rgba(2, 6, 23, 0.65);
		display: grid;
		place-items: center;
		z-index: 2;
	}

	.spinner {
		width: 28px;
		height: 28px;
		border-radius: 999px;
		border: 3px solid rgba(148, 163, 184, 0.35);
		border-top-color: rgba(96, 165, 250, 0.9);
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.card-info {
		padding: 0.65rem 0.75rem 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		align-items: center;
	}

	.card-name {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 800;
		color: #f8fafc;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card-badge {
		font-size: 0.7rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #cbd5e1;
	}

	.state-badge {
		border-color: color-mix(in srgb, var(--state-color) 55%, rgba(148, 163, 184, 0.3));
		color: var(--state-color);
	}

	.card-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}

	.card-order {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.effects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
		gap: 0.75rem;
	}

	.effect-card {
		background: rgba(2, 6, 23, 0.35);
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.effect-card__header {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}

	.effect-card__title {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		min-width: 0;
	}

	.effect-card__icon {
		font-size: 1.25rem;
	}

	.effect-card__name {
		font-weight: 700;
		color: #f8fafc;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.effect-card__actions {
		display: flex;
		gap: 0.35rem;
		flex-shrink: 0;
	}

	.btn {
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(30, 41, 59, 0.6);
		color: #e2e8f0;
		border-radius: 8px;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.btn:hover:enabled {
		background: rgba(51, 65, 85, 0.75);
		border-color: rgba(148, 163, 184, 0.35);
	}

	.btn.danger {
		background: rgba(248, 113, 113, 0.12);
		border-color: rgba(248, 113, 113, 0.25);
		color: #fecaca;
	}

	.btn.danger:hover:enabled {
		background: rgba(248, 113, 113, 0.2);
		border-color: rgba(248, 113, 113, 0.4);
	}

	.effect-card__meta {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
	}

	.pill {
		font-size: 0.7rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		color: #cbd5e1;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.effect-card__desc {
		margin: 0;
		color: #cbd5e1;
		font-size: 0.9rem;
		line-height: 1.3;
	}

	.empty-state {
		padding: 1rem;
		color: #94a3b8;
	}

	.grid-2 {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.75rem;
	}
</style>
