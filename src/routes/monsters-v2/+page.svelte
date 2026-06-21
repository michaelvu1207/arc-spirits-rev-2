<script lang="ts">
	import { onMount } from 'svelte';
	import JSZip from 'jszip';
	import { supabase } from '$lib/api/supabaseClient';
	import { getErrorMessage } from '$lib/utils';
	import { publicAssetUrl } from '$lib/utils/storage';
	import { loadIconPool } from '$lib/utils/iconPool';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { Button } from '$lib/components/ui';
	import ImageUploader from '$lib/components/shared/ImageUploader.svelte';
	import type { Monster } from '$lib/components/abyss-deck';
	import AbyssDeckWorkspace from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
	import type { MonsterFormData as AbyssMonsterFormData } from '$lib/components/abyss-deck/AbyssDeckWorkspace.svelte';
	import monsterCardPhotoshopScript from '../../../scripts/monster-card-game-print.jsx?raw';
	import CardLayoutConfigurator from '$lib/components/shared/CardLayoutConfigurator.svelte';
	import { monsterCardRenderer, buildMonsterZoneData } from '$lib/generators/cards/monsterCardRenderer';
	import { batchExportCards } from '$lib/generators/shared/batchExport';
	import { loadOpsilonFont, loadVincendoFont } from '$lib/generators/shared/canvas';
	import type { CardLayoutConfig, CardRenderer } from '$lib/generators/shared/layoutTypes';
	import type { MonsterForLayout } from '$lib/generators/cards/monsterCardRenderer';

	/** Wraps the shared renderer but strips the "effects" zone from the default config. */
	const monsterV2Renderer: CardRenderer<MonsterForLayout> = {
		...monsterCardRenderer,
		getDefaultConfig() {
			const base = monsterCardRenderer.getDefaultConfig();
			return {
				...base,
				zones: base.zones
					.filter((z) => z.key !== 'effects')
					.map((z) => (z.key === 'barrier' ? { ...z, label: 'Damage to Kill' } : z))
			};
		}
	};

	const tabs: Tab[] = [
		{ id: 'monsters', label: 'Monsters', icon: '👾' },
		{ id: 'gallery', label: 'Card Gallery', icon: '🖼️' }
	];
	let activeTab = $state('monsters');

	let monsters = $state<Monster[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	let gallerySearchQuery = $state('');
	let galleryStatusFilter = $state<'all' | 'generated' | 'not-generated'>('all');
	let selectedMonsterIds = $state<Set<string>>(new Set());
	let galleryProgressMessage = $state<string | null>(null);
	let exportingZip = $state(false);
	let layoutPlacerOpen = $state(false);
	let baseTemplatePath = $state<string | null>(null);

	const TEMPLATE_SETTINGS_KEY = 'monsters_v2_base_template';

	const filteredGalleryMonsters = $derived.by(() => {
		const term = gallerySearchQuery.trim().toLowerCase();
			return monsters
				.filter((monster) => {
					if (galleryStatusFilter === 'generated' && !monster.card_image_path) return false;
					if (galleryStatusFilter === 'not-generated' && monster.card_image_path) return false;
					if (!term) return true;
					return monster.name.toLowerCase().includes(term);
				})
			.sort((a, b) => (a.order_num ?? 999) - (b.order_num ?? 999));
	});

	const selectedGalleryCount = $derived.by(() => selectedMonsterIds.size);

	function csvEscape(value: string | number | null | undefined): string {
		const str = value === null || value === undefined ? '' : String(value);
		if (/[,"\n]/.test(str)) {
			return '"' + str.replace(/"/g, '""') + '"';
		}
		return str;
	}

	function sanitizeFileName(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 80);
	}

	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function extensionFromMime(mime: string): string | null {
		switch (mime) {
			case 'image/png':
				return 'png';
			case 'image/jpeg':
				return 'jpg';
			case 'image/webp':
				return 'webp';
			default:
				return null;
		}
	}

	function normalizeMime(mime: string | null | undefined): string {
		return (mime ?? '').split(';')[0].trim().toLowerCase();
	}

	onMount(loadData);

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	async function loadData() {
		loading = true;
		error = null;
		try {
			await Promise.all([loadIconPool(), loadBaseTemplate()]);
			await loadMonsters();
		} catch (err) {
			error = getErrorMessage(err);
		} finally {
			loading = false;
		}
	}

	async function loadBaseTemplate() {
		const { data, error: err } = await supabase
			.from('ui_settings')
			.select('value')
			.eq('key', TEMPLATE_SETTINGS_KEY)
			.maybeSingle();
		if (err) throw err;
		baseTemplatePath = (data?.value as { path?: string } | null)?.path ?? null;
	}

	async function saveBaseTemplate(path: string) {
		baseTemplatePath = path;
		const { error: err } = await supabase
			.from('ui_settings')
			.upsert(
				{
					key: TEMPLATE_SETTINGS_KEY,
					value: { path },
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'key' }
			);
		if (err) {
			console.error('Failed to save base template setting:', err);
			alert(`Failed to save template setting: ${getErrorMessage(err)}`);
		}
	}

	async function loadMonsters() {
		const { data, error: err } = await supabase.from('monsters_v2').select('*').order('order_num', { ascending: true });
		if (err) throw err;

		monsters = (data ?? []).map((monster: any) => {
			return {
				...monster,
				// Provide defaults for fields required by Monster type but absent from v2 schema
				attack_type: monster.attack_type ?? 'damage',
				stage_num: monster.stage ?? 1,
				stage: 'stage_1',
				monster_classification: 'monster',
				icon: null,
				image_path: null,
				card_base_image_path: baseTemplatePath,
				invade_location_id: null,
				special_conditions: null,
				quantity: 1,
				icon_url: null,
				art_url: null,
				effects: [],
				invade_location_name: null
			} as Monster;
		});
	}

	function getMonsterCardImageUrl(monster: Monster): string | null {
		return publicAssetUrl(monster.card_image_path, { updatedAt: monster.updated_at ?? undefined });
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

	function buildMonsterCsv(targets: Monster[]): string {
		const rows: string[][] = [
			[
				'MonsterID',
				'Name',
				'Stage',
				'AttackType',
				'Damage',
				'Barrier',
				'DicePool',
				'RewardTrack',
				'OrderNum'
			]
		];

		for (const monster of targets) {
			const m = monster as unknown as { attack_type?: string; dice_pool?: string[]; reward_track?: unknown; stage_num?: number };
			const attackType = m.attack_type ?? 'damage';
			rows.push([
				monster.id,
				monster.name,
				(m as unknown as { stage?: number }).stage ?? 1,
				attackType,
				attackType === 'damage' ? (monster.damage ?? 0) : '',
				monster.barrier ?? 0,
				attackType === 'dice_pool' ? JSON.stringify(m.dice_pool ?? []) : '',
				JSON.stringify(m.reward_track ?? []),
				monster.order_num ?? 0
			].map(csvEscape));
		}

		return rows.map((r) => r.join(',')).join('\n') + '\n';
	}

	async function exportMonsterCardsZip(onlySelected: boolean) {
		const targets = onlySelected
			? monsters.filter((m) => selectedMonsterIds.has(m.id))
			: filteredGalleryMonsters;

		if (targets.length === 0) {
			alert(onlySelected ? 'No monsters selected.' : 'No monsters match the current filters.');
			return;
		}

		if (exportingZip) return;
		if (!confirm(`Export an art pack ZIP for ${targets.length} monster${targets.length === 1 ? '' : 's'}?`)) return;

		exportingZip = true;
		const zip = new JSZip();
		const artFolder = zip.folder('art_raw');
		const errors: string[] = [];

		try {
			zip.file('monster_cards.csv', buildMonsterCsv(targets));
			zip.file('scripts/monster-card-game-print.jsx', monsterCardPhotoshopScript);

			for (let i = 0; i < targets.length; i++) {
				const monster = targets[i];
				galleryProgressMessage = `Exporting ${i + 1}/${targets.length}: ${monster.name}...`;

				try {
					const cardUrl = getMonsterCardImageUrl(monster);
					if (!cardUrl) continue;

					const resp = await fetch(cardUrl);
					if (!resp.ok) throw new Error(`Fetch card failed (${resp.status})`);
					const blob = await resp.blob();

					const order = Math.max(0, Math.trunc(Number(monster.order_num ?? 0)));
					const orderTag = String(order + 1).padStart(3, '0');
					const safeName = sanitizeFileName(monster.name) || 'monster';
					const headerMime = normalizeMime(resp.headers.get('content-type'));
					const blobMime = normalizeMime(blob.type);
					const ext =
						extensionFromMime(headerMime) ||
						extensionFromMime(blobMime) ||
						'png';
					const fileName = `${orderTag}_${monster.id}_${safeName}.${ext}`;
					artFolder?.file(fileName, await blob.arrayBuffer());
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					errors.push(`${monster.name}: ${message}`);
				}
			}

			const dateTag = new Date().toISOString().slice(0, 10);
			const blob = await zip.generateAsync({ type: 'blob' });
			downloadBlob(blob, `monster_v2_cards_export_${dateTag}.zip`);

			if (errors.length > 0) {
				alert(
					`Exported ZIP with ${targets.length - errors.length} image(s) and ${errors.length} error(s).\n` +
						errors.slice(0, 5).join('\n')
				);
			} else {
				galleryProgressMessage = `✓ Exported ${targets.length} monster card${targets.length === 1 ? '' : 's'}`;
			}
		} catch (err) {
			console.error(err);
			alert(`Failed to export ZIP: ${getErrorMessage(err)}`);
		} finally {
			exportingZip = false;
		}
	}

	async function handleMonsterSave(formData: AbyssMonsterFormData, id: string | null): Promise<string> {
		if (!formData.name.trim()) {
			throw new Error('Monster name is required.');
		}

		const normalizeRewardTrack = (raw: unknown): string[] => {
			if (!Array.isArray(raw)) return [];
			return raw
				.filter((id): id is string => typeof id === 'string')
				.map((id) => id.trim())
				.filter(Boolean)
				.slice(0, 6);
		};

		const barrierValue = Math.max(0, Math.trunc(Number(formData.barrier ?? 0)));
		const reward_track = normalizeRewardTrack((formData as unknown as { reward_track?: unknown }).reward_track);
		const attack_type: 'damage' | 'dice_pool' = ((formData as unknown as { attack_type?: string }).attack_type === 'dice_pool') ? 'dice_pool' : 'damage';
		const dice_pool: string[] = attack_type === 'dice_pool'
			? (Array.isArray((formData as unknown as { dice_pool?: unknown }).dice_pool)
				? ((formData as unknown as { dice_pool?: string[] }).dice_pool ?? []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
				: [])
			: [];
		const damage = attack_type === 'damage' ? formData.damage : 0;
		const stage = Math.max(1, Math.trunc(Number((formData as unknown as { stage_num?: number }).stage_num ?? 1)));
		const choose_amount = Math.max(0, Math.trunc(Number((formData as unknown as { choose_amount?: number }).choose_amount ?? 0)));
		const now = new Date().toISOString();

		let monsterId: string;
		if (id) {
			const { error: err } = await supabase
				.from('monsters_v2')
				.update({
					name: formData.name,
					attack_type,
					damage,
					barrier: barrierValue,
					stage,
					card_image_path: formData.card_image_path ?? null,
					reward_track,
					dice_pool,
					choose_amount,
					order_num: Math.max(0, Math.trunc(Number(formData.order_num ?? 0))),
					updated_at: now
				})
				.eq('id', id);
			if (err) throw err;
			monsterId = id;
		} else {
			const nextOrderNum = monsters.reduce((max, m) => Math.max(max, m.order_num ?? 0), -1) + 1;
			const insertPayload: Record<string, unknown> = {
				name: formData.name,
				attack_type,
				damage,
				barrier: barrierValue,
				stage,
				card_image_path: formData.card_image_path ?? null,
				reward_track,
				dice_pool,
				choose_amount,
				order_num: nextOrderNum,
				updated_at: now
			};

			const { data, error: err } = await supabase
				.from('monsters_v2')
				.insert(insertPayload)
				.select('id')
				.single();
			if (err) throw err;
			monsterId = data.id as string;
		}

		await loadMonsters();
		return monsterId;
	}

	async function handleMonsterDelete(monsterId: string) {
		const { error: monsterErr } = await supabase.from('monsters_v2').delete().eq('id', monsterId);
		if (monsterErr) throw monsterErr;

		await loadMonsters();
	}

	async function saveMonsterDeckOrder(order: { type: 'monster' | 'event'; id: string }[]) {
		const monsterUpdates = order
			.map((item, order_num) => (item.type === 'monster' ? { id: item.id, order_num } : null))
			.filter((x): x is { id: string; order_num: number } => x !== null);

		if (monsterUpdates.length === 0) return;

		const updatedAt = new Date().toISOString();
		const chunkSize = 30;
		for (let i = 0; i < monsterUpdates.length; i += chunkSize) {
			const chunk = monsterUpdates.slice(i, i + chunkSize);
			const { error: err } = await Promise.all(
				chunk.map((u) => supabase.from('monsters_v2').update({ order_num: u.order_num, updated_at: updatedAt }).eq('id', u.id))
			).then((results) => {
				const firstError = results.find((r) => r.error)?.error ?? null;
				return { error: firstError };
			});
			if (err) throw err;
		}

		await loadMonsters();
	}

	function getBaseImageUrl(): string | null {
		if (!baseTemplatePath) return null;
		return publicAssetUrl(baseTemplatePath) ?? null;
	}

	function buildMonsterV2ZoneData(monster: MonsterForLayout, config: CardLayoutConfig) {
		const zoneData = buildMonsterZoneData(monster, config);
		return {
			...zoneData,
			texts: {
				...zoneData.texts,
				barrier: `Damage to Kill: ${monster.barrier ?? 0}`
			}
		};
	}

	async function handleBatchGenerate(config: CardLayoutConfig) {
		if (!baseTemplatePath) {
			alert('Upload a base template image first.');
			return;
		}
		const templateUrl = getBaseImageUrl()!;
		const monsterLayoutEntities = monsters as unknown as MonsterForLayout[];
		const result = await batchExportCards<MonsterForLayout>({
			entities: monsterLayoutEntities,
			config,
			renderer: monsterV2Renderer,
			getBaseImageUrl: () => templateUrl,
			getId: (m) => m.id,
			getName: (m) => m.name,
			buildZoneData: (m, cfg) => buildMonsterV2ZoneData(m, cfg),
			storageFolder: 'card_images/monsters_v2/en_generated',
			dbTable: 'monsters_v2',
			dbImageColumn: 'card_image_path',
			loadFonts: () => Promise.all([loadOpsilonFont(), loadVincendoFont()]).then(() => {})
		});
		if (result.errors.length) alert(`Done with ${result.errors.length} error(s).`);
		await loadMonsters();
	}
</script>

<PageLayout
	title="Monsters V2"
	subtitle="Manage monster card definitions V2"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#if loading}
		<div class="loading-state">Loading…</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'monsters'}
		<div class="template-bar">
			<span class="template-bar__label">Base Template:</span>
			{#if baseTemplatePath}
				{@const templatePreviewUrl = publicAssetUrl(baseTemplatePath)}
				{#if templatePreviewUrl}
					<img src={templatePreviewUrl} alt="Base template" class="template-bar__preview" />
				{/if}
			{:else}
				<span class="template-bar__empty">No template uploaded</span>
			{/if}
			<ImageUploader
				value={baseTemplatePath}
				folder="card_images/monsters_v2/base_template"
				filename="base"
				upsert={true}
				cropTransparent={false}
				maxSizeMB={10}
				onupload={(path) => saveBaseTemplate(path)}
			/>
		</div>
		<AbyssDeckWorkspace
			{monsters}
			events={[]}
			locations={[]}
			specialEffects={[]}
			monsterSpecialEffects={{}}
			onMonsterSave={handleMonsterSave}
			onMonsterDelete={handleMonsterDelete}
			onSaveDeckOrder={saveMonsterDeckOrder}
			defaultShowCardPreviews={false}
			showEvents={false}
			enableOrdering={true}
			enableQuantities={false}
			showImageUpload={false}
			imageUploadCropTransparent={false}
			showInvadeLocation={false}
			showSpecialEffects={false}
			showAttackTypeToggle={true}
			showStageAsInteger={true}
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

					<select bind:value={galleryStatusFilter} class="filter-select">
						<option value="all">All Status</option>
						<option value="generated">Generated (final)</option>
						<option value="not-generated">Not Generated (final)</option>
					</select>
				</div>

				<div class="actions">
					<span title={!baseTemplatePath ? 'Upload a base template first' : undefined}>
						<Button
							variant="primary"
							onclick={() => (layoutPlacerOpen = true)}
							disabled={!baseTemplatePath || exportingZip}
						>
							Layout Placer
						</Button>
					</span>
					{#if selectedGalleryCount > 0}
						<Button variant="secondary" onclick={deselectAllGalleryMonsters}>
							Deselect All
						</Button>
						<Button
							variant="secondary"
							onclick={() => exportMonsterCardsZip(true)}
							disabled={exportingZip}
						>
							{exportingZip ? 'Exporting…' : `Export Art ZIP (${selectedGalleryCount})`}
						</Button>
					{:else}
						<Button variant="secondary" onclick={selectAllGalleryMonsters}>
							Select All ({filteredGalleryMonsters.length})
						</Button>
						<Button
							variant="secondary"
							onclick={() => exportMonsterCardsZip(false)}
							disabled={filteredGalleryMonsters.length === 0 || exportingZip}
						>
							{exportingZip ? 'Exporting…' : `Export Art ZIP (${filteredGalleryMonsters.length})`}
						</Button>
					{/if}
				</div>
			</div>

			{#if galleryProgressMessage}
				<div class="progress-message">{galleryProgressMessage}</div>
			{/if}

			<div class="cards-grid">
				{#each filteredGalleryMonsters as monster (monster.id)}
					{@const isSelected = selectedMonsterIds.has(monster.id)}
					{@const hasCardImage = !!monster.card_image_path}
					{@const cardImageUrl = getMonsterCardImageUrl(monster)}

					<div class="card-item" class:selected={isSelected}>
						<div class="card-checkbox">
							<input
								type="checkbox"
								checked={isSelected}
								onchange={() => toggleMonsterGallerySelection(monster.id)}
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
									<div class="placeholder-emoji">👾</div>
									<span class="placeholder-text">{monster.name}</span>
								</div>
							{/if}
						</div>

						<div class="card-info">
							<div class="card-header">
								<h3 class="card-name">{monster.name}</h3>
							</div>

							<div class="card-footer">
								<span class="card-order">#{(monster.order_num ?? 0) + 1}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if filteredGalleryMonsters.length === 0}
				<div class="empty-state">No monsters match the current filters.</div>
			{/if}
		</div>
	{/if}

	<CardLayoutConfigurator
		isOpen={layoutPlacerOpen}
		cardType="monster"
		configKey="v2"
		sampleEntities={monsters}
			renderer={monsterV2Renderer}
			getBaseImageUrl={() => getBaseImageUrl()}
			buildZoneData={(m, cfg) => buildMonsterV2ZoneData(m as MonsterForLayout, cfg)}
			onBatchGenerate={handleBatchGenerate}
			onClose={() => (layoutPlacerOpen = false)}
		/>
</PageLayout>

<style>
	.loading-state,
	.error-state {
		padding: 1rem;
		color: #cbd5e1;
	}

	.error-state {
		color: #fecaca;
	}

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

	.template-bar {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.6rem 0.75rem;
		margin-bottom: 0.5rem;
		background: rgba(15, 23, 42, 0.4);
		border: 1px solid rgba(148, 163, 184, 0.16);
		border-radius: 12px;
	}

	.template-bar__label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #cbd5e1;
		white-space: nowrap;
	}

	.template-bar__preview {
		width: 64px;
		height: 48px;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid rgba(148, 163, 184, 0.2);
	}

	.template-bar__empty {
		font-size: 0.8rem;
		color: rgba(148, 163, 184, 0.6);
		font-style: italic;
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

	.empty-state {
		padding: 1rem;
		color: #94a3b8;
	}
</style>
