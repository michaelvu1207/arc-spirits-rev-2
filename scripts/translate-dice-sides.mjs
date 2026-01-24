#!/usr/bin/env node
/**
 * Translate Dice Side reward descriptions into multiple languages and store them in:
 * - `arc-spirits-rev2.dice_sides.reward_description_translations`
 *
 * Primary values remain in `reward_description`.
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
 *   node scripts/translate-dice-sides.mjs
 *   node scripts/translate-dice-sides.mjs --dry-run
 *   node scripts/translate-dice-sides.mjs --limit 10
 *   node scripts/translate-dice-sides.mjs --overwrite
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DEFAULT_SUPABASE_URL = 'https://gvxfokbptelmvvlxbigh.supabase.co';
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_LANGS = ['zh-Hans', 'zh-Hant', 'de', 'fr', 'es', 'it', 'ja', 'pl', 'ko'];

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
Translate Dice Side reward descriptions and store translations in Supabase.

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
  --limit N      Process only first N sides
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

function protectPlaceholders(input) {
	const keep = new Map();
	let idx = 0;
	const pattern = /(<[^>]+>|\{[^}]+\})/g;
	const text = String(input ?? '').replace(pattern, (match) => {
		const token = `__KEEP_${idx++}__`;
		keep.set(token, match);
		return token;
	});
	return { text, keep };
}

function restorePlaceholders(input, keep) {
	let out = String(input ?? '');
	for (const [token, value] of keep.entries()) {
		out = out.split(token).join(value);
	}
	return out;
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

async function openaiTranslateRewardDescription({ baseUrl, apiKey, model, text, langs }) {
	const protectedText = protectPlaceholders(text);

	const system = [
		'You translate tabletop game UI labels for dice faces.',
		'Return ONLY valid JSON (no markdown), shaped exactly as { "<lang>": "<text>", ... } for the requested languages.',
		'Translate naturally for each language.',
		'Preserve tokens exactly as-is (do not translate/alter), including __KEEP_0__, __KEEP_1__, etc.',
		'Keep it short.'
	].join(' ');

	const user = `Translate this dice face label into the following languages.\n\nText: ${JSON.stringify(
		protectedText.text
	)}\n\nLanguages (BCP-47 tags): ${langs.join(', ')}\n\nOutput JSON with exactly those keys.`;

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
		const v = parsed?.[lang];
		if (typeof v === 'string' && v.trim()) {
			out[lang] = restorePlaceholders(v.trim(), protectedText.keep);
		}
	}
	return out;
}

async function openaiTranslateRewardDescriptionWithRetry(opts, { maxAttempts = 5 } = {}) {
	let attempt = 0;
	while (true) {
		attempt++;
		try {
			return await openaiTranslateRewardDescription(opts);
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
	const results = [];
	let idx = 0;
	let active = 0;
	return await new Promise((resolve, reject) => {
		const next = () => {
			if (idx >= items.length && active === 0) {
				resolve(results);
				return;
			}
			while (active < concurrency && idx < items.length) {
				const currentIndex = idx++;
				active++;
				Promise.resolve(worker(items[currentIndex], currentIndex))
					.then((r) => {
						results[currentIndex] = r;
						active--;
						next();
					})
					.catch(reject);
			}
		};
		next();
	});
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

	const { data: rows, error } = await supabase
		.from('dice_sides')
		.select('id,dice_id,side_number,reward_description,reward_description_translations')
		.not('reward_description', 'is', null);

	if (error) throw error;

	const all = Array.isArray(rows) ? rows : [];
	const filtered = all.filter((row) => typeof row.reward_description === 'string' && row.reward_description.trim());
	const limited = typeof args.limit === 'number' ? filtered.slice(0, args.limit) : filtered;

	console.log(`Found ${filtered.length} sides with reward_description; processing ${limited.length}.`);

	const cache = new Map();

	let skipped = 0;
	let updated = 0;
	let failed = 0;

	await runWithConcurrency(limited, concurrency, async (row, i) => {
		const id = row.id;
		const label = String(row.reward_description ?? '').trim();
		const missingLangs = buildMissingLangs(row.reward_description_translations ?? {}, targetLangs, args.overwrite);
		if (missingLangs.length === 0) {
			skipped++;
			return;
		}

		if (requestDelayMs) await sleep(requestDelayMs);

		try {
			let cached = cache.get(label);
			if (!cached) {
				cached = openaiTranslateRewardDescriptionWithRetry({
					baseUrl: OPENAI_BASE_URL,
					apiKey: OPENAI_API_KEY,
					model: OPENAI_MODEL,
					text: label,
					langs: targetLangs
				});
				cache.set(label, cached);
			}
			const translated = await cached;

			const next = {
				...ensureObject(row.reward_description_translations),
				...Object.fromEntries(missingLangs.map((lang) => [lang, translated?.[lang]]).filter(([, v]) => typeof v === 'string' && v.trim()))
			};

			if (args.dryRun) {
				updated++;
				console.log(
					`[${i + 1}/${limited.length}] (dry-run) "${label}" (dice ${row.dice_id} side ${row.side_number}): +${missingLangs.length}`
				);
				return;
			}

			const { error: updateError } = await supabase
				.from('dice_sides')
				.update({
					reward_description_translations: next
				})
				.eq('id', id);

			if (updateError) throw updateError;
			updated++;
			console.log(
				`[${i + 1}/${limited.length}] "${label}" (dice ${row.dice_id} side ${row.side_number}): +${missingLangs.length}`
			);
		} catch (err) {
			failed++;
			console.error(
				`[${i + 1}/${limited.length}] ❌ "${label}" (dice ${row.dice_id} side ${row.side_number}): ${err?.message || String(err)}`
			);
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
