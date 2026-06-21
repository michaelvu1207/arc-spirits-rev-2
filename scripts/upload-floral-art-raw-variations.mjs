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
	'Generated as a waist-up Floral Patch alternative in the existing soft painterly Arc Spirits style.';

const variations = [
	{
		spiritName: 'Dandelion',
		file: 'ig_0ace4f5296b35ea70169fe8ba14d9c819b98b2c20414c23ec6.png',
		label: 'AI waist-up Dandelion'
	},
	{
		spiritName: 'Rootguard',
		file: 'ig_0ace4f5296b35ea70169fe8be727bc819b87402f919bdb7e31.png',
		label: 'AI waist-up Rootguard'
	},
	{
		spiritName: 'Flowercracker',
		file: 'ig_0ace4f5296b35ea70169fe8c2eddc4819ba8f6e861939660fb.png',
		label: 'AI waist-up Flowercracker'
	},
	{
		spiritName: 'Florality',
		file: 'ig_0ace4f5296b35ea70169fe8c7af7ac819baf27b0d00fbb9671.png',
		label: 'AI waist-up Florality'
	},
	{
		spiritName: 'Floral Fighter',
		file: 'ig_0ace4f5296b35ea70169fe8cbbef48819b9dbc3ab0f6dd57e6.png',
		label: 'AI waist-up Flower Fighter'
	},
	{
		spiritName: 'Firefox',
		file: 'ig_0ace4f5296b35ea70169fe8d052d84819b9e9d9010fe19a4a6.png',
		label: 'AI waist-up Florafox'
	},
	{
		spiritName: 'Beefender',
		file: 'ig_0ace4f5296b35ea70169fe8d541e94819bb00be6eb93d6c63a.png',
		label: 'AI waist-up Beefender'
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
	const { data: spirit, error: spiritError } = await supabase
		.from('hex_spirits')
		.select('id,name')
		.eq('name', item.spiritName)
		.single();
	if (spiritError) throw spiritError;

	const localPath = path.join(generatedDir, item.file);
	const bytes = await readFile(localPath);
	const storagePath = `hex_spirits/${spirit.id}/art_raw_variations/${slugify(item.label)}.png`;

	const { error: uploadError } = await storage.upload(storagePath, bytes, {
		contentType: 'image/png',
		upsert: true
	});
	if (uploadError) throw uploadError;

	const { error: variantError } = await supabase
		.from('hex_spirit_art_raw_variants')
		.upsert(
			{
				hex_spirit_id: spirit.id,
				label: item.label,
				description: 'Generated preview from the Floral Patch style exploration.',
				storage_path: storagePath,
				source: 'generated',
				prompt: generatedPrompt,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'hex_spirit_id,storage_path' }
		);
	if (variantError) throw variantError;

	console.log(`${spirit.name}: ${storagePath}`);
}
