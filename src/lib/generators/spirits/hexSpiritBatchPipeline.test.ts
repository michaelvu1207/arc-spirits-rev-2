import { describe, expect, it } from 'vitest';
import { buildHexSpiritPipelineStoragePaths } from './hexSpiritBatchPipeline';

describe('hex spirit batch pipeline storage paths', () => {
	it('uses primary storage paths for primary pipeline targets', () => {
		expect(
			buildHexSpiritPipelineStoragePaths({
				spiritId: 'spirit-1',
				target: { kind: 'primary' }
			})
		).toEqual({
			frontPath: 'hex_spirits/spirit-1_game_print.png',
			backPath: 'hex_spirits/spirit-1_back_side_export.png',
			combinedFolder: 'hex_spirits/spirit-1/tts_combined'
		});
	});

	it('uses variant-scoped storage paths for variation pipeline targets', () => {
		expect(
			buildHexSpiritPipelineStoragePaths({
				spiritId: 'spirit-1',
				target: { kind: 'variation', variantId: 'variant-1' }
			})
		).toEqual({
			frontPath: 'hex_spirits/spirit-1/variations/variant-1/game_print.png',
			backPath: 'hex_spirits/spirit-1/variations/variant-1/back_side_export.png',
			combinedFolder: 'hex_spirits/spirit-1/variations/variant-1/tts_combined'
		});
	});
});
