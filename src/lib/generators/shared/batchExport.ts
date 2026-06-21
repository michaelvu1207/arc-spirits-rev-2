/**
 * Generic batch export utility for card generation.
 *
 * Replaces the duplicate batch loops in MonsterCardLayoutConfigurator,
 * LocationCardLayoutConfigurator, and page-level batch generators.
 */

import { supabase } from '$lib/api/supabaseClient';
import { processAndUploadImage } from '$lib/utils/storage';
import { renderCardToBlob, type ZoneDataMap } from './layoutRenderer';
import type { CardLayoutConfig, CardRenderer } from './layoutTypes';

export interface BatchExportOptions<T> {
	entities: T[];
	config: CardLayoutConfig;
	renderer: CardRenderer<T>;
	/** Return the base image URL for an entity. Return null to skip. */
	getBaseImageUrl: (entity: T) => string | null;
	/** Return a unique ID for the entity (used as filename). */
	getId: (entity: T) => string;
	/** Return a display name for progress reporting. */
	getName: (entity: T) => string;
	/** Build the zone data map for an entity. */
	buildZoneData: (entity: T, config: CardLayoutConfig) => ZoneDataMap;
	/** Storage folder path (e.g. 'card_images/monsters/en_generated'). */
	storageFolder: string;
	/** DB table to update with the generated image path. */
	dbTable: string;
	/** DB column to store the image path in. */
	dbImageColumn: string;
	/** DB schema (defaults to 'arc_spirits_assets'). */
	dbSchema?: string;
	/** Progress callback. */
	onProgress?: (progress: BatchProgress) => void;
	/** Fonts to load before starting. */
	loadFonts?: () => Promise<void>;
}

export interface BatchProgress {
	processed: number;
	total: number;
	currentName: string;
	errors: string[];
}

export interface BatchResult {
	processed: number;
	errors: string[];
}

export async function batchExportCards<T>(options: BatchExportOptions<T>): Promise<BatchResult> {
	const {
		entities,
		config,
		renderer,
		getBaseImageUrl,
		getId,
		getName,
		buildZoneData,
		storageFolder,
		dbTable,
		dbImageColumn,
		dbSchema = 'arc_spirits_assets',
		onProgress,
		loadFonts
	} = options;

	// Load fonts if specified
	if (loadFonts) {
		await loadFonts();
	}

	const targets = entities.filter((e) => getBaseImageUrl(e) !== null);
	const errors: string[] = [];
	const now = new Date().toISOString();

	for (let i = 0; i < targets.length; i++) {
		const entity = targets[i];
		const name = getName(entity);
		const id = getId(entity);

		onProgress?.({ processed: i, total: targets.length, currentName: name, errors });

		try {
			const baseUrl = getBaseImageUrl(entity);
			if (!baseUrl) continue;

			const zoneData = buildZoneData(entity, config);
			const blob = await renderCardToBlob(config, baseUrl, entity, renderer, zoneData);

			const { data, error: uploadErr } = await processAndUploadImage(blob, {
				folder: storageFolder,
				filename: id,
				cropTransparent: false,
				upsert: true
			});
			if (uploadErr) throw uploadErr;

			const uploadedPath = data?.path ?? '';
			const { error: updateErr } = await supabase
				.schema(dbSchema)
				.from(dbTable)
				.update({ [dbImageColumn]: uploadedPath, updated_at: now })
				.eq('id', id);
			if (updateErr) throw updateErr;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errors.push(`${name}: ${message}`);
		}
	}

	onProgress?.({ processed: targets.length, total: targets.length, currentName: '', errors });

	return { processed: targets.length, errors };
}
