import { describe, expect, it } from 'vitest';
import {
	buildArtRawVariantUploadTarget,
	buildVariationExportId,
	parseVariationExportId,
	isArtRawVariantCurrent,
	normalizeArtRawVariantLabel,
	type HexSpiritArtRawVariantOutputPatch
} from './hexSpirits';
import { buildHexSpiritVariationCandidates } from './variationCandidates';

describe('hex spirit art raw variants', () => {
	it('normalizes blank labels to a stable fallback', () => {
		expect(normalizeArtRawVariantLabel('   ', 'Uploaded variation')).toBe('Uploaded variation');
	});

	it('trims labels and collapses internal whitespace', () => {
		expect(normalizeArtRawVariantLabel('  Floral   patch   draft  ', 'Uploaded variation')).toBe(
			'Floral patch draft'
		);
	});

	it('builds upload targets under the spirit art raw variations folder', () => {
		expect(
			buildArtRawVariantUploadTarget({
				spiritId: 'spirit-1',
				spiritName: 'Flower Fighter',
				label: 'AI draft'
			})
		).toEqual({
			folder: 'hex_spirits/spirit-1/art_raw_variations',
			filename: 'hex_flower_fighter_ai_draft'
		});
	});

	it('detects the active variant by normalized storage path', () => {
		expect(
			isArtRawVariantCurrent(
				{ storage_path: 'hex_spirits/spirit-1/art_raw_variations/draft.png' },
				'/game_assets/hex_spirits/spirit-1/art_raw_variations/draft.png'
			)
		).toBe(true);
	});

	it('round trips variation export ids without losing spirit or variant identity', () => {
		const exportId = buildVariationExportId('spirit-1', 'variant-1');

		expect(exportId).toBe('spirit-1__variant__variant-1');
		expect(parseVariationExportId(exportId)).toEqual({
			spiritId: 'spirit-1',
			variantId: 'variant-1'
		});
	});

	it('rejects malformed variation export ids', () => {
		expect(parseVariationExportId('spirit-1_front_game_print')).toBeNull();
		expect(parseVariationExportId('spirit-1__variant__')).toBeNull();
		expect(parseVariationExportId('__variant__variant-1')).toBeNull();
	});

	it('accepts variant output patches with downstream path keys', () => {
		const patch: HexSpiritArtRawVariantOutputPatch = {
			game_print_image_path: '/game_assets/hex_spirits/spirit-1/variations/variant-1/front.png',
			back_side_export_path: 'game_assets/hex_spirits/spirit-1/variations/variant-1/back.png',
			tts_combined_image_path: 'hex_spirits/spirit-1/variations/variant-1/tts_combined/combined.png',
			pipeline_status: 'complete',
			pipeline_error: null
		};

		expect(patch.game_print_image_path).toContain('front.png');
		expect(patch.pipeline_status).toBe('complete');
	});

	it('builds variation candidates with selected state and export ids', () => {
		const candidates = buildHexSpiritVariationCandidates({
			spirits: [
				{
					id: 'spirit-1',
					name: 'Flower Fighter',
					description: null,
					cost: 3,
					traits: { origin_ids: ['origin-1'], class_ids: ['class-1'] },
					created_at: null,
					updated_at: '2026-05-01T00:00:00Z',
					game_print_image_path: 'hex_spirits/spirit-1/front.png',
					game_print_no_icons_path: null,
					art_raw_image_path: 'hex_spirits/spirit-1/raw.png',
					psd_folder_override: null,
					awaken_condition: null,
					manual_game_print: false,
					back_side_base: null,
					back_side_export: 'hex_spirits/spirit-1/back.png',
					tts_combined_image_path: 'hex_spirits/spirit-1/combined.png'
				}
			],
			variants: [
				{
					id: 'variant-1',
					hex_spirit_id: 'spirit-1',
					label: 'Migration draft',
					description: null,
					storage_path: 'hex_spirits/spirit-1/art_raw_variations/draft.png',
					source: 'uploaded',
					prompt: null,
					game_print_no_icons_path: null,
					game_print_image_path: 'hex_spirits/spirit-1/variations/variant-1/front.png',
					back_side_base_path: null,
					back_side_export_path: null,
					tts_combined_image_path: null,
					is_variation_selected: true,
					pipeline_status: 'complete',
					pipeline_error: null,
					created_at: null,
					updated_at: null
				}
			],
			getPublicImage: (path) => (path ? `https://assets.test/${path}` : null)
		});

		expect(candidates).toHaveLength(1);
		expect(candidates[0].exportId).toBe('spirit-1__variant__variant-1');
		expect(candidates[0].displayName).toBe('Flower Fighter - Migration draft');
		expect(candidates[0].selectedForVariation).toBe(true);
		expect(candidates[0].frontUrl).toBe(
			'https://assets.test/hex_spirits/spirit-1/variations/variant-1/front.png'
		);
		expect(candidates[0].primaryFrontUrl).toBe('https://assets.test/hex_spirits/spirit-1/front.png');
	});

	it('excludes original primary-art baseline rows from variation candidates', () => {
		const candidates = buildHexSpiritVariationCandidates({
			spirits: [
				{
					id: 'spirit-1',
					name: 'Flower Fighter',
					description: null,
					cost: 3,
					traits: { origin_ids: ['origin-1'], class_ids: ['class-1'] },
					created_at: null,
					updated_at: '2026-05-01T00:00:00Z',
					game_print_image_path: 'hex_spirits/spirit-1/front.png',
					game_print_no_icons_path: null,
					art_raw_image_path: 'hex_spirits/spirit-1/raw.png',
					psd_folder_override: null,
					awaken_condition: null,
					manual_game_print: false,
					back_side_base: null,
					back_side_export: 'hex_spirits/spirit-1/back.png',
					tts_combined_image_path: 'hex_spirits/spirit-1/combined.png'
				}
			],
			variants: [
				{
					id: 'variant-original',
					hex_spirit_id: 'spirit-1',
					label: 'Original',
					description: null,
					storage_path: 'hex_spirits/spirit-1/raw.png',
					source: 'original',
					prompt: null,
					game_print_no_icons_path: null,
					game_print_image_path: null,
					back_side_base_path: null,
					back_side_export_path: null,
					tts_combined_image_path: null,
					is_variation_selected: false,
					pipeline_status: null,
					pipeline_error: null,
					created_at: null,
					updated_at: null
				},
				{
					id: 'variant-generated',
					hex_spirit_id: 'spirit-1',
					label: 'Generated draft',
					description: null,
					storage_path: 'hex_spirits/spirit-1/art_raw_variations/generated.png',
					source: 'generated',
					prompt: null,
					game_print_no_icons_path: null,
					game_print_image_path: null,
					back_side_base_path: null,
					back_side_export_path: null,
					tts_combined_image_path: null,
					is_variation_selected: false,
					pipeline_status: null,
					pipeline_error: null,
					created_at: null,
					updated_at: null
				}
			],
			getPublicImage: (path) => (path ? `https://assets.test/${path}` : null)
		});

		expect(candidates.map((candidate) => candidate.variant.id)).toEqual(['variant-generated']);
	});
});
