/**
 * Event card renderer for the unified layout system.
 *
 * Event cards currently use a pure-canvas approach (generateEventCardPNG)
 * that generates the entire card from scratch with themed frames,
 * reward rows, and background images.
 *
 * This renderer provides the CardRenderer interface with stub custom zones.
 * Once base images are adopted for event cards, the custom zones can be
 * fleshed out to render reward icons on top of a base image.
 */

import type { CardLayoutConfig, CardRenderer, CustomZone } from '$lib/generators/shared/layoutTypes';
import type { ZoneDataMap } from '$lib/generators/shared/layoutRenderer';
import type { StageEventCardRow } from '$lib/types/gameData';

export type EventForLayout = {
	id: string;
	internal_name: string;
	title: string;
	description: string | null;
	reward_rows: StageEventCardRow['reward_rows'];
	card_image_path: string | null;
	image_path: string | null;
	updated_at: string | null;
};

export const eventCardRenderer: CardRenderer<EventForLayout> = {
	renderCustomZone(_ctx, _zone, _data, _images) {
		// Event rendering is currently pure-canvas (generateEventCardPNG).
		// Custom zone rendering will be implemented when base images are adopted.
	},

	collectImageUrls(_config, _data) {
		return [];
	},

	getDefaultConfig(): CardLayoutConfig {
		return {
			_version: 1,
			_ref_w: 600,
			_ref_h: 437,
			cardType: 'event',
			zones: [
				{
					type: 'custom',
					key: 'reward_icons',
					label: 'Reward Icons',
					box: { x: 50, y: 300, w: 500, h: 100 },
					customConfig: {}
				}
			],
			meta: {
				renderMode: 'pure_canvas'
			}
		};
	}
};

export function buildEventZoneData(_event: EventForLayout, _config: CardLayoutConfig): ZoneDataMap {
	return {
		texts: {},
		iconGrids: {},
		images: {}
	};
}
