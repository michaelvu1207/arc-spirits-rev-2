#!/usr/bin/env node
/**
 * Translate Icon Guide strings into multiple languages and store them in:
 * - `arc-spirits-rev2.icon_pool.icon_guide_name_translations`
 * - `arc-spirits-rev2.icon_pool.icon_guide_group_translations`
 * - `arc-spirits-rev2.icon_pool.description_translations`
 *
 * Only icons pinned to the Icon Guide are processed (`'icon_guide' = any(tags)`).
 *
 * Primary values remain in `icon_guide_name`, `icon_guide_group`, and `description`.
 * (When `icon_guide_name` is null/empty, the base display name falls back to `name`.)
 *
 * Requirements (env):
 * - SUPABASE_SERVICE_ROLE_KEY (required)
 * - OPENAI_API_KEY (required)
 *
 * Optional env:
 * - PUBLIC_SUPABASE_URL | VITE_SUPABASE_URL | SUPABASE_URL (optional; defaults to this project's Supabase URL)
 * - OPENAI_MODEL (default: gpt-4o-mini)
 * - OPENAI_BASE_URL (default: https://api.openai.com/v1)
 * - LANGS (default: zh-Hans,zh-Hant,de,fr,es,it,ja,pl,ko)
 * - CONCURRENCY (default: 2)
 * - REQUEST_DELAY_MS (default: 150)
 *
 * Usage:
 *   node scripts/translate-icon-guide.mjs
 *   node scripts/translate-icon-guide.mjs --dry-run
 *   node scripts/translate-icon-guide.mjs --limit 10
 *   node scripts/translate-icon-guide.mjs --overwrite
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DEFAULT_SUPABASE_URL = 'https://gvxfokbptelmvvlxbigh.supabase.co';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_LANGS = ['zh-Hans', 'zh-Hant', 'de', 'fr', 'es', 'it', 'ja', 'pl', 'ko'];
const ICON_GUIDE_TAG = 'icon_guide';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(argv) {
	const args = { dryRun: false, overwrite: false, limit: null };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--dry-run') args.dryRun = true;
		else if (a === '--overwrite') args.overwrite = true;
		else if (a === '--limit') {
			const v = argv[i + 1];
			i++;
			const n = Number(v);
			args.limit = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
		} else if (a === '--help' || a === '-h') {
			printHelp();
			process.exit(0);
		}
	}
	return args;
}

function printHelp() {
	console.log(`
Translate Icon Guide strings (name, group, description) and store in Supabase.

Env:
  SUPABASE_SERVICE_ROLE_KEY (required)
  OPENAI_API_KEY (required)

Optional env:
  PUBLIC_SUPABASE_URL | VITE_SUPABASE_URL | SUPABASE_URL (optional)
  OPENAI_MODEL (default: ${DEFAULT_OPENAI_MODEL})
  OPENAI_BASE_URL (default: ${DEFAULT_OPENAI_BASE_URL})
  LANGS (default: ${DEFAULT_LANGS.join(',')})
  CONCURRENCY (default: 2)
  REQUEST_DELAY_MS (default: 150)

Args:
  --dry-run      Do not write to DB
  --overwrite    Overwrite existing translations
  --limit N      Process only first N icon guide rows
`);
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFile(path) {
	const envVars = {};
	try {
		const envContent = readFileSync(path, 'utf-8');
		envContent.split('\n').forEach((line) => {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) return;
			const [key, ...valueParts] = trimmed.split('=');
			if (!key || valueParts.length === 0) return;
			envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
		});
	} catch {
		// ignore missing file
	}
	return envVars;
}

function getEnv(key, envVars) {
	return process.env[key] || envVars[key];
}

function parseCsvList(value, fallback) {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim();
	if (!trimmed) return fallback;
	return trimmed
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
}

function normalizeOptionalText(value) {
	const trimmed = (value ?? '').trim();
	return trimmed.length > 0 ? trimmed : null;
}

function ensureObject(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return value;
}

function buildMissingLangs(existing, targetLangs, overwrite) {
	if (overwrite) return targetLangs;
	const safe = ensureObject(existing);
	return targetLangs.filter((lang) => {
		const v = safe[lang];
		return typeof v !== 'string' || v.trim().length === 0;
	});
}

async function fetchJson(url, { method = 'GET', headers = {}, body } = {}) {
	const res = await fetch(url, { method, headers, body });
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		// ignore
	}
	if (!res.ok) {
		const msg = json?.error?.message || json?.message || text || `HTTP ${res.status}`;
		const err = new Error(msg);
		err.status = res.status;
		err.responseText = text;
		throw err;
	}
	return json;
}

async function openaiTranslateIconGuideGroups({ baseUrl, apiKey, model, groups, langs }) {
	const system = [
		'You translate tabletop game UI category labels.',
		'Return ONLY valid JSON (no markdown).',
		'Output JSON shaped exactly as { "<lang>": { "<group>": "<translation>", ... }, ... } for the requested languages and groups.',
		'Keep each translation short (a category label), no punctuation, no explanations.',
		'Use natural translations commonly used in games.'
	].join(' ');

	const user = `Translate these Icon Guide group labels into the following languages.\n\nGroups: ${JSON.stringify(
		groups
	)}\n\nLanguages (BCP-47 tags): ${langs.join(', ')}\n\nOutput JSON with exactly those language keys; each language maps group->translation.`;

	const payload = {
		model,
		temperature: 0,
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: user }
		],
		response_format: { type: 'json_object' }
	};

	const json = await fetchJson(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify(payload)
	});

	const content = json?.choices?.[0]?.message?.content;
	if (typeof content !== 'string' || !content.trim()) {
		throw new Error('OpenAI response missing message content.');
	}

	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new Error(`OpenAI returned non-JSON content: ${content.slice(0, 200)}`);
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('OpenAI returned JSON but not an object.');
	}

	const out = {};
	for (const lang of langs) {
		const perLang = parsed[lang];
		if (!perLang || typeof perLang !== 'object' || Array.isArray(perLang)) continue;
		out[lang] = {};
		for (const group of groups) {
			const v = perLang[group];
			if (typeof v !== 'string' || !v.trim()) continue;
			out[lang][group] = v.trim();
		}
	}
	return out;
}

async function openaiTranslateIconGuideGroupsWithRetry(opts, { maxAttempts = 5 } = {}) {
	let attempt = 0;
	while (true) {
		attempt++;
		try {
			return await openaiTranslateIconGuideGroups(opts);
		} catch (err) {
			const status = err?.status;
			const retryable = status === 429 || (typeof status === 'number' && status >= 500);
			if (!retryable || attempt >= maxAttempts) throw err;
			const backoff = Math.min(8000, 500 * 2 ** (attempt - 1));
			await sleep(backoff);
		}
	}
}

async function openaiTranslateIconGuideEntry({ baseUrl, apiKey, model, name, description, langs }) {
	const system = [
		'You translate tabletop game icon guide text.',
		'Return ONLY valid JSON (no markdown), shaped exactly as { "<lang>": { "name": "<...>", "description": "<...>" }, ... } for the requested languages.',
		'Translate naturally for each language.',
		'Keep "name" short; keep "description" concise and readable.',
		'Preserve placeholders exactly as-is (do not translate or alter): {origin}, {class}, {quantity}, {rune}, and any {like_this}.',
		'Do not add explanations, parentheses, or extra notes.'
	].join(' ');

	const user = `Translate this Icon Guide entry into the following languages.\n\nName: ${JSON.stringify(
		name
	)}\nDescription: ${JSON.stringify(description)}\n\nLanguages (BCP-47 tags): ${langs.join(
		', '
	)}\n\nOutput JSON with exactly those keys.`;

	const payload = {
		model,
		temperature: 0,
		messages: [
			{ role: 'system', content: system },
			{ role: 'user', content: user }
		],
		response_format: { type: 'json_object' }
	};

	const json = await fetchJson(`${baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify(payload)
	});

	const content = json?.choices?.[0]?.message?.content;
	if (typeof content !== 'string' || !content.trim()) {
		throw new Error('OpenAI response missing message content.');
	}

	let parsed;
	try {
		parsed = JSON.parse(content);
	} catch {
		throw new Error(`OpenAI returned non-JSON content: ${content.slice(0, 200)}`);
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('OpenAI returned JSON but not an object.');
	}

	const outByLang = {};
	for (const lang of langs) {
		const v = parsed[lang];
		if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
		const nameOut = typeof v.name === 'string' ? v.name.trim() : '';
		const descOut = typeof v.description === 'string' ? v.description.trim() : '';
		const safe = {};
		if (nameOut) safe.name = nameOut;
		if (descOut) safe.description = descOut;
		if (Object.keys(safe).length > 0) outByLang[lang] = safe;
	}
	return outByLang;
}

async function openaiTranslateIconGuideEntryWithRetry(opts, { maxAttempts = 5 } = {}) {
	let attempt = 0;
	while (true) {
		attempt++;
		try {
			return await openaiTranslateIconGuideEntry(opts);
		} catch (err) {
			const status = err?.status;
			const retryable = status === 429 || (typeof status === 'number' && status >= 500);
			if (!retryable || attempt >= maxAttempts) throw err;
			const backoff = Math.min(8000, 500 * 2 ** (attempt - 1));
			await sleep(backoff);
		}
	}
}

async function runWithConcurrency(items, concurrency, worker) {
	const results = new Array(items.length);
	let currentIndex = 0;
	let active = 0;

	return new Promise((resolve, reject) => {
		const next = () => {
			if (currentIndex >= items.length && active === 0) {
				resolve(results);
				return;
			}
			while (active < concurrency && currentIndex < items.length) {
				active++;
				Promise.resolve(worker(items[currentIndex], currentIndex))
					.then((r) => {
						results[currentIndex] = r;
						active--;
						next();
					})
					.catch(reject);
				currentIndex++;
			}
		};
		next();
	});
}

function buildCanonicalGroupTranslations(icons, targetLangs) {
	const out = new Map();
	for (const icon of icons) {
		const baseGroup = normalizeOptionalText(icon.icon_guide_group);
		if (!baseGroup) continue;
		const existing = ensureObject(icon.icon_guide_group_translations);
		let perGroup = out.get(baseGroup);
		if (!perGroup) {
			perGroup = {};
			out.set(baseGroup, perGroup);
		}
		for (const lang of targetLangs) {
			if (typeof perGroup[lang] === 'string' && perGroup[lang].trim()) continue;
			const v = existing[lang];
			if (typeof v === 'string' && v.trim()) perGroup[lang] = v.trim();
		}
	}
	return out;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));

	const repoRoot = join(__dirname, '..');
	const envVars = {
		...loadEnvFile(join(repoRoot, '.env.local')),
		...loadEnvFile(join(repoRoot, '.env'))
	};

	const SUPABASE_URL =
		getEnv('PUBLIC_SUPABASE_URL', envVars) ||
		getEnv('VITE_SUPABASE_URL', envVars) ||
		getEnv('SUPABASE_URL', envVars) ||
		DEFAULT_SUPABASE_URL;
	const SUPABASE_SERVICE_ROLE_KEY = getEnv('SUPABASE_SERVICE_ROLE_KEY', envVars);

	const OPENAI_API_KEY = getEnv('OPENAI_API_KEY', envVars);
	const OPENAI_BASE_URL = (getEnv('OPENAI_BASE_URL', envVars) || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, '');
	const OPENAI_MODEL = getEnv('OPENAI_MODEL', envVars) || DEFAULT_OPENAI_MODEL;

	const targetLangs = parseCsvList(getEnv('LANGS', envVars), DEFAULT_LANGS);
	const concurrency = Math.max(1, Math.floor(Number(getEnv('CONCURRENCY', envVars) || '2')));
	const requestDelayMs = Math.max(0, Math.floor(Number(getEnv('REQUEST_DELAY_MS', envVars) || '150')));

	if (!SUPABASE_SERVICE_ROLE_KEY) {
		console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
		process.exit(1);
	}
	if (!OPENAI_API_KEY) {
		console.error('❌ Missing OPENAI_API_KEY');
		process.exit(1);
	}

	const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		db: { schema: 'arc-spirits-rev2' }
	});

	console.log('Supabase:', SUPABASE_URL);
	console.log('Model:', OPENAI_MODEL);
	console.log('Langs:', targetLangs.join(', '));
	console.log('Concurrency:', concurrency);
	console.log('Dry run:', args.dryRun ? 'yes' : 'no');
	console.log('Overwrite:', args.overwrite ? 'yes' : 'no');

	const { data: icons, error } = await supabase
		.from('icon_pool')
		.select(
			[
				'id',
				'name',
				'description',
				'description_translations',
				'icon_guide_name',
				'icon_guide_name_translations',
				'icon_guide_group',
				'icon_guide_group_translations',
				'icon_guide_position',
				'tags'
			].join(',')
		)
		.contains('tags', [ICON_GUIDE_TAG])
		.order('icon_guide_position', { ascending: true, nullsFirst: false })
		.order('name', { ascending: true });

	if (error) throw error;

	const list = Array.isArray(icons) ? icons : [];
	const limited = typeof args.limit === 'number' ? list.slice(0, args.limit) : list;
	console.log(`Found ${list.length} icon guide rows; processing ${limited.length}.`);

	const groups = Array.from(
		new Set(limited.map((row) => normalizeOptionalText(row.icon_guide_group)).filter(Boolean))
	);

	const canonicalGroupTranslations = buildCanonicalGroupTranslations(limited, targetLangs);

	let groupTranslationsByLang = {};
	if (groups.length > 0) {
		const unionMissingLangs = args.overwrite
			? targetLangs
			: targetLangs.filter((lang) => groups.some((g) => !(canonicalGroupTranslations.get(g)?.[lang]?.trim?.() ?? false)));

		if (unionMissingLangs.length > 0) {
			console.log(`Translating ${groups.length} group labels (${unionMissingLangs.length} langs)...`);
			groupTranslationsByLang = await openaiTranslateIconGuideGroupsWithRetry({
				baseUrl: OPENAI_BASE_URL,
				apiKey: OPENAI_API_KEY,
				model: OPENAI_MODEL,
				groups,
				langs: unionMissingLangs
			});
		}
	}

	const groupTranslationsByGroup = {};
	for (const group of groups) {
		const perGroup = { ...(canonicalGroupTranslations.get(group) ?? {}) };
		for (const lang of targetLangs) {
			const v = groupTranslationsByLang?.[lang]?.[group];
			if (typeof v === 'string' && v.trim()) perGroup[lang] = v.trim();
		}
		groupTranslationsByGroup[group] = perGroup;
	}

	let skipped = 0;
	let updated = 0;
	let failed = 0;

	await runWithConcurrency(limited, concurrency, async (icon, i) => {
		const id = icon.id;
		const baseGuideName = normalizeOptionalText(icon.icon_guide_name) ?? normalizeOptionalText(icon.name) ?? '';
		const baseDescription = normalizeOptionalText(icon.description);
		const baseGroup = normalizeOptionalText(icon.icon_guide_group);

		const existingGuideNames = icon.icon_guide_name_translations ?? {};
		const existingDescriptions = icon.description_translations ?? {};
		const existingGroups = icon.icon_guide_group_translations ?? {};

		const missingGuideNames = baseGuideName
			? buildMissingLangs(existingGuideNames, targetLangs, args.overwrite)
			: [];
		const missingDescriptions = baseDescription
			? buildMissingLangs(existingDescriptions, targetLangs, args.overwrite)
			: [];
		const missingGroups = baseGroup ? buildMissingLangs(existingGroups, targetLangs, args.overwrite) : [];

		const missingOpenAi = Array.from(new Set([...missingGuideNames, ...missingDescriptions]));

		if (missingOpenAi.length === 0 && missingGroups.length === 0) {
			skipped++;
			return;
		}

		if (requestDelayMs) await sleep(requestDelayMs);

		let translated = {};
		try {
			if (missingOpenAi.length > 0) {
				translated = await openaiTranslateIconGuideEntryWithRetry({
					baseUrl: OPENAI_BASE_URL,
					apiKey: OPENAI_API_KEY,
					model: OPENAI_MODEL,
					name: baseGuideName,
					description: baseDescription ?? '',
					langs: missingOpenAi
				});
			}

			const mergedGuideNames = { ...ensureObject(existingGuideNames) };
			const mergedDescriptions = { ...ensureObject(existingDescriptions) };
			const mergedGroups = { ...ensureObject(existingGroups) };

			let nameAdded = 0;
			let descAdded = 0;
			let groupAdded = 0;

			for (const lang of missingOpenAi) {
				const row = translated?.[lang];
				if (!row || typeof row !== 'object') continue;
				const nameOut = typeof row.name === 'string' ? row.name.trim() : '';
				const descOut = typeof row.description === 'string' ? row.description.trim() : '';

				if ((args.overwrite || missingGuideNames.includes(lang)) && nameOut) {
					mergedGuideNames[lang] = nameOut;
					nameAdded++;
				}
				if ((args.overwrite || missingDescriptions.includes(lang)) && descOut) {
					mergedDescriptions[lang] = descOut;
					descAdded++;
				}
			}

			if (baseGroup && (args.overwrite || missingGroups.length > 0)) {
				const groupTranslations = groupTranslationsByGroup[baseGroup] ?? {};
				for (const lang of missingGroups) {
					const v = groupTranslations[lang];
					if (typeof v !== 'string' || !v.trim()) continue;
					mergedGroups[lang] = v.trim();
					groupAdded++;
				}
			}

			if (nameAdded === 0 && descAdded === 0 && groupAdded === 0) {
				skipped++;
				console.log(`[${i + 1}/${limited.length}] ${baseGuideName}: (no usable translations)`);
				return;
			}

			const updatePayload = {};
			if (nameAdded > 0) updatePayload.icon_guide_name_translations = mergedGuideNames;
			if (descAdded > 0) updatePayload.description_translations = mergedDescriptions;
			if (groupAdded > 0) updatePayload.icon_guide_group_translations = mergedGroups;
			updatePayload.updated_at = new Date().toISOString();

			if (args.dryRun) {
				updated++;
				console.log(
					`[${i + 1}/${limited.length}] (dry-run) ${baseGuideName}: +${nameAdded} name, +${descAdded} desc, +${groupAdded} group`
				);
				return;
			}

			const { error: updateError } = await supabase.from('icon_pool').update(updatePayload).eq('id', id);
			if (updateError) throw updateError;

			updated++;
			console.log(`[${i + 1}/${limited.length}] ${baseGuideName}: +${nameAdded} name, +${descAdded} desc, +${groupAdded} group`);
		} catch (err) {
			failed++;
			console.error(`[${i + 1}/${limited.length}] ❌ ${baseGuideName}: ${err?.message || String(err)}`);
		}
	});

	console.log('\nDone.');
	console.log('Updated:', updated);
	console.log('Skipped:', skipped);
	console.log('Failed:', failed);
	if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
	console.error('❌ Fatal:', err?.message || String(err));
	process.exit(1);
});

