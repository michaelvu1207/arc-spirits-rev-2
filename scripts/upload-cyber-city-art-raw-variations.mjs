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
	'Generated as a waist-up Cyber City raw art variation in the existing soft painterly Arc Spirits style, using neon cyber colors and distinct character poses.';

const variations = [
	{
		spiritId: '40016186-6b98-4dbb-8364-b50d27e9f394',
		spiritName: 'ENCODER',
		file: 'ig_02dfa2208a1bcaa90169fea06e1bac81989fbc1a148842aca6.png',
		label: 'AI waist-up ENCODER'
	},
	{
		spiritId: '5f719599-3914-440e-b518-2426ab1e83c5',
		spiritName: 'Internet Idol',
		file: 'ig_02dfa2208a1bcaa90169fea0e629bc81989b27ea7bcedded27.png',
		label: 'AI waist-up Internet Idol'
	},
	{
		spiritId: '7e3d88c0-6854-4c13-882c-ddf78c0d2b58',
		spiritName: 'KO Fighter',
		file: 'ig_02dfa2208a1bcaa90169fea195b7a48198b9018c8de6660bfb.png',
		label: 'AI waist-up KO Fighter'
	},
	{
		spiritId: '9ef2c6f9-c6b3-4ec0-8e6e-4ddd5b26b344',
		spiritName: 'Cyberwolf',
		file: 'ig_02dfa2208a1bcaa90169fea22200a881989f0289e43a419633.png',
		label: 'AI waist-up Cyberwolf'
	},
	{
		spiritId: 'b8314d8f-ea32-44de-a3ad-62944e5ccecb',
		spiritName: 'Mod Injector',
		file: 'ig_02dfa2208a1bcaa90169fea2a51aec81989ab7b23010ee1fdc.png',
		label: 'AI waist-up Mod Injector'
	},
	{
		spiritId: '9707edd6-fbc3-4433-99f2-a687f39505fd',
		spiritName: 'CyberDive',
		file: 'ig_02dfa2208a1bcaa90169fea32e81dc819895ec2f7aa5541d43.png',
		label: 'AI waist-up CyberDive'
	},
	{
		spiritId: '0a775e09-555f-43a7-ac5b-06aaeaa4b69c',
		spiritName: 'Firewall',
		file: 'ig_02dfa2208a1bcaa90169fea455383c81989e9738e3e70b70f1.png',
		label: 'AI waist-up Firewall'
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
				description: `Generated Cyber City variation for ${item.spiritName}.`,
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
