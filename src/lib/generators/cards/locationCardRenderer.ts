/**
 * Location card renderer for the unified layout system.
 *
 * Location cards use a DOM-based rendering approach (html2canvas) because
 * their reward rows contain CSS-styled icon layouts with arrows, slashes,
 * and text that are difficult to replicate in pure canvas.
 *
 * This renderer provides the CardRenderer interface but delegates the
 * actual rendering to the existing locationCardIconPlacer.ts logic.
 * The custom zone is a single 'reward_overlay' zone that encompasses
 * the entire card overlay (name + 3 reward rows).
 */

import type { CardLayoutConfig, CardRenderer, CustomZone } from '$lib/generators/shared/layoutTypes';
import type { ZoneDataMap } from '$lib/generators/shared/layoutRenderer';
import type { GameLocationRow } from '$lib/types/gameData';

export type LocationForLayout = Pick<
	GameLocationRow,
	'id' | 'name' | 'background_image_path' | 'image_with_icons_path' | 'updated_at'
>;

/**
 * Location cards currently use a hybrid DOM/html2canvas approach,
 * so the CardRenderer custom zone methods are minimal stubs.
 * The actual generation is handled by generateFinalLocationCardFromLayout
 * in locationCardIconPlacer.ts which uses the LocationCardLayoutConfig
 * (Transform-based) format.
 *
 * This renderer exists to integrate location cards into the unified
 * CardLayoutConfigurator and card-layouts page, using the existing
 * location-specific configurator component for preview/editing.
 */
export const locationCardRenderer: CardRenderer<LocationForLayout> = {
	renderCustomZone(_ctx, _zone, _data, _images) {
		// Location rendering is handled via html2canvas in locationCardIconPlacer.ts,
		// not via direct canvas drawing. This is a no-op.
	},

	collectImageUrls(_config, _data) {
		// Image loading is handled by the html2canvas pipeline.
		return [];
	},

	getDefaultConfig(): CardLayoutConfig {
		return {
			_version: 1,
			_ref_w: 600,
			_ref_h: 437,
			cardType: 'location',
			zones: [
				{
					type: 'custom',
					key: 'reward_overlay',
					label: 'Reward Overlay',
					box: { x: 0, y: 0, w: 600, h: 437 },
					customConfig: {}
				}
			],
			meta: {
				renderMode: 'html2canvas'
			}
		};
	}
};

export function buildLocationZoneData(_location: LocationForLayout, _config: CardLayoutConfig): ZoneDataMap {
	return {
		texts: {},
		iconGrids: {},
		images: {}
	};
}
