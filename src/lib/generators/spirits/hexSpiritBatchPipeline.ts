import { supabase } from '$lib/api/supabaseClient';
import type { AwakenRuneToken, ClassRow, HexSpiritRow, OriginRow, MatItemRow } from '$lib/types/gameData';
import { updateArtRawVariantOutputs } from '$lib/features/hex-spirits/hexSpirits';
import { processAndUploadImage, publicAssetUrl } from '$lib/utils/storage';
import {
	generateSpiritWithIcons,
	type FrameTier,
	type FrontIconPlacementConfig,
	type SpiritIconData
} from './spiritIconPlacer';
import {
	generateBackWithIcons,
	type BackIconPlacementConfig,
	type RuneIconData
} from './spiritBackIconPlacer';
import { generateCombinedTTSTexture } from './ttsCombinedTexture';

export type HexSpiritPipelineStatus =
	| 'queued'
	| 'front'
	| 'back'
	| 'combined'
	| 'complete'
	| 'failed';

export type HexSpiritPipelineTarget =
	| { kind: 'primary' }
	| { kind: 'variation'; variantId: string };

export type HexSpiritPipelineSpirit = HexSpiritRow & {
	game_print_image_url: string | null;
	game_print_no_icons_url: string | null;
	art_raw_image_url: string | null;
	back_side_base_url: string | null;
	back_side_export_url: string | null;
	tts_combined_image_url: string | null;
	pipeline_target?: HexSpiritPipelineTarget;
};

type BackSlotClass = Pick<ClassRow, 'id' | 'icon_png' | 'class_type' | 'is_special'> & {
	isHuman?: boolean;
};

export interface HexSpiritPipelineProgress {
	status: HexSpiritPipelineStatus;
	spiritId: string;
	spiritName: string;
	index: number;
	total: number;
	completed: number;
	failed: number;
	message?: string;
}

export interface HexSpiritPipelineResult {
	spiritId: string;
	spiritName: string;
	success: boolean;
	error?: string;
	frontPath?: string | null;
	backPath?: string | null;
	combinedPath?: string | null;
}

export interface HexSpiritBatchPipelineOptions {
	spirits: HexSpiritPipelineSpirit[];
	origins: Pick<OriginRow, 'id' | 'icon_png'>[];
	classes: BackSlotClass[];
	runes: Pick<MatItemRow, 'id' | 'icon_path'>[];
	frontConfig: FrontIconPlacementConfig;
	backConfig: BackIconPlacementConfig;
	getTier: (spirit: HexSpiritPipelineSpirit) => FrameTier | null;
	concurrency?: number;
	onProgress?: (progress: HexSpiritPipelineProgress) => void;
}

export interface HexSpiritBatchPipelineSummary {
	total: number;
	completed: number;
	failed: number;
	results: HexSpiritPipelineResult[];
}

const DEFAULT_CONCURRENCY = 3;

export function buildHexSpiritPipelineStoragePaths({
	spiritId,
	target
}: {
	spiritId: string;
	target: HexSpiritPipelineTarget;
}): { frontPath: string; backPath: string; combinedFolder: string } {
	if (target.kind === 'variation') {
		const base = `hex_spirits/${spiritId}/variations/${target.variantId}`;
		return {
			frontPath: `${base}/game_print.png`,
			backPath: `${base}/back_side_export.png`,
			combinedFolder: `${base}/tts_combined`
		};
	}

	return {
		frontPath: `hex_spirits/${spiritId}_game_print.png`,
		backPath: `hex_spirits/${spiritId}_back_side_export.png`,
		combinedFolder: `hex_spirits/${spiritId}/tts_combined`
	};
}

function clampConcurrency(value: number | undefined, total: number): number {
	const parsed = Math.floor(Number(value));
	if (!Number.isFinite(parsed) || parsed < 1) return Math.min(DEFAULT_CONCURRENCY, Math.max(total, 1));
	return Math.min(parsed, Math.max(total, 1));
}

function publicIconUrl(path: string | null | undefined, folder: string): string | null {
	if (!path) return null;
	const normalized = path.startsWith(`${folder}/`) ? path : `${folder}/${path}`;
	return publicAssetUrl(normalized, { bucket: 'game_assets' });
}

function buildFrontIconSlots(
	spirit: HexSpiritPipelineSpirit,
	origins: Pick<OriginRow, 'id' | 'icon_png'>[],
	classes: Pick<ClassRow, 'id' | 'icon_png'>[]
): SpiritIconData[] {
	const iconSlots: SpiritIconData[] = [];
	const originIds = spirit.traits?.origin_ids ?? [];
	const classIds = spirit.traits?.class_ids ?? [];

	for (const originId of originIds) {
		const origin = origins.find((o) => o.id === originId);
		const iconUrl = publicIconUrl(origin?.icon_png, 'origin_icons');
		if (iconUrl) iconSlots.push({ type: 'origin', iconUrl });
	}

	for (const classId of classIds) {
		const cls = classes.find((c) => c.id === classId);
		const iconUrl = publicIconUrl(cls?.icon_png, 'class_icons');
		if (iconUrl) iconSlots.push({ type: 'class', iconUrl });
	}

	return iconSlots;
}

function usesBackSpecialClassIconSlot(cls: BackSlotClass | null | undefined): boolean {
	return Boolean(cls?.is_special || cls?.class_type === 'special' || cls?.isHuman || cls?.class_type === 'human');
}

function buildBackIconSlots(
	spirit: HexSpiritPipelineSpirit,
	origins: Pick<OriginRow, 'id' | 'icon_png'>[],
	classes: BackSlotClass[]
): SpiritIconData[] {
	const iconSlots: SpiritIconData[] = [];
	const originIds = spirit.traits?.origin_ids ?? [];
	const classIds = spirit.traits?.class_ids ?? [];

	for (const originId of originIds) {
		const origin = origins.find((o) => o.id === originId);
		const iconUrl = publicIconUrl(origin?.icon_png, 'origin_icons');
		if (iconUrl) iconSlots.push({ type: 'origin', iconUrl });
	}

	for (const classId of classIds) {
		const cls = classes.find((c) => c.id === classId);
		if (usesBackSpecialClassIconSlot(cls)) continue;
		const iconUrl = publicIconUrl(cls?.icon_png, 'class_icons');
		if (iconUrl) iconSlots.push({ type: 'class', iconUrl });
	}

	return iconSlots;
}

function buildRuneIconSlots(
	tokens: AwakenRuneToken[] | undefined,
	runes: Pick<MatItemRow, 'id' | 'icon_path'>[]
): RuneIconData[] {
	const runeSlots: RuneIconData[] = [];
	for (const token of tokens ?? []) {
		if (typeof token === 'string') {
			const rune = runes.find((r) => r.id === token);
			const iconUrl = publicIconUrl(rune?.icon_path, 'runes');
			if (iconUrl) runeSlots.push({ type: 'single', iconUrl });
			continue;
		}

		if (token?.kind === 'or') {
			const iconUrls = (token.rune_ids ?? [])
				.map((id) => publicIconUrl(runes.find((r) => r.id === id)?.icon_path, 'runes'))
				.filter((url): url is string => Boolean(url));
			if (iconUrls.length > 0) runeSlots.push({ type: 'or', iconUrls });
		}
	}
	return runeSlots;
}

function getSpecialClassIconUrl(
	spirit: HexSpiritPipelineSpirit,
	classes: BackSlotClass[]
): string | null {
	const classIds = spirit.traits?.class_ids ?? [];
	const specialClass = classIds
		.map((id) => classes.find((cls) => cls.id === id))
		.find((cls) => usesBackSpecialClassIconSlot(cls));
	return publicIconUrl(specialClass?.icon_png, 'class_icons');
}

async function uploadPng(path: string, blob: Blob): Promise<string> {
	const { error } = await supabase.storage.from('game_assets').upload(path, blob, {
		contentType: 'image/png',
		upsert: true
	});
	if (error) throw error;
	return path;
}

async function updateSpirit(id: string, patch: Partial<HexSpiritRow>): Promise<void> {
	const { error } = await supabase
		.from('hex_spirits')
		.update({ ...patch, updated_at: new Date().toISOString() })
		.eq('id', id);
	if (error) throw error;
}

async function updatePipelineTarget(
	spirit: HexSpiritPipelineSpirit,
	patch: Partial<HexSpiritRow>
): Promise<void> {
	const target = spirit.pipeline_target ?? { kind: 'primary' as const };
	if (target.kind === 'variation') {
		const variantPatch: Parameters<typeof updateArtRawVariantOutputs>[1] = {
			pipeline_status: 'complete',
			pipeline_error: null
		};
		if (patch.game_print_image_path !== undefined) {
			variantPatch.game_print_image_path = patch.game_print_image_path;
		}
		if (patch.back_side_export !== undefined) {
			variantPatch.back_side_export_path = patch.back_side_export;
		}
		if (patch.tts_combined_image_path !== undefined) {
			variantPatch.tts_combined_image_path = patch.tts_combined_image_path;
		}
		await updateArtRawVariantOutputs(target.variantId, variantPatch);
		return;
	}

	await updateSpirit(spirit.id, patch);
}

async function updatePipelineError(spirit: HexSpiritPipelineSpirit, error: string): Promise<void> {
	const target = spirit.pipeline_target ?? { kind: 'primary' as const };
	if (target.kind !== 'variation') return;
	await updateArtRawVariantOutputs(target.variantId, {
		pipeline_status: 'failed',
		pipeline_error: error
	});
}

async function runOneSpirit(
	options: HexSpiritBatchPipelineOptions,
	spirit: HexSpiritPipelineSpirit,
	index: number,
	total: number,
	counts: { completed: number; failed: number },
	emit: (progress: Omit<HexSpiritPipelineProgress, 'index' | 'total' | 'completed' | 'failed'>) => void
): Promise<HexSpiritPipelineResult> {
	let frontUrl: string | null = null;
	let frontPath: string | null = spirit.game_print_image_path;
	let backUrl: string | null = null;
	let backPath: string | null = spirit.back_side_export;
	let combinedPath: string | null = null;
	const target = spirit.pipeline_target ?? { kind: 'primary' as const };
	const storagePaths = buildHexSpiritPipelineStoragePaths({ spiritId: spirit.id, target });

	try {
		emit({ status: 'front', spiritId: spirit.id, spiritName: spirit.name });

		if (spirit.manual_game_print) {
			frontUrl =
				spirit.game_print_image_url ??
				publicAssetUrl(spirit.game_print_image_path, { bucket: 'game_assets' });
			if (!frontUrl) {
				throw new Error('Manual game print is enabled, but no final front image exists.');
			}
		} else {
			const tier = options.getTier(spirit);
			if (!tier) throw new Error('No frame tier mapping found for front generation.');
			const sourceUrl = spirit.game_print_no_icons_url || spirit.game_print_image_url;
			if (!sourceUrl) throw new Error('No front source image available.');

			const frontBlob = await generateSpiritWithIcons({
				gamePrintUrl: sourceUrl,
				iconSlots: buildFrontIconSlots(spirit, options.origins, options.classes),
				config: options.frontConfig,
				tier
			});
			frontPath = await uploadPng(storagePaths.frontPath, frontBlob);
			await updatePipelineTarget(spirit, { game_print_image_path: frontPath } as Partial<HexSpiritRow>);
			frontUrl = publicAssetUrl(frontPath, { bucket: 'game_assets' });
		}

		emit({ status: 'back', spiritId: spirit.id, spiritName: spirit.name });

		if (!spirit.back_side_base_url) throw new Error('No back side base image available.');
		const backTier = options.getTier(spirit) ?? 'spirit_world';
		const awakenText = spirit.awaken_condition?.type === 'text' ? spirit.awaken_condition.text : null;
		const runeSlots = spirit.awaken_condition?.type === 'rune_cost'
			? buildRuneIconSlots(spirit.awaken_condition.rune_ids, options.runes)
			: [];
		const backBlob = await generateBackWithIcons({
			backSideUrl: spirit.back_side_base_url,
			iconSlots: buildBackIconSlots(spirit, options.origins, options.classes),
			runeSlots,
			backConfig: options.backConfig,
			frontConfig: options.frontConfig,
			tier: backTier,
			awakenText,
			specialClassIconUrl: getSpecialClassIconUrl(spirit, options.classes)
		});
		backPath = await uploadPng(storagePaths.backPath, backBlob);
		await updatePipelineTarget(spirit, { back_side_export: backPath } as Partial<HexSpiritRow>);
		backUrl = publicAssetUrl(backPath, { bucket: 'game_assets' });

		emit({ status: 'combined', spiritId: spirit.id, spiritName: spirit.name });

		if (!frontUrl) throw new Error('No front image available for combined TTS texture.');
		if (!backUrl) throw new Error('No back image available for combined TTS texture.');
		const combinedBlob = await generateCombinedTTSTexture(frontUrl, backUrl);
		const { data, error } = await processAndUploadImage(combinedBlob, {
			folder: storagePaths.combinedFolder,
			filename: 'combined',
			cropTransparent: false,
			upsert: true
		});
		if (error) throw error;
		combinedPath = data?.path ?? null;
		if (!combinedPath) throw new Error('Combined TTS texture upload did not return a path.');
		await updatePipelineTarget(spirit, {
			tts_combined_image_path: combinedPath
		} as Partial<HexSpiritRow>);

		counts.completed += 1;
		emit({ status: 'complete', spiritId: spirit.id, spiritName: spirit.name });
		return {
			spiritId: spirit.id,
			spiritName: spirit.name,
			success: true,
			frontPath,
			backPath,
			combinedPath
		};
	} catch (err) {
		counts.failed += 1;
		const error = err instanceof Error ? err.message : String(err);
		await updatePipelineError(spirit, error);
		emit({ status: 'failed', spiritId: spirit.id, spiritName: spirit.name, message: error });
		return {
			spiritId: spirit.id,
			spiritName: spirit.name,
			success: false,
			error,
			frontPath,
			backPath,
			combinedPath
		};
	}
}

export async function runHexSpiritBatchPipeline(
	options: HexSpiritBatchPipelineOptions
): Promise<HexSpiritBatchPipelineSummary> {
	const total = options.spirits.length;
	const concurrency = clampConcurrency(options.concurrency, total);
	const results: HexSpiritPipelineResult[] = [];
	const counts = { completed: 0, failed: 0 };
	let nextIndex = 0;

	const emitFor = (index: number) => (
		progress: Omit<HexSpiritPipelineProgress, 'index' | 'total' | 'completed' | 'failed'>
	) => {
		options.onProgress?.({
			...progress,
			index,
			total,
			completed: counts.completed,
			failed: counts.failed
		});
	};

	options.spirits.forEach((spirit, index) => {
		emitFor(index)({ status: 'queued', spiritId: spirit.id, spiritName: spirit.name });
	});

	async function worker() {
		while (nextIndex < total) {
			const index = nextIndex;
			nextIndex += 1;
			const spirit = options.spirits[index];
			const result = await runOneSpirit(options, spirit, index, total, counts, emitFor(index));
			results[index] = result;
		}
	}

	await Promise.all(Array.from({ length: concurrency }, () => worker()));

	return {
		total,
		completed: counts.completed,
		failed: counts.failed,
		results
	};
}
