	<script lang="ts">
		import { onMount } from 'svelte';
		import { supabase } from '$lib/api/supabaseClient';
	import type {
		OriginRow,
		MatItemRow,
		HexSpiritRow,
		GameLocationRewardRow,
		GameLocationRowCompositionRow,
		RewardRowAssignment
	} from '$lib/types/gameData';
	import { configToRewardRow } from '$lib/types/gameData';
	import { publicAssetUrl } from '$lib/utils';
	import { generateRuneIcon } from '$lib/utils/runeIconGenerator';
	import { generateDiceSide } from '$lib/generators/dice';
	import { renderLocationRewardRowPngBlob } from '$lib/generators/game-locations/locationCardIconPlacer';
	import { fetchDiceRecords, type CustomDiceWithSides } from '$lib/features/dice/dice';
	import { fetchOriginRecords } from '$lib/features/origins/origins';
	import { fetchHexSpiritRecords } from '$lib/features/hex-spirits/hexSpirits';
	import { rewardIconTokensHaveAnyIcons } from '$lib/utils/rewardIconTokens';
	import { Button } from '$lib/components/ui';
	import { PageLayout, type Tab } from '$lib/components/layout';
	import { AssetsListView, AssetsGridView, type AssetImage } from '$lib/components/assets';
	import JSZip from 'jszip';

		let origins: OriginRow[] = [];
		let mats: MatItemRow[] = [];
		let hexSpirits: HexSpiritRow[] = [];
		let dice: CustomDiceWithSides[] = [];
		let loading = $state(true);
		let error: string | null = $state(null);
	let exporting = $state(false);

	const gameAssetsStorage = supabase.storage.from('game_assets');

	let originImages: AssetImage[] = $state([]);
	let runeImages: AssetImage[] = $state([]);
	let hexSpiritImages: AssetImage[] = $state([]);
	let diceFaceImages: AssetImage[] = $state([]);
	let miscAssetImages: AssetImage[] = $state([]);
	let runeBackgroundUrl: string | null = null;

	// Tab state
	const tabs: Tab[] = [
		{ id: 'list', label: 'Data: List', icon: '📋' },
		{ id: 'grid', label: 'Grid View', icon: '🖼️' }
	];
		let activeTab = $state('list');

		onMount(async () => {
			await Promise.all([loadOrigins(), loadMats(), loadHexSpirits(), loadDice(), loadRuneBackground()]);
			await loadAssets();
		});

	async function loadOrigins() {
		try {
			const records = await fetchOriginRecords();
			origins = records.filter((origin) => origin.is_enabled !== false);
		} catch (fetchError: unknown) {
			error = fetchError instanceof Error ? fetchError.message : String(fetchError);
		}
		}

		async function loadMats() {
			const { data, error: fetchError } = await supabase
				.from('mat_items')
				.select('*')
			.order('name', { ascending: true });
		if (fetchError) {
			error = fetchError.message;
			return;
		}
		mats = data ?? [];
	}

	async function loadHexSpirits() {
		try {
			const records = await fetchHexSpiritRecords();
			hexSpirits = records;
		} catch (fetchError: unknown) {
			error = fetchError instanceof Error ? fetchError.message : String(fetchError);
		}
	}

	async function loadDice() {
		try {
			dice = await fetchDiceRecords();
		} catch (err) {
			console.warn('Failed to load dice:', err);
			dice = [];
		}
		}


		function getOriginIconUrl(icon: string | null | undefined, updatedAt?: string | null): string | null {
			if (!icon) return null;
			// Only treat as a storage path if it looks like one (avoid legacy emoji stored in icon_png).
			if (!icon.includes('/')) return null;
			const fullPath = icon.startsWith('origin_icons/') ? icon : `origin_icons/${icon}`;
			return publicAssetUrl(fullPath, { updatedAt: updatedAt ?? Date.now() });
		}

	function getHexSpiritImageUrl(path: string | null | undefined): string | null {
		if (!path) return null;
		const fullPath = path.startsWith('hex_spirits/') ? path : `hex_spirits/${path}`;
		const { data } = gameAssetsStorage.getPublicUrl(fullPath);
		return data?.publicUrl ?? null;
	}

	function sanitizeFileName(name: string): string {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50);
	}

	function hasRewardContent(row: GameLocationRewardRow | null | undefined): boolean {
		if (!row) return false;
		if (row.type === 'text') return row.text.trim().length > 0;
		if (row.type === 'trade') {
			return (
				rewardIconTokensHaveAnyIcons(row.cost_icon_ids ?? []) ||
				rewardIconTokensHaveAnyIcons(row.gain_icon_ids ?? [])
			);
		}
		return rewardIconTokensHaveAnyIcons(row.gain_icon_ids ?? []);
	}

	async function loadRuneBackground() {
		try {
			const { data } = gameAssetsStorage.getPublicUrl('rune_backgrounds/background.png');
			if (data?.publicUrl) {
				const response = await fetch(data.publicUrl, { method: 'HEAD' });
				if (response.ok) {
					runeBackgroundUrl = data.publicUrl;
				}
			}
		} catch (err) {
			console.warn('Failed to load rune background:', err);
		}
	}

	async function loadAssets() {
		loading = true;
		originImages = [];
		runeImages = [];
		hexSpiritImages = [];
		diceFaceImages = [];
		miscAssetImages = [];

			// Load origin icons
			for (const origin of origins) {
				const iconUrl = getOriginIconUrl(origin.icon_png, origin.updated_at);
				if (iconUrl) {
					originImages.push({
						name: origin.name,
						url: iconUrl,
					type: 'origin',
					filename: `origins/${sanitizeFileName(origin.name)}_icon.png`
				});
			}
		}

			// Generate mat icons (origin runes + relics)
			for (const mat of mats) {
				const storedIconUrl = publicAssetUrl(mat.icon_path, { updatedAt: mat.updated_at ?? Date.now() });
				if (storedIconUrl) {
					runeImages.push({
						name: mat.name,
						url: storedIconUrl,
						type: 'rune',
						filename: `runes/${sanitizeFileName(mat.name)}_icon.png`
					});
					continue;
				}

					const backgroundUrl =
						publicAssetUrl(mat.icon_background_path, { updatedAt: mat.updated_at ?? Date.now() }) ??
						runeBackgroundUrl;
					const backgroundColor = null;
					const outerRingColor = null;

				let originIconUrl: string | null = null;
				let originIconEmoji: string | null = null;
				if (mat.origin_id) {
					const origin = origins.find((o) => o.id === mat.origin_id);
					if (!origin) continue;
					originIconUrl = getOriginIconUrl(origin.icon_png, origin.updated_at);
					originIconEmoji = originIconUrl ? null : (origin.icon_emoji || origin.icon_png || null);
				} else if (mat.emoji) {
					// Relic: rendered from its emoji.
					originIconEmoji = mat.emoji;
				} else {
					continue;
				}

				try {
						const matIconUrl = await generateRuneIcon({
							originIconUrl,
							originIconEmoji,
							backgroundUrl,
							backgroundColor,
							outerRingColor,
							size: 800
						});
					runeImages.push({
						name: mat.name,
					url: matIconUrl,
					type: 'rune',
					filename: `runes/${sanitizeFileName(mat.name)}_icon.png`
				});
			} catch (err) {
				console.warn(`Failed to generate icon for mat ${mat.name}:`, err);
			}
		}

		// Load hex spirit images
		for (const spirit of hexSpirits) {
			const gamePrintUrl = getHexSpiritImageUrl(spirit.game_print_image_path);
			if (gamePrintUrl) {
				hexSpiritImages.push({
					name: `${spirit.name} (Game Print)`,
					url: gamePrintUrl,
					type: 'hex-spirit',
					filename: `hex_spirits/${sanitizeFileName(spirit.name)}_game_print.png`
				});
			}

			const artRawUrl = getHexSpiritImageUrl(spirit.art_raw_image_path);
			if (artRawUrl) {
				hexSpiritImages.push({
					name: `${spirit.name} (Art Raw)`,
					url: artRawUrl,
					type: 'hex-spirit',
					filename: `hex_spirits/${sanitizeFileName(spirit.name)}_art_raw.png`
				});
			}
		}

		// Generate dice face images
		for (const diceItem of dice) {
			if (!diceItem.background_image_path) continue;

			try {
				const path = diceItem.background_image_path.startsWith('dice_backgrounds/')
					? diceItem.background_image_path
					: `dice_backgrounds/${diceItem.background_image_path}`;
				const { data } = gameAssetsStorage.getPublicUrl(path);
				if (!data?.publicUrl) continue;

				for (const side of diceItem.dice_sides) {
					const text =
						diceItem.dice_type === 'attack'
							? side.reward_value
							: side.reward_value || String(side.side_number);

					try {
						const diceFaceUrl = await generateDiceSide({
							backgroundUrl: data.publicUrl,
							text: text,
							size: 800
						});
						diceFaceImages.push({
							name: `${diceItem.name} - Side ${side.side_number}`,
							url: diceFaceUrl,
							type: 'dice-face',
							filename: `dice_faces/${sanitizeFileName(diceItem.name)}_side_${side.side_number}.png`
						});
					} catch (err) {
						console.warn(
							`Failed to generate dice face for ${diceItem.name} side ${side.side_number}:`,
							err
						);
					}
				}
			} catch (err) {
				console.warn(`Failed to load background for dice ${diceItem.name}:`, err);
			}
		}

		loading = false;
	}


	async function fetchImageAsBlob(url: string): Promise<Blob | null> {
		try {
			// Handle data URLs (for rune icons)
			if (url.startsWith('data:')) {
				const response = await fetch(url);
				return await response.blob();
			}
			// Handle regular URLs
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to fetch image: ${response.statusText}`);
			}
			return await response.blob();
		} catch (err) {
			console.error('Error fetching image:', err);
			return null;
		}
	}

	async function addPaddingToImage(blob: Blob, padding: number = 200): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					return reject(new Error('Could not get canvas context'));
				}

				// New canvas size: original size + padding on all sides
				canvas.width = img.width + padding * 2;
				canvas.height = img.height + padding * 2;

				// Fill with transparent background (or white if you prefer)
				ctx.fillStyle = 'transparent';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				// Draw the original image centered with padding
				ctx.drawImage(img, padding, padding, img.width, img.height);

				// Convert to blob
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to create blob from canvas'));
					}
				}, blob.type || 'image/png');
			};
			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = URL.createObjectURL(blob);
		});
	}

	async function resizeAndAddPadding(blob: Blob, targetSize: number = 800, padding: number = 175): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					return reject(new Error('Could not get canvas context'));
				}

				// New canvas size: target size + padding on all sides
				canvas.width = targetSize + padding * 2;
				canvas.height = targetSize + padding * 2;

				// Fill with transparent background
				ctx.fillStyle = 'transparent';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				// Draw the image resized to exactly targetSize x targetSize (may stretch if not square)
				ctx.drawImage(img, padding, padding, targetSize, targetSize);

				// Convert to blob
				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Failed to create blob from canvas'));
					}
				}, blob.type || 'image/png');
			};
			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = URL.createObjectURL(blob);
		});
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
	}

	async function exportAssets() {
		if (originImages.length === 0 && runeImages.length === 0 && hexSpiritImages.length === 0 && diceFaceImages.length === 0 && miscAssetImages.length === 0) {
			alert('No assets to export.');
			return;
		}

		exporting = true;
		try {
			const zip = new JSZip();

			// Add origin icons
			if (originImages.length > 0) {
				const originsFolder = zip.folder('origins');
				for (const asset of originImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						originsFolder?.file(
							`${sanitizeFileName(asset.name)}_icon.png`,
							paddedBlob
						);
					}
				}
			}

			// Add rune icons
			if (runeImages.length > 0) {
				const runesFolder = zip.folder('runes');
				for (const asset of runeImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						runesFolder?.file(
							`${sanitizeFileName(asset.name)}_icon.png`,
							paddedBlob
						);
					}
				}
			}

			// Add hex spirit images
			if (hexSpiritImages.length > 0) {
				const hexSpiritsFolder = zip.folder('hex_spirits');
				for (const asset of hexSpiritImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						hexSpiritsFolder?.file(
							`${sanitizeFileName(asset.name)}.png`,
							paddedBlob
						);
					}
				}
			}

			// Add dice face images
			if (diceFaceImages.length > 0) {
				const diceFacesFolder = zip.folder('dice_faces');
				for (const asset of diceFaceImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const paddedBlob = await addPaddingToImage(blob, 200);
						const filename = asset.filename.replace('dice_faces/', '');
						diceFacesFolder?.file(filename, paddedBlob);
					}
				}
			}

			// Add misc assets
			if (miscAssetImages.length > 0) {
				const miscFolder = zip.folder('misc_assets');
				for (const asset of miscAssetImages) {
					const blob = await fetchImageAsBlob(asset.url);
					if (blob) {
						const filename = asset.filename.replace('misc_assets/', '');
						miscFolder?.file(filename, blob);
					}
				}
			}

			// Add reward-row renders for TTS export. Reward rows come from the
			// normalized model (game_location_rows + reward_row_assignments) — the
			// single source of truth shared with the game.
			const [locationsRes, rowRecordsRes, assignmentsRes] = await Promise.all([
				supabase.from('game_locations').select('id, name').order('name', { ascending: true }),
				supabase.from('game_location_rows').select('id, name, type, config'),
				supabase.from('reward_row_assignments').select('location_id, row_id, row_index')
			]);
			if (locationsRes.error) throw locationsRes.error;
			if (rowRecordsRes.error) throw rowRecordsRes.error;
			if (assignmentsRes.error) throw assignmentsRes.error;

			const rowConfigById = new Map<string, GameLocationRowCompositionRow>(
				((rowRecordsRes.data as GameLocationRowCompositionRow[] | null) ?? []).map((r) => [r.id, r])
			);
			const assignmentsByLocation = new Map<string, RewardRowAssignment[]>();
			for (const a of (assignmentsRes.data as RewardRowAssignment[] | null) ?? []) {
				const list = assignmentsByLocation.get(a.location_id) ?? [];
				list.push(a);
				assignmentsByLocation.set(a.location_id, list);
			}
			const rewardRowsForLocation = (locationId: string): GameLocationRewardRow[] =>
				(assignmentsByLocation.get(locationId) ?? [])
					.slice()
					.sort((a, b) => a.row_index - b.row_index)
					.map((a) => {
						const row = rowConfigById.get(a.row_id);
						return row
							? configToRewardRow(row.type, row.config)
							: ({ type: 'gain', gain_icon_ids: [] } satisfies GameLocationRewardRow);
					});

			const rewardRowsFolder = zip.folder('tts')?.folder('reward_rows');
			for (const location of locationsRes.data ?? []) {
				const locationName = typeof location.name === 'string' ? location.name : 'location';
				const locationId = typeof location.id === 'string' ? location.id : 'unknown';
				const rows = rewardRowsForLocation(location.id);

				for (let i = 0; i < rows.length; i++) {
					const row = rows[i];
					if (!hasRewardContent(row)) continue;

					try {
						const rowBlob = await renderLocationRewardRowPngBlob(row);
						const typeTag = row.type === 'trade' ? 'trade' : row.type === 'text' ? 'text' : 'gain';
						rewardRowsFolder?.file(
							`${locationId}_${sanitizeFileName(locationName)}_row_${i + 1}_${typeTag}.png`,
							rowBlob
						);
					} catch (err) {
						console.warn(`Failed to render reward row ${locationId}#${i + 1}:`, err);
					}
				}
			}

			// Generate ZIP file
			const zipBlob = await zip.generateAsync({
				type: 'blob',
				compression: 'DEFLATE',
				compressionOptions: {
					level: 9
				}
			});

			// Download ZIP
			const timestamp = new Date().toISOString().split('T')[0];
			const filename = `arc-spirits-assets_${timestamp}.zip`;
			const url = URL.createObjectURL(zipBlob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Error exporting assets:', err);
			alert(`Failed to export assets: ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			exporting = false;
		}
	}
</script>

<PageLayout
	title="Assets"
	subtitle="View and export all game assets"
	{tabs}
	{activeTab}
	onTabChange={handleTabChange}
>
	{#snippet headerActions()}
		<Button variant="primary" onclick={exportAssets} disabled={exporting || loading}>
			{exporting ? 'Exporting...' : '📦 Export All as ZIP'}
		</Button>
	{/snippet}

	{#if loading}
		<div class="loading-state">Loading assets...</div>
	{:else if error}
		<div class="error-state">Error: {error}</div>
	{:else if activeTab === 'list'}
		<AssetsListView
			{originImages}
			{runeImages}
			{hexSpiritImages}
			{diceFaceImages}
			{miscAssetImages}
		/>
	{:else if activeTab === 'grid'}
		<AssetsGridView
			{originImages}
			{runeImages}
			{hexSpiritImages}
			{diceFaceImages}
			{miscAssetImages}
		/>
	{/if}
</PageLayout>

<style>
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
</style>
