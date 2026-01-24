<script lang="ts">
	import { onMount } from 'svelte';
	import { rarityColors, type Rarity, type RarityColors } from '$lib/stores/rarityColors';
	import { eventCardBackground } from '$lib/stores/eventCardBackground';
	import {
		defaultEventCardBackgroundSettings,
		type EventCardBackgroundSettings
	} from '$lib/settings/eventCardBackground';
	import { EventCardPreview, type Event } from '$lib/components/abyss-deck';
	import { ImageUploader } from '$lib/components/shared';

	let colors: RarityColors = {
		Rare: '#60a5fa',
		Epic: '#a78bfa',
		Legendary: '#fbbf24'
	};

	let previewRarity: Rarity = 'Rare';

	const rarities: Rarity[] = ['Rare', 'Epic', 'Legendary'];

	let eventBg: EventCardBackgroundSettings = defaultEventCardBackgroundSettings;
	let eventBgStoragePath: string | null = null;
	let eventBgUrl = '';

	const sampleEvent: Event = {
		id: 'settings-preview',
		name: 'settings_preview',
		card_kind: 'event',
		stage: 'stage_1',
		title: 'Veil of Shadows',
		description:
			'Darkness descends as the boundary between realms weakens. Hidden truths emerge from the depths.',
		stage_completion: null,
		image_path: null,
		card_image_path: null,
		reward_rows: [],
		order_num: 7,
		created_at: null,
		updated_at: null,
		data: {},
		game_location_id: null,
		traveler_id: null,
		art_url: null
	};

	onMount(() => {
		const unsubscribe = rarityColors.subscribe((value) => {
			colors = { ...value };
		});

		const unsubscribeBg = eventCardBackground.subscribe((value) => {
			eventBg = value;
			eventBgStoragePath = value.image.source === 'storage' ? value.image.path : null;
			eventBgUrl = value.image.source === 'url' ? value.image.url ?? '' : '';
		});

		return () => {
			unsubscribe();
			unsubscribeBg();
		};
	});

	function updateColor(rarity: Rarity, color: string) {
		colors = { ...colors, [rarity]: color };
		rarityColors.set(colors);
	}

	function resetColors() {
		rarityColors.reset();
		colors = {
			Rare: '#60a5fa',
			Epic: '#a78bfa',
			Legendary: '#fbbf24'
		};
	}

function hexToRgba(hex: string, alpha = 0.25) {
	const sanitized = /^#([A-Fa-f0-9]{6})$/.test(hex) ? hex : '#60a5fa';
	const r = parseInt(sanitized.slice(1, 3), 16);
	const g = parseInt(sanitized.slice(3, 5), 16);
	const b = parseInt(sanitized.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getRarityColor(rarity: Rarity) {
	return colors[rarity] || '#60a5fa';
}

$: previewColor = getRarityColor(previewRarity);
$: previewGlow = hexToRgba(previewColor, 0.25);
$: previewBackground = hexToRgba(previewColor, 0.15);

	function setEventBgMode(mode: EventCardBackgroundSettings['mode']) {
		eventCardBackground.update((current) => ({ ...current, mode }));
	}

	function updateEventBgGradient(patch: Partial<EventCardBackgroundSettings['gradient']>) {
		eventCardBackground.update((current) => ({
			...current,
			gradient: { ...current.gradient, ...patch }
		}));
	}

	function setEventBgUrl(url: string) {
		eventCardBackground.update((current) => ({
			...current,
			mode: 'image',
			image: {
				...current.image,
				source: 'url',
				url,
				path: null,
				version: Date.now()
			}
		}));
	}

	function handleEventBgUpload(path: string) {
		eventCardBackground.update((current) => ({
			...current,
			mode: 'image',
			image: {
				...current.image,
				source: 'storage',
				path,
				url: null,
				version: Date.now()
			}
		}));
	}

	function handleEventBgRemove() {
		eventCardBackground.update((current) => ({
			...current,
			image: {
				...current.image,
				path: null,
				url: null,
				version: Date.now()
			}
		}));
	}

	function resetEventBg() {
		eventCardBackground.reset();
	}
</script>

<section class="page">
	<header class="page__header">
		<div>
			<h1>Settings</h1>
			<p>Customize card appearance</p>
		</div>
	</header>

	<div class="settings-content">
		<section class="settings-section">
			<h2>Rarity Colors</h2>
			<p class="section-description">
				Choose colors for each rarity tier. Cards will use these colors for borders and accents.
			</p>

			<div class="color-controls">
				{#each rarities as rarity}
					<div class="color-control">
						<label>
							<span class="color-label">{rarity}</span>
							<div class="color-input-wrapper">
								<input
									type="color"
									value={colors[rarity]}
									oninput={(e) => updateColor(rarity, e.currentTarget.value)}
									class="color-input"
								/>
								<input
									type="text"
									value={colors[rarity]}
									oninput={(e) => updateColor(rarity, e.currentTarget.value)}
									class="color-text-input"
									pattern="#[0-9A-Fa-f]{6}"
									placeholder="#000000"
								/>
							</div>
						</label>
					</div>
				{/each}
			</div>

			<div class="settings-actions">
				<button class="btn" onclick={resetColors}>Reset to Defaults</button>
			</div>
		</section>

		<section class="settings-section">
			<h2>Event Card Background</h2>
			<p class="section-description">
				Set the single shared background used by all Event cards (preview + PNG export).
			</p>

			<div class="event-bg-controls">
				<div class="event-bg-mode">
					<label class="mode-option">
						<input
							type="radio"
							name="event-bg-mode"
							checked={eventBg.mode === 'gradient'}
							onchange={() => setEventBgMode('gradient')}
						/>
						<span>Gradient</span>
					</label>
					<label class="mode-option">
						<input
							type="radio"
							name="event-bg-mode"
							checked={eventBg.mode === 'image'}
							onchange={() => setEventBgMode('image')}
						/>
						<span>Image</span>
					</label>
				</div>

				{#if eventBg.mode === 'gradient'}
					<div class="event-bg-gradient">
						<div class="color-control">
							<label>
								<span class="color-label">Accent A</span>
								<div class="color-input-wrapper">
									<input
										type="color"
										value={eventBg.gradient.accentAHex}
										oninput={(e) => updateEventBgGradient({ accentAHex: e.currentTarget.value })}
										class="color-input"
									/>
									<input
										type="text"
										value={eventBg.gradient.accentAHex}
										oninput={(e) => updateEventBgGradient({ accentAHex: e.currentTarget.value })}
										class="color-text-input"
										pattern="#[0-9A-Fa-f]{6}"
									/>
								</div>
							</label>
							<label class="alpha-row">
								<span class="alpha-label">Opacity</span>
								<input
									type="range"
									min="0"
									max="100"
									step="1"
									value={Math.round(eventBg.gradient.accentAAlpha * 100)}
									oninput={(e) =>
										updateEventBgGradient({ accentAAlpha: Number(e.currentTarget.value) / 100 })
									}
								/>
								<span class="alpha-value">{Math.round(eventBg.gradient.accentAAlpha * 100)}%</span>
							</label>
						</div>

						<div class="color-control">
							<label>
								<span class="color-label">Accent B</span>
								<div class="color-input-wrapper">
									<input
										type="color"
										value={eventBg.gradient.accentBHex}
										oninput={(e) => updateEventBgGradient({ accentBHex: e.currentTarget.value })}
										class="color-input"
									/>
									<input
										type="text"
										value={eventBg.gradient.accentBHex}
										oninput={(e) => updateEventBgGradient({ accentBHex: e.currentTarget.value })}
										class="color-text-input"
										pattern="#[0-9A-Fa-f]{6}"
									/>
								</div>
							</label>
							<label class="alpha-row">
								<span class="alpha-label">Opacity</span>
								<input
									type="range"
									min="0"
									max="100"
									step="1"
									value={Math.round(eventBg.gradient.accentBAlpha * 100)}
									oninput={(e) =>
										updateEventBgGradient({ accentBAlpha: Number(e.currentTarget.value) / 100 })
									}
								/>
								<span class="alpha-value">{Math.round(eventBg.gradient.accentBAlpha * 100)}%</span>
							</label>
						</div>
					</div>
				{:else}
					<div class="event-bg-image-grid">
						<div>
							<p class="small-label">Upload (Supabase storage)</p>
							<ImageUploader
								bind:value={eventBgStoragePath}
								folder="ui/event-card-background"
								aspectRatio="600 / 437"
								cropTransparent={false}
								onupload={handleEventBgUpload}
								onremove={handleEventBgRemove}
							/>
						</div>

						<div>
							<p class="small-label">Or use a direct URL</p>
							<input
								class="text-input"
								type="text"
								placeholder="https://.../background.png"
								value={eventBgUrl}
								oninput={(e) => setEventBgUrl(e.currentTarget.value)}
							/>
							<p class="help-text">For consistent exports, prefer the upload option.</p>
						</div>
					</div>
				{/if}

				<div class="settings-actions">
					<button class="btn" onclick={resetEventBg}>Reset to Defaults</button>
				</div>

				<div class="event-card-preview-wrapper">
					<EventCardPreview event={sampleEvent} />
				</div>
			</div>
		</section>

		<section class="settings-section">
			<h2>Preview</h2>
			<p class="section-description">See how cards look with your color choices.</p>

			<div class="preview-controls">
				<label>
					Preview Rarity:
					<select bind:value={previewRarity}>
						<option value="Rare">Rare</option>
						<option value="Epic">Epic</option>
						<option value="Legendary">Legendary</option>
					</select>
				</label>
			</div>

			<div class="preview-grid">
				<article
					class="card artifact-card preview-card"
					style:--rarity-color={previewColor}
					style:--rarity-border={previewColor}
					style:--rarity-glow={previewGlow}
					style:--rarity-background={previewBackground}
				>
					<header>
						<div>
							<h2>Sample Artifact</h2>
							<small>Origin Name</small>
						</div>
					</header>
					<div class="artifact-card__body">
						<p class="benefit">
							This is a preview of how an artifact card will look with the {previewRarity} rarity color
							scheme. The border and accents will use your selected color.
						</p>
						<div class="recipe-icons">
							<div class="rune-icon-container" title="Sample Rune">
								<div class="rune-icon-placeholder">🔮</div>
							</div>
							<div class="rune-icon-container" title="Sample Rune">
								<div class="rune-icon-placeholder">🔮</div>
							</div>
						</div>
					</div>
				</article>
			</div>
		</section>
	</div>
</section>

<style>
	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.settings-section {
		background: rgba(15, 23, 42, 0.65);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 12px;
		padding: 1.5rem;
	}

	.settings-section h2 {
		margin: 0 0 0.5rem 0;
		color: #f8fafc;
	}

	.section-description {
		margin: 0 0 1.5rem 0;
		color: #cbd5f5;
		font-size: 0.9rem;
	}

	.color-controls {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.color-control {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.color-label {
		font-weight: 600;
		color: #f8fafc;
		font-size: 0.95rem;
	}

	.color-input-wrapper {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}

	.color-input {
		width: 60px;
		height: 40px;
		padding: 0;
		border: 2px solid rgba(148, 163, 184, 0.3);
		border-radius: 8px;
		cursor: pointer;
		background: none;
	}

	.color-text-input {
		flex: 1;
		font-family: 'JetBrains Mono', monospace;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.3);
		padding: 0.5rem 0.75rem;
		border-radius: 6px;
		color: #f8fafc;
	}

	.settings-actions {
		display: flex;
		gap: 0.75rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(148, 163, 184, 0.18);
	}

	.event-bg-controls {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.event-bg-mode {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.mode-option {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		color: #e2e8f0;
		font-weight: 600;
	}

	.event-bg-gradient {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1.25rem;
	}

	.alpha-row {
		display: grid;
		grid-template-columns: 70px 1fr 52px;
		gap: 0.75rem;
		align-items: center;
		margin-top: 0.5rem;
		color: #cbd5f5;
	}

	.alpha-label {
		font-size: 0.85rem;
	}

	.alpha-value {
		text-align: right;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85rem;
		color: #e2e8f0;
	}

	.event-bg-image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.25rem;
		align-items: start;
	}

	.small-label {
		margin: 0 0 0.5rem 0;
		font-size: 0.85rem;
		color: #cbd5f5;
		font-weight: 600;
	}

	.text-input {
		width: 100%;
		font-family: 'JetBrains Mono', monospace;
		background: rgba(15, 23, 42, 0.8);
		border: 1px solid rgba(148, 163, 184, 0.3);
		padding: 0.6rem 0.75rem;
		border-radius: 6px;
		color: #f8fafc;
	}

	.help-text {
		margin: 0.5rem 0 0 0;
		font-size: 0.85rem;
		color: #94a3b8;
	}

	.event-card-preview-wrapper {
		display: flex;
		justify-content: center;
		padding-top: 0.5rem;
	}

	.preview-controls {
		margin-bottom: 1.5rem;
	}

	.preview-controls label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: #cbd5f5;
	}

	.preview-controls select {
		padding: 0.4rem 0.7rem;
	}

	.preview-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1rem;
	}

	.preview-card {
		border: 1px solid rgba(148, 163, 184, 0.18) !important;
		border-left: 4px solid var(--rarity-color, #60a5fa) !important;
		box-shadow: 0 0 20px var(--rarity-glow, rgba(96, 165, 250, 0.25)) !important;
		transition: box-shadow 0.3s ease, border-left-color 0.3s ease;
	}

	.preview-card:hover {
		box-shadow: 0 0 30px var(--rarity-glow, rgba(96, 165, 250, 0.4)) !important;
	}

	.rune-icon-placeholder {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		background: rgba(148, 163, 184, 0.1);
		border-radius: 6px;
	}

	.artifact-card__body {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		margin-top: 0.5rem;
	}

	.benefit {
		margin: 0;
		color: #cbd5f5;
		white-space: pre-wrap;
		flex: 1;
	}

	.recipe-icons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-top: auto;
		justify-content: flex-end;
		align-items: center;
		padding-top: 0.5rem;
	}

	.rune-icon-container {
		position: relative;
		display: inline-block;
	}
</style>
