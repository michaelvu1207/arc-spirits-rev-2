import type { HexSpiritArtRawVariantRow, HexSpiritRow } from '$lib/types/gameData';
import { buildVariationExportId, normalizeHexSpiritBucketPath } from './hexSpirits';

export type HexSpiritVariationCandidate<TSpirit extends HexSpiritRow = HexSpiritRow> = {
	spirit: TSpirit;
	variant: HexSpiritArtRawVariantRow;
	exportId: string;
	displayName: string;
	rawArtUrl: string | null;
	frontUrl: string | null;
	frontNoIconsUrl: string | null;
	backBaseUrl: string | null;
	backUrl: string | null;
	ttsCombinedUrl: string | null;
	primaryFrontUrl: string | null;
	primaryBackUrl: string | null;
	primaryTtsCombinedUrl: string | null;
	selectedForVariation: boolean;
};

export type BuildHexSpiritVariationCandidatesOptions<TSpirit extends HexSpiritRow = HexSpiritRow> = {
	spirits: TSpirit[];
	variants: HexSpiritArtRawVariantRow[];
	getPublicImage: (path: string | null | undefined, updatedAt?: string | null) => string | null;
};

export function buildHexSpiritVariationCandidates<TSpirit extends HexSpiritRow = HexSpiritRow>({
	spirits,
	variants,
	getPublicImage
}: BuildHexSpiritVariationCandidatesOptions<TSpirit>): HexSpiritVariationCandidate<TSpirit>[] {
	const spiritById = new Map(spirits.map((spirit) => [spirit.id, spirit]));

	return variants
		.map((variant) => {
				const spirit = spiritById.get(variant.hex_spirit_id);
				if (!spirit) return null;
				const variantRawPath = normalizeHexSpiritBucketPath(variant.storage_path);
				const primaryRawPath = normalizeHexSpiritBucketPath(spirit.art_raw_image_path);
				if (variant.source === 'original' || (primaryRawPath && variantRawPath === primaryRawPath)) {
					return null;
				}

				return {
				spirit,
				variant,
				exportId: buildVariationExportId(spirit.id, variant.id),
				displayName: `${spirit.name} - ${variant.label}`,
				rawArtUrl: getPublicImage(variant.storage_path, variant.updated_at),
				frontUrl: getPublicImage(variant.game_print_image_path, variant.updated_at),
				frontNoIconsUrl: getPublicImage(variant.game_print_no_icons_path, variant.updated_at),
				backBaseUrl: getPublicImage(variant.back_side_base_path, variant.updated_at),
				backUrl: getPublicImage(variant.back_side_export_path, variant.updated_at),
				ttsCombinedUrl: getPublicImage(variant.tts_combined_image_path, variant.updated_at),
				primaryFrontUrl: getPublicImage(spirit.game_print_image_path, spirit.updated_at),
				primaryBackUrl: getPublicImage(spirit.back_side_export, spirit.updated_at),
				primaryTtsCombinedUrl: getPublicImage(spirit.tts_combined_image_path, spirit.updated_at),
				selectedForVariation: Boolean(variant.is_variation_selected)
			} satisfies HexSpiritVariationCandidate<TSpirit>;
		})
		.filter((candidate): candidate is HexSpiritVariationCandidate<TSpirit> => Boolean(candidate));
}

export function getSelectedVariationBySpiritId<TSpirit extends HexSpiritRow = HexSpiritRow>(
	candidates: HexSpiritVariationCandidate<TSpirit>[]
): Map<string, HexSpiritVariationCandidate<TSpirit>> {
	const selected = new Map<string, HexSpiritVariationCandidate<TSpirit>>();
	for (const candidate of candidates) {
		if (candidate.selectedForVariation) {
			selected.set(candidate.spirit.id, candidate);
		}
	}
	return selected;
}
