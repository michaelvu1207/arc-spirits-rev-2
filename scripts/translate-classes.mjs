#!/usr/bin/env node
/**
 * Translate Class names + descriptions + footers into multiple languages and store them in:
 * - `arc-spirits-rev2.classes.name_translations`
 * - `arc-spirits-rev2.classes.description_translations`
 * - `arc-spirits-rev2.classes.footer_translations`
 *
 * Primary values remain in `name`, `description`, and `footer`.
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
 *   node scripts/translate-classes.mjs
 *   node scripts/translate-classes.mjs --dry-run
 *   node scripts/translate-classes.mjs --limit 10
 *   node scripts/translate-classes.mjs --overwrite
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
Translate Classes and store translations in Supabase.

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
  --limit N      Process only first N classes
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

async function openaiTranslateClass({ baseUrl, apiKey, model, name, description, footer, langs }) {
	const system = [
		'You translate tabletop game class names and short descriptions.',
		'Return ONLY valid JSON (no markdown) shaped exactly as:',
		'{ "name": { "<lang>": "<text>" }, "description": { "<lang>": "<text>" }, "footer": { "<lang>": "<text>" } }',
		'Translate naturally for each language.',
		'Keep names short; do not add explanations or parentheses.',
		'Preserve line breaks in description/footer where relevant.',
		'If description/footer is empty, return empty strings for those languages.'
	].join(' ');

	const user = [
		`Translate this Class into the following languages (BCP-47 tags): ${langs.join(', ')}`,
		`Name: ${JSON.stringify(name)}`,
		`Description: ${JSON.stringify(description ?? '')}`,
		`Footer: ${JSON.stringify(footer ?? '')}`,
		'Output JSON with exactly the keys described in the system message.'
	].join('\n');

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

	const out = { name: {}, description: {}, footer: {} };
	for (const lang of langs) {
		const n = parsed?.name?.[lang];
		const d = parsed?.description?.[lang];
		const f = parsed?.footer?.[lang];
		if (typeof n === 'string' && n.trim()) out.name[lang] = n.trim();
		if (typeof d === 'string' && d.trim()) out.description[lang] = d.trim();
		if (typeof f === 'string' && f.trim()) out.footer[lang] = f.trim();
	}
	return out;
}

async function openaiTranslateClassWithRetry(opts, { maxAttempts = 5 } = {}) {
	let attempt = 0;
	while (true) {
		attempt++;
		try {
			return await openaiTranslateClass(opts);
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
		.from('classes')
		.select('id,name,description,footer,name_translations,description_translations,footer_translations')
		.order('position', { ascending: true });

	if (error) throw error;

	const list = Array.isArray(rows) ? rows : [];
	const limited = typeof args.limit === 'number' ? list.slice(0, args.limit) : list;
	console.log(`Found ${list.length} classes; processing ${limited.length}.`);

	let skipped = 0;
	let updated = 0;
	let failed = 0;

	await runWithConcurrency(limited, concurrency, async (row, i) => {
		const id = row.id;
		const name = row.name;
		const description = row.description ?? '';
		const footer = row.footer ?? '';

		const missingName = buildMissingLangs(row.name_translations ?? {}, targetLangs, args.overwrite);
		const missingDesc = description.trim()
			? buildMissingLangs(row.description_translations ?? {}, targetLangs, args.overwrite)
			: [];
		const missingFooter = footer.trim()
			? buildMissingLangs(row.footer_translations ?? {}, targetLangs, args.overwrite)
			: [];

		const missingAll = Array.from(new Set([...missingName, ...missingDesc, ...missingFooter]));
		if (missingAll.length === 0) {
			skipped++;
			return;
		}

		if (requestDelayMs) await sleep(requestDelayMs);

		try {
			const translated = await openaiTranslateClassWithRetry({
				baseUrl: OPENAI_BASE_URL,
				apiKey: OPENAI_API_KEY,
				model: OPENAI_MODEL,
				name,
				description,
				footer,
				langs: missingAll
			});

			const nextName = { ...ensureObject(row.name_translations), ...translated.name };
			const nextDesc = { ...ensureObject(row.description_translations), ...translated.description };
			const nextFooter = { ...ensureObject(row.footer_translations), ...translated.footer };

			if (args.dryRun) {
				updated++;
				console.log(
					`[${i + 1}/${limited.length}] (dry-run) ${name}: name+${Object.keys(translated.name).length} desc+${Object.keys(translated.description).length} footer+${Object.keys(translated.footer).length}`
				);
				return;
			}

			const { error: updateError } = await supabase
				.from('classes')
				.update({
					name_translations: nextName,
					description_translations: nextDesc,
					footer_translations: nextFooter,
					updated_at: new Date().toISOString()
				})
				.eq('id', id);

			if (updateError) throw updateError;
			updated++;
			console.log(
				`[${i + 1}/${limited.length}] ${name}: name+${Object.keys(translated.name).length} desc+${Object.keys(translated.description).length} footer+${Object.keys(translated.footer).length}`
			);
		} catch (err) {
			failed++;
			console.error(`[${i + 1}/${limited.length}] ❌ ${name}: ${err?.message || String(err)}`);
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

