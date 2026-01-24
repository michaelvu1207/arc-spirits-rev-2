export type EventCardBackgroundMode = 'gradient' | 'image';
export type EventCardBackgroundImageSource = 'storage' | 'url';

export interface EventCardBackgroundGradient {
	accentAHex: string;
	accentAAlpha: number;
	accentBHex: string;
	accentBAlpha: number;
}

export interface EventCardBackgroundImage {
	source: EventCardBackgroundImageSource;
	/** When `source === 'storage'` this is a bucket-relative path like `ui/event-card-background/123.png` */
	path: string | null;
	bucket: string;
	/** When `source === 'url'` this is a direct URL */
	url: string | null;
	/** Cache-busting version value (e.g. Date.now()) */
	version: number;
}

export interface EventCardBackgroundSettings {
	mode: EventCardBackgroundMode;
	gradient: EventCardBackgroundGradient;
	image: EventCardBackgroundImage;
}

export const EVENT_CARD_BACKGROUND_STORAGE_KEY = 'event-card-background-v1';

export const defaultEventCardBackgroundSettings: EventCardBackgroundSettings = {
	mode: 'gradient',
	gradient: {
		accentAHex: '#8b5cf6',
		accentAAlpha: 0.22,
		accentBHex: '#3b82f6',
		accentBAlpha: 0.16
	},
	image: {
		source: 'storage',
		path: null,
		bucket: 'game_assets',
		url: null,
		version: Date.now()
	}
};

function clamp01(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(1, value));
}

function isHexColor(value: unknown): value is string {
	return typeof value === 'string' && /^#([A-Fa-f0-9]{6})$/.test(value);
}

function normalizeSettings(input: unknown): EventCardBackgroundSettings {
	const maybe = typeof input === 'object' && input !== null ? (input as Partial<EventCardBackgroundSettings>) : null;

	const mode: EventCardBackgroundMode =
		maybe?.mode === 'image' || maybe?.mode === 'gradient' ? maybe.mode : defaultEventCardBackgroundSettings.mode;

	const gradientInput = (maybe?.gradient ?? {}) as Partial<EventCardBackgroundGradient>;
	const gradient: EventCardBackgroundGradient = {
		accentAHex: isHexColor(gradientInput.accentAHex)
			? gradientInput.accentAHex
			: defaultEventCardBackgroundSettings.gradient.accentAHex,
		accentAAlpha: clamp01(
			typeof gradientInput.accentAAlpha === 'number'
				? gradientInput.accentAAlpha
				: defaultEventCardBackgroundSettings.gradient.accentAAlpha
		),
		accentBHex: isHexColor(gradientInput.accentBHex)
			? gradientInput.accentBHex
			: defaultEventCardBackgroundSettings.gradient.accentBHex,
		accentBAlpha: clamp01(
			typeof gradientInput.accentBAlpha === 'number'
				? gradientInput.accentBAlpha
				: defaultEventCardBackgroundSettings.gradient.accentBAlpha
		)
	};

	const imageInput = (maybe?.image ?? {}) as Partial<EventCardBackgroundImage>;
	const source: EventCardBackgroundImageSource =
		imageInput.source === 'url' || imageInput.source === 'storage'
			? imageInput.source
			: defaultEventCardBackgroundSettings.image.source;

	const image: EventCardBackgroundImage = {
		source,
		path: typeof imageInput.path === 'string' ? imageInput.path : null,
		bucket: typeof imageInput.bucket === 'string' && imageInput.bucket.trim()
			? imageInput.bucket.trim()
			: defaultEventCardBackgroundSettings.image.bucket,
		url: typeof imageInput.url === 'string' && imageInput.url.trim() ? imageInput.url.trim() : null,
		version: typeof imageInput.version === 'number' && Number.isFinite(imageInput.version)
			? imageInput.version
			: defaultEventCardBackgroundSettings.image.version
	};

	return { mode, gradient, image };
}

export function normalizeEventCardBackgroundSettings(input: unknown): EventCardBackgroundSettings {
	return normalizeSettings(input);
}

export function readEventCardBackgroundSettings(): EventCardBackgroundSettings {
	if (typeof window === 'undefined') return defaultEventCardBackgroundSettings;
	try {
		const stored = localStorage.getItem(EVENT_CARD_BACKGROUND_STORAGE_KEY);
		if (!stored) return defaultEventCardBackgroundSettings;
		return normalizeSettings(JSON.parse(stored));
	} catch (err) {
		console.warn('Failed to load event card background from localStorage:', err);
		return defaultEventCardBackgroundSettings;
	}
}

export function writeEventCardBackgroundSettings(settings: EventCardBackgroundSettings): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(EVENT_CARD_BACKGROUND_STORAGE_KEY, JSON.stringify(settings));
	} catch (err) {
		console.warn('Failed to save event card background to localStorage:', err);
	}
}
