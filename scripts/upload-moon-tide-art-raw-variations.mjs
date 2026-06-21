import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const generatedDir =
	'/Users/maikyon/.codex/generated_images/019e0a50-d24b-7191-ae78-5200d6ef5235';

function parseEnvFile(raw) {
	const values = {};
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
		if (!match) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		values[match[1]] = value;
	}
	return values;
}

async function loadLocalEnv() {
	for (const name of ['.env', '.env.local']) {
		try {
			const envPath = path.join(repoRoot, name);
			const raw = await readFile(envPath, 'utf8');
			Object.assign(process.env, parseEnvFile(raw));
		} catch {
			// Optional env files.
		}
	}
}

function slugify(value) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 70);
}

const generatedPrompt =
	'Generated as a waist-up Moon Tide raw art variation in the existing soft painterly Arc Spirits style, using moonlit tide colors and distinct character poses.';

const variations = [
	{
		spiritId: 'cafb6cfb-11f8-476c-a275-a5b8179630d2',
		spiritName: 'Arcane Huntress',
		file: 'ig_02dfa2208a1bcaa90169fe9ba089f48198ae32cf45800142f0.png',
		label: 'AI waist-up Arcane Huntress Moon Tide'
	},
	{
		spiritId: '955abfc0-fa04-4ab3-bcaf-5dc2839ddec0',
		spiritName: 'Shell Defender',
		file: 'ig_02dfa2208a1bcaa90169fe9bfae71c8198bb40803a42276f22.png',
		label: 'AI waist-up Shell Defender Moon Tide'
	},
	{
		spiritId: 'c6548ffd-4852-4e62-9c5a-9329e40d222e',
		spiritName: 'Fish Guide',
		file: 'ig_02dfa2208a1bcaa90169fe9c5986d881989abe694f092cd9c7.png',
		label: 'AI waist-up Fish Guide Moon Tide'
	},
	{
		spiritId: '241c977c-d1c8-4ef5-856b-8100ef228f72',
		spiritName: 'Squid Girl',
		file: 'ig_02dfa2208a1bcaa90169fe9cc045288198beb196d9bbe32168.png',
		label: 'AI waist-up Squid Girl Moon Tide'
	},
	{
		spiritId: '1781a426-913b-4446-a062-a0ecfe401027',
		spiritName: 'Pond Girl',
		file: 'ig_02dfa2208a1bcaa90169fe9d21bbc0819899e0360e937f2803.png',
		label: 'AI waist-up Pond Girl Moon Tide'
	},
	{
		spiritId: 'be2072ea-ccdb-4941-b1b3-26890a7b64cf',
		spiritName: 'Water Dragon',
		file: 'ig_02dfa2208a1bcaa90169fe9d878da08198ba06aefa21af7dbe.png',
		label: 'AI waist-up Water Dragon Moon Tide'
	},
	{
		spiritId: 'e95c775b-0677-4884-bc59-12ae2762ca8b',
		spiritName: 'Turtle',
		file: 'ig_02dfa2208a1bcaa90169fe9de4a924819882bd4e166abf75e8.png',
		label: 'AI waist-up Turtle Moon Tide'
	},
	{
		spiritId: '36bb656c-49fe-4d50-a037-b29dbd1bfa91',
		spiritName: 'Tidal Fairy',
		file: 'ig_02dfa2208a1bcaa90169fe9e506d108198b3ed1cf27d7549f9.png',
		label: 'AI waist-up Tidal Fairy Moon Tide'
	}
];

await loadLocalEnv();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error('Missing PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or PUBLIC_SUPABASE_ANON_KEY.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
	auth: { persistSession: false, autoRefreshToken: false },
	db: { schema: 'arc-spirits-rev2' }
});
const storage = supabase.storage.from('game_assets');

for (const item of variations) {
	const localPath = path.join(generatedDir, item.file);
	const bytes = await readFile(localPath);
	const storagePath = `hex_spirits/${item.spiritId}/art_raw_variations/${slugify(item.label)}.png`;

	const { error: uploadError } = await storage.upload(storagePath, bytes, {
		contentType: 'image/png',
		upsert: true
	});
	if (uploadError) throw uploadError;

	const { error: variantError } = await supabase
		.from('hex_spirit_art_raw_variants')
		.upsert(
			{
				hex_spirit_id: item.spiritId,
				label: item.label,
				description: `Generated Moon Tide variation for ${item.spiritName}.`,
				storage_path: storagePath,
				source: 'generated',
				prompt: generatedPrompt,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'hex_spirit_id,storage_path' }
		);
	if (variantError) throw variantError;

	console.log(`${item.spiritName}: ${storagePath}`);
}
