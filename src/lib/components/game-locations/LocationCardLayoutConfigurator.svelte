<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/api/supabaseClient';
	import { loadOpsilonFont, loadImage } from '$lib/generators/shared/canvas';
	import type { GameLocationRewardRow, GameLocationRow } from '$lib/types/gameData';
	import {
		coerceLocationCardLayoutConfig,
		createDefaultLocationCardLayoutConfig,
		type Box,
		type LocationCardLayoutConfig,
		type LocationCardPlacementKey,
		type LocationCardRewardRowKey,
		type TextStyle,
		type Transform,
		REWARD_ROW_BASE_ICON_SIZE
	} from '$lib/generators/game-locations/locationCardLayoutConfig';
	import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
	import { isRewardOrIconToken, rewardIconTokensHaveAnyIcons } from '$lib/utils/rewardIconTokens';
	import { publicAssetUrl } from '$lib/utils/storage';

	interface Props {
		isOpen: boolean;
		locations: GameLocationRow[];
		configKey?: string;
		getRewardRows?: (locationId: string) => GameLocationRewardRow[];
		onClose: () => void;
	}

	let { isOpen, locations, configKey = 'base', getRewardRows, onClose }: Props = $props();

	// Config is null until loaded from DB or a sample location image provides dimensions
	let config = $state<LocationCardLayoutConfig | null>(null);
	let loadedFromDb = $state(false);
	let hasSavedRow = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let sampleLocationId = $state<string>('');
	let sampleBackgroundUrl = $state<string | null>(null);
	let sampleBgSize = $state<{ w: number; h: number } | null>(null);
	let displayScale = $state(1);

	type ElementKey = `${LocationCardPlacementKey}:${0 | 1}`;
	const elementKey = (base: LocationCardPlacementKey, copy: 0 | 1): ElementKey => `${base}:${copy}` as ElementKey;
	const copyIndexOf = (key: ElementKey): 0 | 1 => Number.parseInt(key.split(':')[1], 10) as 0 | 1;
	const baseKeyOf = (key: ElementKey): LocationCardPlacementKey => key.split(':')[0] as LocationCardPlacementKey;
	const copies = [0] as const;
	const nameCopies = [0, 1] as const;

	let selectedElement = $state<ElementKey>('name:0');
	let stageEl = $state<HTMLDivElement | null>(null);
	let dragging = $state<{ key: ElementKey; offsetX: number; offsetY: number } | null>(null);

	const elements: { key: ElementKey; label: string }[] = [
		{ key: 'name:0', label: 'Name' },
		{ key: 'name:1', label: 'Name (2)' },
		{ key: 'row_1:0', label: 'Reward Row 1' },
		{ key: 'row_2:0', label: 'Reward Row 2' },
		{ key: 'row_3:0', label: 'Reward Row 3' },
		{ key: 'row_4:0', label: 'Reward Row 4' },
		{ key: 'row_5:0', label: 'Reward Row 5' }
	];

	onMount(async () => {
		await Promise.all([loadIconPool(), loadOpsilonFont()]);
	});

	$effect(() => {
		if (!isOpen) return;
		void ensureLoaded();
	});

	$effect(() => {
		if (!isOpen) return;
		void loadSampleImage();
	});

	function hasRewardContent(row: GameLocationRewardRow | null | undefined): boolean {
		if (!row) return false;
		if (row.type === 'text') return row.text.trim().length > 0;
		if (row.type === 'trade') {
			return rewardIconTokensHaveAnyIcons(row.cost_icon_ids) || rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
		}
		return rewardIconTokensHaveAnyIcons(row.gain_icon_ids);
	}

	async function ensureLoaded() {
		if (loadedFromDb) return;
		error = null;
		try {
			const { data, error: err } = await supabase
				.schema('arc_spirits_assets')
				.from('game_location_card_layout_configs')
				.select('config')
				.eq('key', configKey)
				.maybeSingle();
			if (err) throw err;
			hasSavedRow = data !== null;
			config = coerceLocationCardLayoutConfig(data?.config ?? null) ?? null;
			loadedFromDb = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			config = null;
			loadedFromDb = true;
			hasSavedRow = false;
		}
	}

	async function saveConfig() {
		if (!config) return;
		saving = true;
		error = null;
		try {
			const { error: err } = await supabase
				.schema('arc_spirits_assets')
				.from('game_location_card_layout_configs')
				.upsert({ key: configKey, config }, { onConflict: 'key' });
			if (err) throw err;
			hasSavedRow = true;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}

	function resetToDefaultForRef(refW: number, refH: number) {
		config = createDefaultLocationCardLayoutConfig(refW, refH);
		selectedElement = 'name:0';
	}

	async function loadSampleImage() {
		const location = locations.find((l) => l.id === sampleLocationId) ?? null;
		if (!location?.background_image_path) {
			sampleBackgroundUrl = null;
			sampleBgSize = null;
			return;
		}

		try {
			const url = publicAssetUrl(location.background_image_path, { updatedAt: location.updated_at ?? 0 });
			if (!url) throw new Error('Missing public URL.');
			const img = await loadImage(url);

			const iw = img.naturalWidth || img.width;
			const ih = img.naturalHeight || img.height;
			sampleBgSize = iw && ih ? { w: iw, h: ih } : null;
			sampleBackgroundUrl = url;

			if (!config && iw && ih) {
				// Config not yet initialized – create from sample image dimensions
				resetToDefaultForRef(iw, ih);
			}

			if (config) {
				const maxW = 1050;
				const maxH = 740;
				displayScale = Math.min(1, maxW / Math.max(1, config._ref_w), maxH / Math.max(1, config._ref_h));
			}
		} catch {
			sampleBackgroundUrl = null;
			sampleBgSize = null;
		}
	}

	function placementFor(key: ElementKey): Transform | null {
		if (!config) return null;
		const base = baseKeyOf(key);
		const copy = copyIndexOf(key);
		return config.placements[base][copy];
	}

	function isRewardRowKey(key: LocationCardPlacementKey): key is LocationCardRewardRowKey {
		return key === 'row_1' || key === 'row_2' || key === 'row_3' || key === 'row_4' || key === 'row_5';
	}

	function textBoxFor(key: ElementKey): Box | null {
		if (!config) return null;
		const base = baseKeyOf(key);
		if (!isRewardRowKey(base)) return null;
		const copy = copyIndexOf(key);
		return config.reward_text_boxes[base][copy];
	}

function updatePlacement(key: ElementKey, partial: Partial<Transform>) {
	if (!config) return;
	const base = baseKeyOf(key);
	const copy = copyIndexOf(key);
	const current = config.placements[base];
	const next: [Transform, Transform] =
		copy === 0
			? [{ ...current[0], ...partial }, current[1]]
			: [current[0], { ...current[1], ...partial }];

		config = {
			...config,
			placements: {
				...config.placements,
				[base]: next
			}
		};
	}

	function updateTextBox(key: ElementKey, partial: Partial<Box>) {
		if (!config) return;
		const base = baseKeyOf(key);
		if (!isRewardRowKey(base)) return;
		const copy = copyIndexOf(key);
		const current = config.reward_text_boxes[base];

		const nextBox: Box = {
			w: Math.max(1, Math.round(coerceFinite(partial.w, current[copy].w))),
			h: Math.max(1, Math.round(coerceFinite(partial.h, current[copy].h)))
		};
		const next: [Box, Box] = copy === 0 ? [nextBox, current[1]] : [current[0], nextBox];

		config = {
			...config,
			reward_text_boxes: {
				...config.reward_text_boxes,
				[base]: next
			}
		};
	}

	function updateRewardTextStyle(partial: Partial<TextStyle>) {
		if (!config) return;
		const next: TextStyle = {
			...config.reward_text_style,
			...partial,
			fontSize: Math.max(
				1,
				Math.round(coerceFinite(partial.fontSize, config.reward_text_style.fontSize))
			)
		};

		config = { ...config, reward_text_style: next };
	}

	function updateNameStyle(partial: Partial<TextStyle>) {
		if (!config) return;
		config = { ...config, name_style: { ...config.name_style, ...partial } };
	}

	function coerceFinite(v: unknown, fallback: number): number {
		const n = typeof v === 'number' ? v : Number(v);
		return Number.isFinite(n) ? n : fallback;
	}

	function onPlacedPointerDown(e: PointerEvent, key: ElementKey) {
		if (!stageEl || !config) return;
		selectedElement = key;

		const rect = stageEl.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;

		const placement = placementFor(key);
		if (!placement) return;
		const left = placement.x * displayScale;
		const top = placement.y * displayScale;

		dragging = { key, offsetX: pointerX - left, offsetY: pointerY - top };
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}

	function onStagePointerMove(e: PointerEvent) {
		if (!stageEl || !dragging || !config) return;
		const rect = stageEl.getBoundingClientRect();
		const pointerX = e.clientX - rect.left;
		const pointerY = e.clientY - rect.top;

		const x = (pointerX - dragging.offsetX) / displayScale;
		const y = (pointerY - dragging.offsetY) / displayScale;
		updatePlacement(dragging.key, {
			x: Math.max(-config._ref_w, Math.min(config._ref_w * 2, x)),
			y: Math.max(-config._ref_h, Math.min(config._ref_h * 2, y))
		});
	}

	function onStagePointerUp() {
		dragging = null;
	}

	const sampleLocation = $derived.by(() => locations.find((l) => l.id === sampleLocationId) ?? null);
	const previewRows = $derived.by(() => {
		const rows = sampleLocation ? (getRewardRows?.(sampleLocation.id) ?? []) : [];
		return {
			row1: rows[0] ?? null,
			row2: rows[1] ?? null,
			row3: rows[2] ?? null,
			row4: rows[3] ?? null,
			row5: rows[4] ?? null
		};
	});

	const selectedPlacement = $derived.by(() => placementFor(selectedElement));
	const selectedTextBox = $derived.by(() => textBoxFor(selectedElement));
</script>

{#if isOpen}
	<div class="overlay" role="dialog" aria-modal="true" onkeydown={(e) => e.key === 'Escape' && onClose()}>
		<div class="modal">
			<header class="modal__header">
				<div>
					<h2>Location Card Layout Template</h2>
					<p class="modal__subtitle">Drag the overlays like the Spirit World editor. Save as a global template.</p>
				</div>
				<button class="icon-btn" type="button" onclick={onClose} aria-label="Close">✕</button>
			</header>

			{#if error}
				<div class="banner banner--error">{error}</div>
			{/if}

			<div class="content">
				<section class="stage-pane">
					<div class="stage-toolbar">
						<label class="field">
							<span>Sample Location</span>
							<select bind:value={sampleLocationId}>
								<option value="">(choose)</option>
								{#each locations as loc (loc.id)}
									<option value={loc.id}>{loc.name}</option>
								{/each}
							</select>
						</label>

						{#if config}
						<div class="hint">
							{config._ref_w}×{config._ref_h}
							{#if sampleBgSize}
								· Img: {sampleBgSize.w}×{sampleBgSize.h}
							{/if}
						</div>
					{/if}
					</div>

					<div class="stage-wrap">
						{#if config}
						<div
							class="stage"
							bind:this={stageEl}
							style={`width:${config._ref_w * displayScale}px;height:${config._ref_h * displayScale}px;${sampleBackgroundUrl ? `background-image:url('${sampleBackgroundUrl}');` : ''}`}
							onpointermove={onStagePointerMove}
							onpointerup={onStagePointerUp}
							onpointerleave={onStagePointerUp}
						>
							<!-- Name -->
							{#each nameCopies as copy (copy)}
								<div
									class="placed"
									class:is-selected={selectedElement === elementKey('name', copy)}
									style={`left:${config.placements.name[copy].x * displayScale}px;top:${config.placements.name[copy].y * displayScale}px;transform:translate(-50%, -50%) rotate(${config.placements.name[copy].rotation}deg) scale(${config.placements.name[copy].scale * displayScale});`}
									role="button"
									tabindex="0"
									onclick={() => (selectedElement = elementKey('name', copy))}
									onpointerdown={(e) => onPlacedPointerDown(e, elementKey('name', copy))}
								>
									<div
										class="location-name"
										style={`width:${Math.max(1, Math.round(config._ref_w * (460 / 600)))}px;font-size:${Math.max(6, config.name_style.fontSize)}px;line-height:${typeof config.name_style.lineHeight === 'number' ? `${Math.max(0, config.name_style.lineHeight)}px` : '1.15'};text-align:${config.name_style.align};color:${config.name_style.color};`}
									>
										{sampleLocation?.name ?? 'Location Name'}
									</div>
								</div>
							{/each}

							<!-- Reward rows -->
							{#each [
								{ key: 'row_1' as const, label: 'Reward Row 1', row: previewRows.row1 },
								{ key: 'row_2' as const, label: 'Reward Row 2', row: previewRows.row2 },
								{ key: 'row_3' as const, label: 'Reward Row 3', row: previewRows.row3 },
								{ key: 'row_4' as const, label: 'Reward Row 4', row: previewRows.row4 },
								{ key: 'row_5' as const, label: 'Reward Row 5', row: previewRows.row5 }
							] as item (item.key)}
								{#each copies as copy (copy)}
									{@const rowScale = Math.max(0.05, config.placements[item.key][copy].scale)}
									<div
										class="placed"
										class:is-selected={selectedElement === elementKey(item.key, copy)}
										style={`left:${config.placements[item.key][copy].x * displayScale}px;top:${config.placements[item.key][copy].y * displayScale}px;transform:translate(-50%, -50%) rotate(${config.placements[item.key][copy].rotation}deg) scale(${config.placements[item.key][copy].scale * displayScale});`}
										role="button"
										tabindex="0"
										onclick={() => (selectedElement = elementKey(item.key, copy))}
										onpointerdown={(e) => onPlacedPointerDown(e, elementKey(item.key, copy))}
									>
										{#if item.row && hasRewardContent(item.row)}
											<div
												class="placed__rewards"
												style={`--reward-icon-size:${REWARD_ROW_BASE_ICON_SIZE}px;--reward-icon-gap:10px;--reward-row-gap:12px;`}
											>
												<div
													class="reward-preview__row"
													class:is-trade={item.row.type === 'trade'}
													class:is-text={item.row.type === 'text'}
													style={item.row.type === 'text'
														? `width:${config.reward_text_boxes[item.key][copy].w / rowScale}px;height:${config.reward_text_boxes[item.key][copy].h / rowScale}px;font-size:${config.reward_text_style.fontSize / rowScale}px;line-height:${typeof config.reward_text_style.lineHeight === 'number' ? `${Math.max(0, config.reward_text_style.lineHeight / rowScale)}px` : '1.05'};text-align:${config.reward_text_style.align};color:${config.reward_text_style.color};`
														: ''}
												>
													{#if item.row.type === 'trade'}
														<div class="reward-preview__icons">
															{#each item.row.cost_icon_ids as token, iconIdx (iconIdx)}
																<div class="reward-preview__icon">
																	{#if typeof token === 'string'}
																		{@const url = getIconPoolUrl(token)}
																		{#if url}
																			<img src={url} alt="Cost icon" draggable="false" />
																		{/if}
																	{:else if isRewardOrIconToken(token)}
																		{#each token.icon_ids as iconId, j (j)}
																			{@const url = getIconPoolUrl(iconId)}
																			{#if url}
																				<img src={url} alt="OR icon" draggable="false" />
																			{/if}
																			{#if j < token.icon_ids.length - 1}
																				<span class="reward-preview__or-slash">/</span>
																			{/if}
																		{/each}
																	{/if}
																</div>
															{/each}
														</div>
														<span class="reward-preview__arrow">→</span>
														<div class="reward-preview__icons">
															{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
																<div class="reward-preview__icon">
																	{#if typeof token === 'string'}
																		{@const url = getIconPoolUrl(token)}
																		{#if url}
																			<img src={url} alt="Gain icon" draggable="false" />
																		{/if}
																	{:else if isRewardOrIconToken(token)}
																		{#each token.icon_ids as iconId, j (j)}
																			{@const url = getIconPoolUrl(iconId)}
																			{#if url}
																				<img src={url} alt="OR icon" draggable="false" />
																			{/if}
																			{#if j < token.icon_ids.length - 1}
																				<span class="reward-preview__or-slash">/</span>
																			{/if}
																		{/each}
																	{/if}
																</div>
															{/each}
														</div>
													{:else if item.row.type === 'gain'}
														<div class="reward-preview__icons">
															{#each item.row.gain_icon_ids as token, iconIdx (iconIdx)}
																<div class="reward-preview__icon">
																	{#if typeof token === 'string'}
																		{@const url = getIconPoolUrl(token)}
																		{#if url}
																			<img src={url} alt="Reward icon" draggable="false" />
																		{/if}
																	{:else if isRewardOrIconToken(token)}
																		{#each token.icon_ids as iconId, j (j)}
																			{@const url = getIconPoolUrl(iconId)}
																			{#if url}
																				<img src={url} alt="OR icon" draggable="false" />
																			{/if}
																			{#if j < token.icon_ids.length - 1}
																				<span class="reward-preview__or-slash">/</span>
																			{/if}
																		{/each}
																	{/if}
																</div>
															{/each}
														</div>
													{:else}
														<div class="reward-preview__text">{item.row.text}</div>
													{/if}
												</div>
											</div>
										{:else}
											<div class="placed__fallback">{item.label}</div>
										{/if}
										<div
											class="reward-text-bounds"
											style={`width:${config.reward_text_boxes[item.key][copy].w / rowScale}px;height:${config.reward_text_boxes[item.key][copy].h / rowScale}px;`}
										></div>
									</div>
								{/each}
							{/each}
						</div>
						{:else}
							<div class="stage-disabled">
								<p>Select a location with a background image to start editing.</p>
							</div>
						{/if}
					</div>
				</section>

				<aside class="sidebar">
				{#if config && selectedPlacement}
					<div class="section">
						<label class="field">
							<span>Element</span>
							<select bind:value={selectedElement}>
								{#each elements as el (el.key)}
									<option value={el.key}>{el.label}</option>
								{/each}
							</select>
						</label>
					</div>

					<div class="section">
						<h3>Transform</h3>
						<div class="grid">
							<label class="field">
								<span>X</span>
								<input
									type="number"
									value={selectedPlacement.x}
									oninput={(e) => updatePlacement(selectedElement, { x: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Y</span>
								<input
									type="number"
									value={selectedPlacement.y}
									oninput={(e) => updatePlacement(selectedElement, { y: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Rotation</span>
								<input
									type="number"
									value={selectedPlacement.rotation}
									oninput={(e) => updatePlacement(selectedElement, { rotation: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Scale</span>
								<input
									type="number"
									step="0.01"
									min="0.05"
									value={selectedPlacement.scale}
									oninput={(e) => updatePlacement(selectedElement, { scale: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
						</div>
					</div>

						{#if selectedTextBox}
							<div class="section">
								<h3>Text Reward Box</h3>
								<div class="grid">
								<label class="field">
									<span>Width</span>
									<input
										type="number"
										min="1"
										value={selectedTextBox.w}
										oninput={(e) => updateTextBox(selectedElement, { w: Number((e.target as HTMLInputElement).value) })}
									/>
								</label>
								<label class="field">
									<span>Height</span>
									<input
										type="number"
										min="1"
										value={selectedTextBox.h}
										oninput={(e) => updateTextBox(selectedElement, { h: Number((e.target as HTMLInputElement).value) })}
									/>
								</label>
								<label class="field">
									<span>Font Size</span>
									<input
										type="number"
										min="1"
										value={config.reward_text_style.fontSize}
										oninput={(e) =>
											updateRewardTextStyle({ fontSize: Number((e.target as HTMLInputElement).value) })}
									/>
								</label>
							</div>
						</div>
					{/if}


					<div class="section">
						<h3>Name Style</h3>
						<div class="grid">
							<label class="field">
								<span>Font</span>
								<input
									type="number"
									value={config.name_style.fontSize}
									oninput={(e) => updateNameStyle({ fontSize: Number((e.target as HTMLInputElement).value) })}
								/>
							</label>
							<label class="field">
								<span>Line H</span>
								<input
									type="number"
									placeholder="auto"
									value={config.name_style.lineHeight ?? ''}
									oninput={(e) => {
										const v = (e.target as HTMLInputElement).value;
										updateNameStyle({ lineHeight: v.trim() ? Number(v) : undefined });
									}}
								/>
							</label>
							<label class="field">
								<span>Align</span>
								<select
									value={config.name_style.align}
									onchange={(e) => updateNameStyle({ align: (e.target as HTMLSelectElement).value as any })}
								>
									<option value="left">Left</option>
									<option value="center">Center</option>
									<option value="right">Right</option>
								</select>
							</label>
							<label class="field">
								<span>Color</span>
								<input
									type="text"
									value={config.name_style.color}
									oninput={(e) => updateNameStyle({ color: (e.target as HTMLInputElement).value })}
								/>
							</label>
						</div>
					</div>

					<div class="section actions">
						<button class="btn btn--ghost" type="button" onclick={() => { if (config) resetToDefaultForRef(config._ref_w, config._ref_h); }} disabled={saving}>
							Reset
						</button>
						<button class="btn" type="button" onclick={saveConfig} disabled={saving}>
							{saving ? 'Saving…' : hasSavedRow ? 'Save Template' : 'Create Template'}
						</button>
					</div>
				{:else}
					<div class="stage-disabled">
						<p>Select a location with a background image to configure layout.</p>
					</div>
				{/if}
				</aside>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.78);
		display: grid;
		place-items: center;
		z-index: 60;
		padding: 1.25rem;
	}

	.modal {
		width: min(1200px, 96vw);
		max-height: min(860px, 92vh);
		display: flex;
		flex-direction: column;
		border-radius: 14px;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(15, 23, 42, 0.98);
		box-shadow: 0 24px 60px rgba(2, 6, 23, 0.6);
		overflow: hidden;
	}

	.modal__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 1rem 1.1rem;
		border-bottom: 1px solid rgba(148, 163, 184, 0.15);
	}

	.modal__header h2 {
		margin: 0;
		font-size: 1.05rem;
		color: #f8fafc;
	}

	.modal__subtitle {
		margin: 0.3rem 0 0;
		font-size: 0.85rem;
		color: rgba(148, 163, 184, 0.9);
	}

	.icon-btn {
		background: transparent;
		border: none;
		color: rgba(226, 232, 240, 0.9);
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0.25rem 0.35rem;
		line-height: 1;
	}

	.banner {
		padding: 0.75rem 1rem;
		margin: 0.75rem 1rem 0;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.4);
		color: #cbd5f5;
	}

	.banner--error {
		border-color: rgba(248, 113, 113, 0.35);
		background: rgba(248, 113, 113, 0.12);
		color: #fecaca;
	}

	.content {
		display: grid;
		grid-template-columns: 1fr 380px;
		gap: 0;
		min-height: 0;
		flex: 1;
	}

	.stage-pane {
		padding: 0.9rem;
		min-height: 0;
		border-right: 1px solid rgba(148, 163, 184, 0.12);
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.stage-toolbar {
		display: flex;
		gap: 0.75rem;
		align-items: flex-end;
		justify-content: space-between;
	}

	.stage-wrap {
		display: grid;
		place-items: center;
		padding: 0.75rem;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.15);
		background: rgba(2, 6, 23, 0.35);
		min-height: 0;
		flex: 1;
		overflow: auto;
		overscroll-behavior: contain;
	}

	.stage {
		position: relative;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.2);
		background: rgba(2, 6, 23, 0.2);
		background-size: cover;
		background-position: center;
		background-repeat: no-repeat;
		user-select: none;
		touch-action: none;
	}

	.stage-disabled {
		display: grid;
		place-items: center;
		min-height: 200px;
		color: rgba(148, 163, 184, 0.85);
		font-size: 0.9rem;
		text-align: center;
		padding: 2rem;
	}

	.hint {
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.85);
	}

	.placed {
		position: absolute;
		cursor: grab;
		transform-origin: center;
	}

	.placed.is-selected .placed__rewards,
	.placed.is-selected .placed__fallback,
	.placed.is-selected .location-name {
		outline: 2px solid rgba(168, 85, 247, 0.8);
		outline-offset: 2px;
	}

	.reward-text-bounds {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		border-radius: 12px;
		border: 2px dashed rgba(148, 163, 184, 0.4);
		opacity: 0;
		pointer-events: none;
	}

	.placed.is-selected .reward-text-bounds {
		opacity: 1;
		border-color: rgba(168, 85, 247, 0.8);
	}

	.placed__rewards {
		display: flex;
		flex-direction: column;
		gap: var(--reward-row-gap);
		filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.55));
	}

	.placed__fallback {
		padding: 0.5rem 0.6rem;
		border-radius: 10px;
		border: 1px solid rgba(148, 163, 184, 0.25);
		background: rgba(15, 23, 42, 0.75);
		color: #e2e8f0;
		font-size: 0.85rem;
		font-weight: 700;
		pointer-events: none;
	}

	.reward-preview__row {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
		min-width: 0;
		padding: 0.35rem 0.45rem;
		border-radius: 12px;
		position: relative;
		background: rgba(56, 35, 20, 0.9);
		border: 1px solid rgba(255, 255, 255, 0.5);
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.4);
	}

	.reward-preview__row > * {
		filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.55));
	}

	.reward-preview__icons {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
		min-width: 0;
		flex-wrap: nowrap;
	}

	.reward-preview__icon {
		display: flex;
		align-items: center;
		gap: var(--reward-icon-gap);
	}

	.reward-preview__icon img {
		height: var(--reward-icon-size);
		width: auto;
		max-width: calc(var(--reward-icon-size) * 1.8);
		display: block;
		pointer-events: none;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55));
	}

	.reward-preview__arrow {
		font-size: calc(var(--reward-icon-size) * 0.7);
		font-weight: 800;
		color: rgba(226, 232, 240, 0.9);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.reward-preview__or-slash {
		font-size: calc(var(--reward-icon-size) * 0.65);
		font-weight: 900;
		color: rgba(226, 232, 240, 0.9);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
		pointer-events: none;
	}

	.reward-preview__text {
		font-size: inherit;
		color: inherit;
		line-height: inherit;
		overflow: hidden;
		white-space: normal;
		overflow-wrap: anywhere;
		display: block;
		min-width: 0;
	}

	.reward-preview__row.is-text {
		display: block;
		box-sizing: border-box;
		overflow: hidden;
		font-size: 0.72rem;
		color: rgba(226, 232, 240, 0.85);
		line-height: 1.05;
		text-align: left;
	}

	.location-name {
		font-family: Opsilon, ui-serif, system-ui, -apple-system, Segoe UI, sans-serif;
		font-weight: 700;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sidebar {
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		overflow: auto;
	}

	.section {
		border: 1px solid rgba(148, 163, 184, 0.12);
		border-radius: 12px;
		padding: 0.75rem;
		background: rgba(2, 6, 23, 0.22);
	}

	.section h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		color: rgba(226, 232, 240, 0.95);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.75rem;
		color: rgba(148, 163, 184, 0.9);
	}

	input,
	select {
		background: rgba(15, 23, 42, 0.75);
		border: 1px solid rgba(148, 163, 184, 0.25);
		border-radius: 10px;
		padding: 0.45rem 0.55rem;
		color: rgba(226, 232, 240, 0.95);
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.btn {
		background: rgba(56, 189, 248, 0.22);
		border: 1px solid rgba(56, 189, 248, 0.35);
		color: rgba(240, 249, 255, 0.95);
		padding: 0.55rem 0.75rem;
		border-radius: 10px;
		cursor: pointer;
		font-size: 0.85rem;
	}

	.btn--ghost {
		background: rgba(148, 163, 184, 0.12);
		border-color: rgba(148, 163, 184, 0.18);
		color: rgba(226, 232, 240, 0.9);
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
