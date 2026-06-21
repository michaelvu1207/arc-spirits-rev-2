import { supabase } from '$lib/api/supabaseClient';
import { loadOpsilonFont, loadImage } from '$lib/generators/shared/canvas';
import type { GameLocationRewardRow, GameLocationRow, RewardIconToken } from '$lib/types/gameData';
import {
	coerceLocationCardLayoutConfig,
	REWARD_ROW_BASE_ICON_SIZE
} from '$lib/generators/game-locations/locationCardLayoutConfig';
import { loadIconPool, getIconPoolUrl } from '$lib/utils/iconPool';
import { isRewardOrIconToken, rewardIconTokensHaveAnyIcons } from '$lib/utils/rewardIconTokens';
import { processAndUploadImage, publicAssetUrl } from '$lib/utils/storage';

type LocationForCardGen = Pick<
	GameLocationRow,
	'id' | 'name' | 'background_image_path' | 'image_with_icons_path' | 'updated_at'
>;

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

function buildTokenFragment(token: RewardIconToken): DocumentFragment {
	const frag = document.createDocumentFragment();

	if (typeof token === 'string') {
		const url = getIconPoolUrl(token);
		if (!url) return frag;

		const img = document.createElement('img');
		img.src = url;
		img.alt = 'Reward icon';
		img.draggable = false;
		frag.appendChild(img);
		return frag;
	}

	if (!isRewardOrIconToken(token)) return frag;
	const ids = (token.icon_ids ?? []).filter((id) => typeof id === 'string' && id.trim().length > 0);
	for (let i = 0; i < ids.length; i++) {
		const url = getIconPoolUrl(ids[i]!);
		if (url) {
			const img = document.createElement('img');
			img.src = url;
			img.alt = 'OR icon';
			img.draggable = false;
			frag.appendChild(img);
		}
		if (i < ids.length - 1) {
			const slash = document.createElement('span');
			slash.className = 'reward-preview__or-slash';
			slash.textContent = '/';
			frag.appendChild(slash);
		}
	}

	return frag;
}

function buildTokenList(tokens: RewardIconToken[]): HTMLDivElement {
	const icons = document.createElement('div');
	icons.className = 'reward-preview__icons';

	for (const token of tokens) {
		const icon = document.createElement('div');
		icon.className = 'reward-preview__icon';
		icon.appendChild(buildTokenFragment(token));
		icons.appendChild(icon);
	}

	return icons;
}

function buildRewardRowNode(
	row: GameLocationRewardRow,
	options?: {
		textBoxPx?: { w: number; h: number };
		textStyle?: { fontSizePx: number; lineHeightPx?: number; align: string; color: string };
	}
): HTMLDivElement {
	const wrap = document.createElement('div');
	wrap.className = 'placed__rewards';
	wrap.style.setProperty('--reward-icon-size', `${REWARD_ROW_BASE_ICON_SIZE}px`);
	wrap.style.setProperty('--reward-icon-gap', '10px');
	wrap.style.setProperty('--reward-row-gap', '12px');

	const rowEl = document.createElement('div');
	rowEl.className = 'reward-preview__row';
	wrap.appendChild(rowEl);

	if (row.type === 'trade') {
		rowEl.appendChild(buildTokenList(row.cost_icon_ids ?? []));

		const arrow = document.createElement('span');
		arrow.className = 'reward-preview__arrow';
		arrow.textContent = '→';
		rowEl.appendChild(arrow);

		rowEl.appendChild(buildTokenList(row.gain_icon_ids ?? []));
		return wrap;
	}

	if (row.type === 'gain') {
		rowEl.appendChild(buildTokenList(row.gain_icon_ids ?? []));
		return wrap;
	}

	rowEl.classList.add('is-text');
	if (options?.textBoxPx) {
		rowEl.style.width = `${Math.max(1, Math.round(options.textBoxPx.w))}px`;
		rowEl.style.height = `${Math.max(1, Math.round(options.textBoxPx.h))}px`;
	}
	if (options?.textStyle) {
		rowEl.style.fontSize = `${Math.max(1, Math.round(options.textStyle.fontSizePx))}px`;
		rowEl.style.textAlign = options.textStyle.align;
		rowEl.style.color = options.textStyle.color;
		rowEl.style.lineHeight =
			typeof options.textStyle.lineHeightPx === 'number' && Number.isFinite(options.textStyle.lineHeightPx)
				? `${Math.max(0, Math.round(options.textStyle.lineHeightPx))}px`
				: '1.05';
	}

	const text = document.createElement('div');
	text.className = 'reward-preview__text';
	text.textContent = row.text;
	rowEl.appendChild(text);
	return wrap;
}

async function waitForImages(container: HTMLElement): Promise<void> {
	const imgs = Array.from(container.querySelectorAll('img'));
	await Promise.all(
		imgs.map((img) =>
			img.complete
				? Promise.resolve()
				: new Promise<void>((resolve) => {
						img.addEventListener('load', () => resolve(), { once: true });
						img.addEventListener('error', () => resolve(), { once: true });
					})
		)
	);
}

async function loadConfig(configKey: string) {
	const { data, error } = await supabase
		.from('game_location_card_layout_configs')
		.select('config')
		.eq('key', configKey)
		.maybeSingle();
	if (error) throw error;
	return coerceLocationCardLayoutConfig(data?.config ?? null);
}

function getExportCss(): string {
	return `
.location-card-export {
	position: relative;
	font-family: Opsilon, ui-serif, system-ui, -apple-system, Segoe UI, sans-serif;
}

.location-card-export__bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	display: block;
	object-fit: cover;
	object-position: center;
	font-family: inherit;
}

.location-card-export .placed {
	position: absolute;
	transform-origin: center;
}

.location-card-export .placed__rewards {
	display: flex;
	flex-direction: column;
	gap: var(--reward-row-gap);
}

.location-card-export .reward-preview__row {
	display: flex;
	align-items: center;
	gap: var(--reward-icon-gap);
	min-width: 0;
	padding: 0.35rem 0.45rem;
	border-radius: 12px;
	position: relative;
	background: rgb(56, 35, 20);
}

.location-card-export .reward-preview__icons {
	display: flex;
	align-items: center;
	gap: var(--reward-icon-gap);
	min-width: 0;
	flex-wrap: nowrap;
}

.location-card-export .reward-preview__icon {
	display: flex;
	align-items: center;
	gap: var(--reward-icon-gap);
}

.location-card-export .reward-preview__icon img {
	height: var(--reward-icon-size);
	width: auto;
	max-width: calc(var(--reward-icon-size) * 1.8);
	display: block;
	pointer-events: none;
}

.location-card-export .reward-preview__arrow {
	font-size: calc(var(--reward-icon-size) * 0.7);
	font-weight: 800;
	color: #e2e8f0;
	pointer-events: none;
}

.location-card-export .reward-preview__or-slash {
	font-size: calc(var(--reward-icon-size) * 0.65);
	font-weight: 900;
	color: #e2e8f0;
	pointer-events: none;
}

.location-card-export .reward-preview__row.is-text {
	display: block;
	box-sizing: border-box;
	font-size: 0.72rem;
	color: #e2e8f0;
	line-height: 1.05;
	text-align: left;
	overflow: hidden;
}

.location-card-export .reward-preview__text {
	font-size: inherit;
	color: inherit;
	line-height: inherit;
	overflow: hidden;
	white-space: normal;
	overflow-wrap: anywhere;
	display: block;
	min-width: 0;
}

.location-card-export .location-name {
tdisplay: block;
tfont-family: Opsilon, ui-serif, system-ui, -apple-system, Segoe UI, sans-serif;
tfont-weight: 700;
tcolor: #ffffff;
ttext-shadow: 0 2px 6px rgba(0, 0, 0, 0.55);
twhite-space: nowrap;
toverflow: hidden;
ttext-overflow: ellipsis;
}
`;
}

export async function generateFinalLocationCardFromLayout(
	location: LocationForCardGen,
	options?: { configKey?: string; rewardRows?: GameLocationRewardRow[] }
): Promise<{ path: string; updated_at: string }> {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		throw new Error('Location card generation must run in the browser.');
	}

	const configKey = (options?.configKey ?? 'base').trim() || 'base';
	if (!location.background_image_path) {
		throw new Error('Location is missing a base image (background_image_path).');
	}

	await Promise.all([loadOpsilonFont(), loadIconPool()]);

	const baseImageUrl = publicAssetUrl(location.background_image_path, { updatedAt: location.updated_at ?? 0 });
	if (!baseImageUrl) throw new Error('Failed to resolve location base image URL.');

	// Load once to get native dimensions and warm the browser cache (CORS).
	const bg = await loadImage(baseImageUrl);
	const w = bg.naturalWidth || bg.width;
	const h = bg.naturalHeight || bg.height;
	if (!w || !h) throw new Error('Base image has invalid dimensions.');

	const rawConfig = await loadConfig(configKey);
	const config = rawConfig ?? (await import('./locationCardLayoutConfig')).createDefaultLocationCardLayoutConfig(w, h);

	const sx = w / Math.max(1, config._ref_w);
	const sy = h / Math.max(1, config._ref_h);
	const s = (sx + sy) / 2;

	const rewardRows = options?.rewardRows ?? [];
	const row1 = rewardRows[0] ?? null;
	const row2 = rewardRows[1] ?? null;
	const row3 = rewardRows[2] ?? null;
	const row4 = rewardRows[3] ?? null;
	const row5 = rewardRows[4] ?? null;

	const sandbox = document.createElement('div');
	sandbox.style.position = 'fixed';
	sandbox.style.left = '-100000px';
	sandbox.style.top = '0';
	sandbox.style.width = `${w}px`;
	sandbox.style.height = `${h}px`;
	sandbox.style.pointerEvents = 'none';
	sandbox.style.userSelect = 'none';

	const styleEl = document.createElement('style');
	styleEl.textContent = getExportCss();
	sandbox.appendChild(styleEl);

	const cardEl = document.createElement('div');
	cardEl.className = 'location-card-export';
	cardEl.style.width = `${w}px`;
	cardEl.style.height = `${h}px`;
	sandbox.appendChild(cardEl);

	const bgImg = document.createElement('img');
	bgImg.className = 'location-card-export__bg';
	bgImg.src = baseImageUrl;
	bgImg.alt = 'Location background';
	bgImg.draggable = false;
	try {
		(bgImg as any).crossOrigin = 'anonymous';
	} catch {
		// ignore
	}
	cardEl.appendChild(bgImg);

	const place = (placement: { x: number; y: number; rotation: number; scale: number }, child: HTMLElement) => {
		const el = document.createElement('div');
		el.className = 'placed';
		el.style.left = `${placement.x * sx}px`;
		el.style.top = `${placement.y * sy}px`;
		el.style.transform = `translate(-50%, -50%) rotate(${placement.rotation}deg) scale(${placement.scale * s})`;
		el.appendChild(child);
		cardEl.appendChild(el);
	};

	// Match the legacy layout roughly by constraining the name to the old row box width (460/600 of the ref width).
	const nameBoxWRef = Math.max(1, Math.round(config._ref_w * (460 / 600)));
	const nameBoxW = Math.max(1, Math.round((nameBoxWRef * sx) / Math.max(0.0001, s)));

	const nameEls: HTMLDivElement[] = [];
	const nameText = String(location.name ?? '').trim() || 'Location';
	for (const copy of [0, 1] as const) {
		const nameEl = document.createElement('div');
		nameEl.className = 'location-name';
		nameEl.textContent = nameText;
		nameEl.style.width = `${nameBoxW}px`;
		nameEl.style.fontSize = `${Math.max(6, config.name_style.fontSize)}px`;
		nameEl.style.lineHeight =
			typeof config.name_style.lineHeight === 'number' && Number.isFinite(config.name_style.lineHeight)
				? `${Math.max(0, config.name_style.lineHeight)}px`
				: '1.15';
		nameEl.style.textAlign = config.name_style.align;
		nameEl.style.color = config.name_style.color;
		place(config.placements.name[copy], nameEl);
		nameEls.push(nameEl);
	}

	const placeRow = (key: 'row_1' | 'row_2' | 'row_3' | 'row_4' | 'row_5', row: GameLocationRewardRow | null) => {
		if (!hasRewardContent(row)) return;
		for (const copy of [0] as const) {
			const rowScale = Math.max(0.05, config.placements[key][copy].scale);
			const textBoxPx =
				row?.type === 'text'
					? {
							w: (config.reward_text_boxes[key][copy].w * sx) / Math.max(0.0001, s * rowScale),
							h: (config.reward_text_boxes[key][copy].h * sy) / Math.max(0.0001, s * rowScale)
						}
					: undefined;
			const textStyle =
				row?.type === 'text'
					? {
							fontSizePx: config.reward_text_style.fontSize / rowScale,
							lineHeightPx:
								typeof config.reward_text_style.lineHeight === 'number' && Number.isFinite(config.reward_text_style.lineHeight)
									? config.reward_text_style.lineHeight / rowScale
									: undefined,
							align: config.reward_text_style.align,
							color: config.reward_text_style.color
						}
					: undefined;
			place(config.placements[key][copy], buildRewardRowNode(row!, { textBoxPx, textStyle }));
		}
	};

	placeRow('row_1', row1);
	placeRow('row_2', row2);
	placeRow('row_3', row3);
	placeRow('row_4', row4);
	placeRow('row_5', row5);

	document.body.appendChild(sandbox);

		try {
			// Ensure fonts and images are loaded before capturing.
			await document.fonts.ready;
			await waitForImages(cardEl);

		const { default: html2canvas } = await import('html2canvas');
		const canvas = await html2canvas(cardEl, {
			backgroundColor: null,
			scale: 1,
			useCORS: true,
			allowTaint: false,
			logging: false,
			width: w,
			height: h
		});

		const blob: Blob = await new Promise((resolve, reject) => {
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to render export PNG.'))), 'image/png');
		});

		const { data, error: uploadError } = await processAndUploadImage(blob, {
			folder: 'game_location_cards',
			filename: location.id,
			cropTransparent: false,
			upsert: true
		});
		if (uploadError) throw uploadError;
		const uploadedPath = (data?.path ?? '').trim();
		if (!uploadedPath) throw new Error('Failed to upload PNG (missing storage path).');

		const updatedAt = new Date().toISOString();
		const { error: updateErr } = await supabase
			.from('game_locations')
			.update({ image_with_icons_path: uploadedPath, updated_at: updatedAt })
			.eq('id', location.id);
		if (updateErr) throw updateErr;

		return { path: uploadedPath, updated_at: updatedAt };
	} finally {
		sandbox.remove();
	}
}

export async function renderLocationRewardRowPngBlob(row: GameLocationRewardRow): Promise<Blob> {
	if (typeof window === 'undefined' || typeof document === 'undefined') {
		throw new Error('Reward row rendering must run in the browser.');
	}
	if (!hasRewardContent(row)) {
		throw new Error('Reward row has no renderable content.');
	}

	await Promise.all([loadOpsilonFont(), loadIconPool()]);

	const sandbox = document.createElement('div');
	sandbox.style.position = 'fixed';
	sandbox.style.left = '-100000px';
	sandbox.style.top = '0';
	sandbox.style.pointerEvents = 'none';
	sandbox.style.userSelect = 'none';

	const styleEl = document.createElement('style');
	styleEl.textContent = getExportCss();
	sandbox.appendChild(styleEl);

	const root = document.createElement('div');
	root.className = 'location-card-export';
	root.style.display = 'inline-block';
	root.style.position = 'relative';
	sandbox.appendChild(root);

	const rowNode = buildRewardRowNode(row);
	root.appendChild(rowNode);

	document.body.appendChild(sandbox);

	try {
		await document.fonts.ready;
		await waitForImages(root);

		const rowEl = rowNode.querySelector('.reward-preview__row') as HTMLElement | null;
		const target = rowEl ?? rowNode;
		const rect = target.getBoundingClientRect();
		const width = Math.max(1, Math.ceil(rect.width));
		const height = Math.max(1, Math.ceil(rect.height));

		const { default: html2canvas } = await import('html2canvas');
		const canvas = await html2canvas(target, {
			backgroundColor: null,
			scale: 1,
			useCORS: true,
			allowTaint: false,
			logging: false,
			width,
			height
		});

		const blob: Blob = await new Promise((resolve, reject) => {
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to render reward row PNG.'))), 'image/png');
		});
		return blob;
	} finally {
		sandbox.remove();
	}
}
