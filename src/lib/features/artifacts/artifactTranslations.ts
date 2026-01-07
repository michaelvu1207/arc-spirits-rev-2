export type TranslationRow = { lang: string; value: string };

function normalizeLang(value: string): string {
	return value.trim().replace(/_/g, '-').toLowerCase();
}

function normalizeValue(value: string): string {
	return value.trim();
}

/**
 * Normalizes translations from either:
 * - Array rows: [{ lang: 'es', valueKey: '...' }, ...]
 * - Record map: { es: '...', 'fr-CA': '...' }
 */
export function normalizeTranslationRows(input: unknown, valueKey = 'value'): TranslationRow[] {
	const normalizedRows: TranslationRow[] = [];

	if (Array.isArray(input)) {
		for (const row of input) {
			const langRaw = typeof (row as any)?.lang === 'string' ? (row as any).lang : '';
			const valueRaw = typeof (row as any)?.[valueKey] === 'string' ? (row as any)[valueKey] : '';
			const lang = normalizeLang(langRaw);
			const value = normalizeValue(valueRaw);
			if (!lang || !value) continue;
			normalizedRows.push({ lang, value });
		}
	} else if (input && typeof input === 'object') {
		for (const [langRaw, valueRaw] of Object.entries(input as Record<string, unknown>)) {
			if (typeof valueRaw !== 'string') continue;
			const lang = normalizeLang(String(langRaw));
			const value = normalizeValue(valueRaw);
			if (!lang || !value) continue;
			normalizedRows.push({ lang, value });
		}
	}

	const deduped = new Map<string, string>();
	for (const row of normalizedRows) {
		deduped.set(row.lang, row.value);
	}

	return [...deduped.entries()]
		.map(([lang, value]) => ({ lang, value }))
		.sort((a, b) => a.lang.localeCompare(b.lang));
}

export function translationRowsToRecord(rows: TranslationRow[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const row of rows) {
		out[row.lang] = row.value;
	}
	return out;
}

/**
 * Normalizes translation values into a `{ [lang]: value }` record.
 * Accepts either array rows or a record map.
 */
export function normalizeTranslationRecord(input: unknown, valueKey = 'value'): Record<string, string> {
	return translationRowsToRecord(normalizeTranslationRows(input, valueKey));
}
