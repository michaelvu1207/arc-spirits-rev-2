import type { EventCardBackgroundSettings } from '$lib/settings/eventCardBackground';
import { defaultEventCardBackgroundSettings } from '$lib/settings/eventCardBackground';
import type { StageEventRenderStyle, StageLocationRenderStyle } from '$lib/types/stageCardStyles';

export function getEventCardBackgroundSettingsOverride(
	renderStyle: StageEventRenderStyle
): EventCardBackgroundSettings | undefined {
	const base = defaultEventCardBackgroundSettings;

	switch (renderStyle) {
		case 'event_v6_ember':
			// Molten core - amber flame meeting smoldering crimson
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#f59e0b',
					accentAAlpha: 0.26,
					accentBHex: '#dc2626',
					accentBAlpha: 0.18
				},
				image: { ...base.image, version: Date.now() }
			};
		case 'event_v6_frost':
			// Glacial depths - crystalline cyan meeting deep cold indigo
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#06b6d4',
					accentAAlpha: 0.24,
					accentBHex: '#6366f1',
					accentBAlpha: 0.18
				},
				image: { ...base.image, version: Date.now() }
			};
		case 'event_v6_verdant':
			// Ancient forest - living emerald meeting shadowed teal
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#10b981',
					accentAAlpha: 0.24,
					accentBHex: '#14b8a6',
					accentBAlpha: 0.16
				},
				image: { ...base.image, version: Date.now() }
			};
		case 'event_v6_shadow':
			// The veil between worlds - ethereal slate meeting otherworldly violet
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#6b7280',
					accentAAlpha: 0.28,
					accentBHex: '#7c3aed',
					accentBAlpha: 0.20
				},
				image: { ...base.image, version: Date.now() }
			};
		case 'event_v6_radiant':
			// Divine light - holy amber meeting warm sanctity
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#fbbf24',
					accentAAlpha: 0.26,
					accentBHex: '#f97316',
					accentBAlpha: 0.16
				},
				image: { ...base.image, version: Date.now() }
			};
		case 'event_v6_crimson':
			// Blood magic - vivid rose meeting deep magenta shadows
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#e11d48',
					accentAAlpha: 0.26,
					accentBHex: '#be185d',
					accentBAlpha: 0.18
				},
				image: { ...base.image, version: Date.now() }
			};
		case 'event_v6_void':
			// The space between stars - cosmic indigo meeting abyssal darkness
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#4f46e5',
					accentAAlpha: 0.26,
					accentBHex: '#1e1b4b',
					accentBAlpha: 0.22
				},
				image: { ...base.image, version: Date.now() }
			};
		case 'event_v6_fairy':
			// Enchanted grove - pink magic meeting purple fae sparkle
			return {
				...base,
				mode: 'gradient',
				gradient: {
					accentAHex: '#ec4899',
					accentAAlpha: 0.28,
					accentBHex: '#a855f7',
					accentBAlpha: 0.18
				},
				image: { ...base.image, version: Date.now() }
			};
		default:
			return undefined;
	}
}

export interface StageLocationStyleSettings {
	gradient: {
		accentAHex: string;
		accentAAlpha: number;
		accentBHex: string;
		accentBAlpha: number;
	};
	overlayTint?: string;
}

export function getStageLocationStyleSettings(
	renderStyle: StageLocationRenderStyle
): StageLocationStyleSettings {
	switch (renderStyle) {
		case 'stage_location_v6_ember':
			// Volcanic terrain - molten amber meeting scorched crimson
			return {
				gradient: {
					accentAHex: '#f97316',
					accentAAlpha: 0.28,
					accentBHex: '#dc2626',
					accentBAlpha: 0.22
				},
				overlayTint: 'rgba(220, 38, 38, 0.08)'
			};
		case 'stage_location_v6_frost':
			// Frozen wastes - crystalline cyan meeting deep indigo ice
			return {
				gradient: {
					accentAHex: '#22d3ee',
					accentAAlpha: 0.26,
					accentBHex: '#6366f1',
					accentBAlpha: 0.20
				},
				overlayTint: 'rgba(34, 211, 238, 0.06)'
			};
		case 'stage_location_v6_verdant':
			// Ancient forest - living emerald meeting shadowed teal depths
			return {
				gradient: {
					accentAHex: '#22c55e',
					accentAAlpha: 0.26,
					accentBHex: '#14b8a6',
					accentBAlpha: 0.18
				},
				overlayTint: 'rgba(34, 197, 94, 0.06)'
			};
		case 'stage_location_v6_shadow':
			// The veil between worlds - ethereal slate meeting otherworldly violet
			return {
				gradient: {
					accentAHex: '#6b7280',
					accentAAlpha: 0.30,
					accentBHex: '#7c3aed',
					accentBAlpha: 0.22
				},
				overlayTint: 'rgba(0, 0, 0, 0.12)'
			};
		case 'stage_location_v6_radiant':
			// Divine sanctuary - holy amber meeting warm golden light
			return {
				gradient: {
					accentAHex: '#fbbf24',
					accentAAlpha: 0.28,
					accentBHex: '#f97316',
					accentBAlpha: 0.18
				},
				overlayTint: 'rgba(251, 191, 36, 0.08)'
			};
		case 'stage_location_v6_crimson':
			// Blood-soaked battleground - vivid rose meeting deep magenta
			return {
				gradient: {
					accentAHex: '#e11d48',
					accentAAlpha: 0.28,
					accentBHex: '#be185d',
					accentBAlpha: 0.20
				},
				overlayTint: 'rgba(225, 29, 72, 0.08)'
			};
		case 'stage_location_v6_void':
			// The space between stars - cosmic indigo meeting abyssal darkness
			return {
				gradient: {
					accentAHex: '#4f46e5',
					accentAAlpha: 0.28,
					accentBHex: '#1e1b4b',
					accentBAlpha: 0.24
				},
				overlayTint: 'rgba(30, 27, 75, 0.12)'
			};
		case 'stage_location_v6_fairy':
			// Enchanted grove - pink magic meeting purple fae sparkle
			return {
				gradient: {
					accentAHex: '#ec4899',
					accentAAlpha: 0.30,
					accentBHex: '#a855f7',
					accentBAlpha: 0.20
				},
				overlayTint: 'rgba(236, 72, 153, 0.06)'
			};
		case 'stage_location_v6_parchment':
			// Weathered explorer journal - warm sepia, aged paper
			return {
				gradient: {
					accentAHex: '#c9a86c',
					accentAAlpha: 0.28,
					accentBHex: '#8b6914',
					accentBAlpha: 0.22
				},
				overlayTint: 'rgba(232, 220, 196, 0.08)'
			};
		case 'stage_location_v6_cartographer':
			// Maritime navigation - deep teal, nautical atmosphere
			return {
				gradient: {
					accentAHex: '#2d5a5a',
					accentAAlpha: 0.30,
					accentBHex: '#1a3d4d',
					accentBAlpha: 0.24
				},
				overlayTint: 'rgba(45, 90, 90, 0.1)'
			};
		case 'stage_location_v6_merchant':
			// Gilded trade ledger - velvet green, gold leaf
			return {
				gradient: {
					accentAHex: '#2a5a3a',
					accentAAlpha: 0.28,
					accentBHex: '#d4a84b',
					accentBAlpha: 0.18
				},
				overlayTint: 'rgba(212, 168, 75, 0.06)'
			};
		case 'stage_location_v6_ancient':
			// Unearthed bronze relic - amber glow, weathered stone
			return {
				gradient: {
					accentAHex: '#8b5a2b',
					accentAAlpha: 0.32,
					accentBHex: '#d4a574',
					accentBAlpha: 0.22
				},
				overlayTint: 'rgba(139, 90, 43, 0.1)'
			};
		case 'stage_location_v6_arcane':
		default:
			// Arcane style (purple/blue) - mystical default
			return {
				gradient: {
					accentAHex: '#8b5cf6',
					accentAAlpha: 0.22,
					accentBHex: '#3b82f6',
					accentBAlpha: 0.16
				}
			};
	}
}
