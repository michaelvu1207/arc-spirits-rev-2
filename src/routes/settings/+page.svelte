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
	import { supabase } from '$lib/api/supabaseClient';

	// --- TTS asset compression ---
	// Discovery (which paths to compress) happens in the browser to keep the
	// edge function lean — earlier the function did discovery itself and OOMed
	// on cold start (export JSON parse + supabase-js + imagescript WASM all
	// resident at once → WORKER_RESOURCE_LIMIT). The function now only accepts
	// an explicit `paths` array; we chunk the work into small requests.
	type CompressBatchResponse = {
		total: number;
		processed: number;
		remaining: number;
		errors: Array<{ source_url: string; source_path: string; error: string }>;
		byCategory: Record<string, { processed: number; bytes: number }>;
		durationMs: number;
	};
	const COMPRESS_CHUNK_SIZE = 10;
	const SOURCE_BUCKET = 'game_assets';
	const PROJECT_REF = 'gvxfokbptelmvvlxbigh';
	const SUPABASE_HOST = `https://${PROJECT_REF}.supabase.co`;
	let compressBusy = $state(false);
	let compressLog = $state<string[]>([]);
	let compressProgress = $state<{ done: number; total: number; errors: number } | null>(null);

	function logCompress(msg: string) {
		const stamp = new Date().toLocaleTimeString();
		compressLog = [...compressLog, `[${stamp}] ${msg}`].slice(-100);
	}

	const URL_RE = /https?:\/\/[^\s"'<>)\\]+/g;
	const SOURCE_URL_RE = new RegExp(
		`https?://[a-z0-9-]+\\.supabase\\.co/storage/v1/(?:object|render/image)/public/${SOURCE_BUCKET}/([^?\\s"'<>]+)`,
		'i'
	);

	function* walkStrings(o: unknown): Generator<string> {
		if (o == null) return;
		if (typeof o === 'string') {
			yield o;
			return;
		}
		if (Array.isArray(o)) {
			for (const v of o) yield* walkStrings(v);
			return;
		}
		if (typeof o === 'object') {
			for (const v of Object.values(o as Record<string, unknown>)) yield* walkStrings(v);
		}
	}

	async function discoverAllSourcePaths(): Promise<string[]> {
		const url = `${SUPABASE_HOST}/functions/v1/export-all-tts-json`;
		const res = await fetch(url, {
			headers: {
				apikey: import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY ?? ''
			}
		});
		if (!res.ok) throw new Error(`export-all-tts-json: HTTP ${res.status}`);
		const data = await res.json();
		const paths = new Set<string>();
		for (const s of walkStrings(data)) {
			const matches = s.match(URL_RE);
			if (!matches) continue;
			for (const u of matches) {
				const cleaned = u.replace(/[",\\;]+$/, '');
				const m = cleaned.match(SOURCE_URL_RE);
				if (m) paths.add(decodeURIComponent(m[1]).split('?')[0]);
			}
		}
		return [...paths];
	}

	async function fetchExistingPaths(): Promise<Set<string>> {
		const out = new Set<string>();
		const PAGE = 1000;
		let from = 0;
		while (true) {
			const { data, error } = await supabase
				.from('asset_compressed')
				.select('source_path')
				.range(from, from + PAGE - 1);
			if (error) throw new Error(`asset_compressed select: ${error.message}`);
			for (const r of data ?? []) {
				if (r.source_path) out.add(r.source_path);
			}
			if (!data || data.length < PAGE) break;
			from += PAGE;
		}
		return out;
	}

	async function callCompress(paths: string[]): Promise<CompressBatchResponse> {
		const { data, error } = await supabase.functions.invoke<CompressBatchResponse>(
			'compress-pending-assets',
			{ body: { paths } }
		);
		if (error) throw new Error(error.message);
		if (!data) throw new Error('No response from compress-pending-assets');
		return data;
	}

	// Asks the edge function for paths whose source bytes have been updated
	// since the last compression (drift detection). The button counts these
	// as pending so re-uploads (e.g. a new spirit world image at the same
	// storage path) get picked up automatically.
	async function fetchStalePaths(): Promise<string[]> {
		const { data, error } = await supabase.functions.invoke<{ stale: string[] }>(
			'compress-pending-assets',
			{ body: { mode: 'list_stale' } }
		);
		if (error) throw new Error(`list_stale: ${error.message}`);
		return data?.stale ?? [];
	}

	async function runCompression(force = false) {
		if (compressBusy) return;
		compressBusy = true;
		compressLog = [];
		compressProgress = null;
		logCompress(force ? 'Force-recompressing all assets…' : 'Compressing pending assets…');

		try {
			const allPaths = await discoverAllSourcePaths();
			logCompress(`Discovered ${allPaths.length} source assets in game_assets/`);

			let pending: string[];
			if (force) {
				pending = allPaths;
			} else {
				const [existing, stale] = await Promise.all([
					fetchExistingPaths(),
					fetchStalePaths()
				]);
				const newPaths = allPaths.filter((p) => !existing.has(p));
				const merged = new Set([...newPaths, ...stale]);
				pending = [...merged];
				logCompress(
					`Already compressed: ${existing.size}, new: ${newPaths.length}, stale (re-uploaded): ${stale.length}, total pending: ${pending.length}`
				);
			}

			if (pending.length === 0) {
				logCompress('Nothing to do — everything is up to date.');
				compressProgress = { done: 0, total: 0, errors: 0 };
				return;
			}

			compressProgress = { done: 0, total: pending.length, errors: 0 };

			let done = 0;
			let errors = 0;
			for (let i = 0; i < pending.length; i += COMPRESS_CHUNK_SIZE) {
				const chunk = pending.slice(i, i + COMPRESS_CHUNK_SIZE);
				const res = await callCompress(chunk);
				done += res.processed;
				errors += res.errors.length;
				compressProgress = { done, total: pending.length, errors };
				logCompress(
					`chunk ${Math.floor(i / COMPRESS_CHUNK_SIZE) + 1}: ${res.processed}/${chunk.length} ok, ${res.errors.length} err, ${res.durationMs} ms`
				);
				for (const err of res.errors.slice(0, 3)) {
					logCompress(`  ✗ ${err.source_path}: ${err.error}`);
				}
			}
			logCompress(`Done. Processed ${done}/${pending.length}, errors ${errors}.`);
		} catch (e) {
			logCompress(`✗ ${(e as Error).message}`);
		} finally {
			compressBusy = false;
		}
	}

	function confirmForceRecompress() {
		if (
			confirm(
				'Force-recompress every asset (~430 files)?\n\nThis re-encodes everything from source, takes a few minutes, and overwrites the compressed bucket. Use only when presets have changed.'
			)
		) {
			runCompression(true);
		}
	}

	let colors: RarityColors = {
		Rare: '#60a5fa',
		Epic: '#a78bfa',
		Legendary: '#fbbf24'
	};

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
		image_path: null,
		card_image_path: null,
		reward_rows: [],
		order_num: 7,
		created_at: null,
			updated_at: null,
			data: {},
			game_location_id: null,
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
			<h2>TTS Asset Compression</h2>
			<p class="section-description">
				Re-encodes assets from <code>game_assets</code> into <code>game_assets_compressed</code>
				with per-category presets (JPEG for cards, PNG with alpha for tokens). The TTS mod
				serves the compressed mirror when its <code>useCompressedAssets</code> flag is on
				(~793 MB → ~31 MB total payload). Run this after generating new art so the new
				assets are ready for TTS.
			</p>

			<div class="settings-actions">
				<button class="btn" onclick={() => runCompression(false)} disabled={compressBusy}>
					{compressBusy ? 'Working…' : 'Compress new assets'}
				</button>
				<button
					class="btn btn-danger"
					onclick={confirmForceRecompress}
					disabled={compressBusy}
					title="Re-encodes every asset from source, even ones already in the compressed bucket. Use after changing presets."
				>
					Force recompress all
				</button>
			</div>

			{#if compressProgress}
				<div class="compress-stats">
					<span><strong>Progress:</strong> {compressProgress.done} / {compressProgress.total}</span>
					<span><strong>Errors:</strong> {compressProgress.errors}</span>
					{#if compressProgress.total > 0}
						<span><strong>{Math.round((compressProgress.done / compressProgress.total) * 100)}%</strong></span>
					{/if}
				</div>
			{/if}

			{#if compressLog.length > 0}
				<pre class="compress-log">{compressLog.join('\n')}</pre>
			{/if}
		</section>

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
		flex-wrap: wrap;
	}

	.btn-danger {
		background: rgba(220, 38, 38, 0.15);
		border-color: rgba(248, 113, 113, 0.4);
		color: #fca5a5;
	}
	.btn-danger:hover {
		background: rgba(220, 38, 38, 0.25);
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.compress-stats {
		display: flex;
		gap: 1.25rem;
		flex-wrap: wrap;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		background: rgba(15, 23, 42, 0.6);
		border: 1px solid rgba(148, 163, 184, 0.2);
		border-radius: 6px;
		color: #cbd5f5;
		font-size: 0.9rem;
	}

	.compress-log {
		margin-top: 1rem;
		max-height: 220px;
		overflow-y: auto;
		padding: 0.75rem 1rem;
		background: rgba(2, 6, 23, 0.85);
		border: 1px solid rgba(148, 163, 184, 0.18);
		border-radius: 6px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.78rem;
		color: #cbd5f5;
		white-space: pre-wrap;
	}

	code {
		background: rgba(15, 23, 42, 0.6);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.85em;
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
</style>
