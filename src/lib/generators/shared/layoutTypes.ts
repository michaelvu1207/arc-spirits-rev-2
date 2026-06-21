/**
 * Unified card layout types for all card types.
 *
 * Every card type uses the same zone-based layout system:
 *   1. A base image is drawn at _ref_w x _ref_h.
 *   2. Zones are rendered back-to-front on top.
 *
 * Zone types:
 *   - text: wrapped/clipped text within a PlacedBox
 *   - icon_grid: centered grid of icons within a PlacedBox
 *   - image: single image drawn with contain/cover into a PlacedBox
 *   - custom: card-type-specific rendering delegated to the CardRenderer
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type Align = 'left' | 'center' | 'right';

export type PlacedBox = {
	x: number;
	y: number;
	w: number;
	h: number;
};

// ---------------------------------------------------------------------------
// Zone types (discriminated union on `type`)
// ---------------------------------------------------------------------------

export type TextZone = {
	type: 'text';
	key: string;
	label: string;
	box: PlacedBox;
	fontSize: number;
	lineHeight?: number;
	align: Align;
	color: string;
	fontFamily?: string;
	fontWeight?: string;
};

export type IconGridZone = {
	type: 'icon_grid';
	key: string;
	label: string;
	box: PlacedBox;
	iconSize: number;
	gap: number;
	maxPerRow: number;
};

export type ImageZone = {
	type: 'image';
	key: string;
	label: string;
	box: PlacedBox;
	fit: 'contain' | 'cover';
};

export type CustomZone = {
	type: 'custom';
	key: string;
	label: string;
	box: PlacedBox;
	customConfig: Record<string, unknown>;
};

export type Zone = TextZone | IconGridZone | ImageZone | CustomZone;

// ---------------------------------------------------------------------------
// Card layout config
// ---------------------------------------------------------------------------

export type CardType = 'monster' | 'event' | 'location' | 'stage_completion';

export type CardLayoutConfig = {
	_version: number;
	/** Reference canvas width (e.g. 2550 for monsters, 600 for locations). */
	_ref_w: number;
	/** Reference canvas height (e.g. 3300 for monsters, 437 for locations). */
	_ref_h: number;
	cardType: CardType;
	/** Zones rendered in order (back-to-front). */
	zones: Zone[];
	/** Card-type-specific constants (not rendered as zones). */
	meta?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Card renderer interface (one implementation per card type)
// ---------------------------------------------------------------------------

export interface CardRenderer<T> {
	/**
	 * Render a custom zone. Called for zones with type === 'custom'.
	 * The implementation should draw directly onto the canvas context.
	 */
	renderCustomZone(
		ctx: CanvasRenderingContext2D,
		zone: CustomZone,
		data: T,
		images: Map<string, HTMLImageElement>
	): void;

	/**
	 * Collect all image URLs that need to be preloaded for rendering.
	 * Called before rendering starts so images can be loaded in parallel.
	 */
	collectImageUrls(config: CardLayoutConfig, data: T): string[];

	/**
	 * Return the default layout config for this card type.
	 * Used when no saved config exists in the DB.
	 */
	getDefaultConfig(): CardLayoutConfig;

	/**
	 * Optional: render a custom zone in preview mode (scaled canvas).
	 * If not provided, renderCustomZone is called with scale=1.
	 */
	renderCustomZonePreview?(
		ctx: CanvasRenderingContext2D,
		zone: CustomZone,
		data: T,
		images: Map<string, HTMLImageElement>,
		scale: number
	): void;
}
