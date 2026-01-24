import { writable } from 'svelte/store';
import {
	defaultEventCardBackgroundSettings,
	readEventCardBackgroundSettings,
	normalizeEventCardBackgroundSettings,
	writeEventCardBackgroundSettings,
	type EventCardBackgroundSettings
} from '$lib/settings/eventCardBackground';
import { supabase } from '$lib/api/supabaseClient';

const EVENT_CARD_BACKGROUND_DB_KEY = 'event_card_background_v1';

function createEventCardBackgroundStore() {
	const { subscribe, set: setInner, update: updateInner } = writable<EventCardBackgroundSettings>(
		readEventCardBackgroundSettings()
	);

	let saveTimeout: ReturnType<typeof setTimeout> | null = null;

	function queueSaveToDb(settings: EventCardBackgroundSettings) {
		if (typeof window === 'undefined') return;
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(async () => {
			try {
				const { error } = await supabase
					.from('ui_settings')
					.upsert(
						{
							key: EVENT_CARD_BACKGROUND_DB_KEY,
							value: settings,
							updated_at: new Date().toISOString()
						},
						{ onConflict: 'key' }
					);
				if (error) throw error;
			} catch (err) {
				console.warn('Failed to persist event card background settings to DB:', err);
			}
		}, 300);
	}

	async function loadFromDb() {
		if (typeof window === 'undefined') return;
		try {
			const { data, error } = await supabase
				.from('ui_settings')
				.select('value')
				.eq('key', EVENT_CARD_BACKGROUND_DB_KEY)
				.maybeSingle();
			if (error) throw error;
			if (!data?.value) return;

			const normalized = normalizeEventCardBackgroundSettings(data.value);
			setInner(normalized);
			writeEventCardBackgroundSettings(normalized);
		} catch (err) {
			console.warn('Failed to load event card background settings from DB:', err);
		}
	}

	void loadFromDb();

	return {
		subscribe,
		set: (settings: EventCardBackgroundSettings) => {
			setInner(settings);
			writeEventCardBackgroundSettings(settings);
			queueSaveToDb(settings);
		},
		update: (updater: (settings: EventCardBackgroundSettings) => EventCardBackgroundSettings) => {
			updateInner((settings) => {
				const updated = updater(settings);
				writeEventCardBackgroundSettings(updated);
				queueSaveToDb(updated);
				return updated;
			});
		},
		reset: () => {
			setInner(defaultEventCardBackgroundSettings);
			writeEventCardBackgroundSettings(defaultEventCardBackgroundSettings);
			queueSaveToDb(defaultEventCardBackgroundSettings);
		}
	};
}

export const eventCardBackground = createEventCardBackgroundStore();
