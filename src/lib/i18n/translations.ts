export const BASE_LANGUAGE = 'base' as const;

export type TranslationLanguage = typeof BASE_LANGUAGE | string;

export function normalizeLanguageCode(value: string): string {
	return value.trim().replace(/_/g, '-').toLowerCase();
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
	const trimmed = (value ?? '').trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function getTranslationValue(record: unknown, lang: string): string | null {
	const normalizedLang = normalizeLanguageCode(lang);
	if (!normalizedLang || normalizedLang === BASE_LANGUAGE) return null;
	if (!record || typeof record !== 'object' || Array.isArray(record)) return null;

	const obj = record as Record<string, unknown>;
	const exact = obj[lang];
	if (typeof exact === 'string') return normalizeOptionalText(exact);

	const direct = obj[normalizedLang];
	if (typeof direct === 'string') return normalizeOptionalText(direct);

	for (const [key, value] of Object.entries(obj)) {
		if (normalizeLanguageCode(key) !== normalizedLang) continue;
		if (typeof value !== 'string') continue;
		return normalizeOptionalText(value);
	}

	return null;
}

/**
 * Returns a new translation record with the value for `lang` set to `next`.
 * - Empty/whitespace `next` removes the translation for that language.
 * - Deletes any existing keys that normalize to the same language tag.
 * - Preserves existing keys for other languages as-is.
 */
export function setTranslationValue(record: unknown, lang: string, next: string | null | undefined): Record<string, string> {
	const normalizedTarget = normalizeLanguageCode(lang);
	if (!normalizedTarget || normalizedTarget === BASE_LANGUAGE) return {};

	const out: Record<string, string> = {};

	if (record && typeof record === 'object' && !Array.isArray(record)) {
		for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
			if (typeof value !== 'string') continue;
			const cleaned = normalizeOptionalText(value);
			if (!cleaned) continue;
			const normalizedKey = normalizeLanguageCode(key);
			if (!normalizedKey || normalizedKey === BASE_LANGUAGE) continue;
			if (normalizedKey === normalizedTarget) continue;
			out[key] = cleaned;
		}
	}

	const cleanedNext = normalizeOptionalText(next);
	if (cleanedNext) out[lang] = cleanedNext;

	return out;
}

