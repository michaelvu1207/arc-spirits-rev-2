import { supabase } from '$lib/api/supabaseClient';
import type { IconPoolRow } from '$lib/types/gameData';
import { publicAssetUrl } from './storage';

/**
 * Cached icon pool data
 */
let iconPoolCache: IconPoolRow[] | null = null;
let iconPoolLookupCache: Map<string, IconPoolRow> | null = null;
let iconPoolLoadingPromise: Promise<IconPoolRow[]> | null = null;

/**
 * Load all icons from the central icon_pool table.
 * All icon sources (origins, classes, runes, dice_sides, uploaded) are synced
 * to this table via database triggers, making this the single source of truth.
 *
 * Results are cached for the session.
 *
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 * @returns Array of IconPoolRow items
 */
export async function loadIconPool(forceRefresh = false): Promise<IconPoolRow[]> {
	if (iconPoolCache && !forceRefresh) {
		return iconPoolCache;
	}

	if (iconPoolLoadingPromise && !forceRefresh) {
		return iconPoolLoadingPromise;
	}

	iconPoolLoadingPromise = (async () => {
		try {
			const { data, error } = await supabase
				.from('icon_pool')
				.select('*')
				.order('source_type')
				.order('name');

			if (error) {
				console.error('Failed to load icon pool:', error);
				return [];
			}

			iconPoolCache = data ?? [];
			iconPoolLookupCache = new Map(iconPoolCache.map((icon) => [icon.id, icon]));
			return iconPoolCache;
		} finally {
			iconPoolLoadingPromise = null;
		}
	})();

	return iconPoolLoadingPromise;
}

/**
 * Load ALL icons from the central icon_pool table.
 * This is now an alias for loadIconPool since all icons are synced via triggers.
 *
 * @param forceRefresh - If true, bypass cache and fetch fresh data
 * @returns Array of IconPoolRow items
 */
export async function loadAllIcons(forceRefresh = false): Promise<IconPoolRow[]> {
	return loadIconPool(forceRefresh);
}

/**
 * Get a single icon by ID from the cache.
 * Must call loadIconPool() first.
 *
 * @param id - Icon UUID
 * @returns IconPoolRow or undefined
 */
export function getIconById(id: string): IconPoolRow | undefined {
	return iconPoolLookupCache?.get(id);
}

/**
 * Get multiple icons by IDs from the cache.
 * Must call loadIconPool() first.
 *
 * @param ids - Array of icon UUIDs
 * @returns Array of IconPoolRow items (missing icons are filtered out)
 */
export function getIconsByIds(ids: string[]): IconPoolRow[] {
	if (!iconPoolLookupCache) return [];
	return ids.map((id) => iconPoolLookupCache!.get(id)).filter((icon): icon is IconPoolRow => !!icon);
}

/**
 * Get public URL for an icon.
 *
 * @param icon - IconPoolRow or icon ID string
 * @param cacheBust - Whether to add cache busting parameter
 * @returns Public URL or null
 */
export function getIconPoolUrl(
	icon: IconPoolRow | string | null | undefined,
	cacheBust = false
): string | null {
	if (!icon) return null;

	const iconRow = typeof icon === 'string' ? getIconById(icon) : icon;
	if (!iconRow) return null;

	return publicAssetUrl(iconRow.file_path, {
		updatedAt: cacheBust ? Date.now() : iconRow.updated_at ?? undefined
	});
}

/**
 * Resolve an array of icon IDs to their public URLs.
 *
 * @param iconIds - Array of icon UUIDs
 * @returns Array of URLs (null for missing icons)
 */
export function resolveIconUrls(iconIds: string[]): (string | null)[] {
	return iconIds.map((id) => getIconPoolUrl(id));
}

/**
 * Clear the icon pool cache.
 * Useful when icons have been added/modified.
 */
export function clearIconPoolCache(): void {
	iconPoolCache = null;
	iconPoolLookupCache = null;
}

/**
 * Create a lookup map from icon IDs to URLs.
 * Useful for batch resolution.
 *
 * @param iconIds - Array of icon UUIDs
 * @returns Map of id -> URL
 */
export function createIconUrlLookup(iconIds: string[]): Record<string, string | null> {
	const lookup: Record<string, string | null> = {};
	for (const id of iconIds) {
		lookup[id] = getIconPoolUrl(id);
	}
	return lookup;
}
