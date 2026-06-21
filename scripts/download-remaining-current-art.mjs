import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const outDir = '/Users/maikyon/.codex/current_art/remaining_spirits';

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
			const raw = await readFile(path.join(repoRoot, name), 'utf8');
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
		.slice(0, 80);
}

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

const query = `
with generated as (
  select distinct hex_spirit_id
  from "arc-spirits-rev2".hex_spirit_art_raw_variants
  where source = 'generated'
), spirit_origins as (
  select hs.id, hs.name, hs.description, hs.art_raw_image_path, hs.cost, origin_id::uuid
  from "arc-spirits-rev2".hex_spirits hs
  cross join lateral jsonb_array_elements_text(coalesce(hs.traits->'origin_ids', '[]'::jsonb)) as origin_id
), active_spirits as (
  select so.*
  from spirit_origins so
  left join "arc-spirits-rev2".disabled_hex_spirits dhs on dhs.id = so.id
  left join "arc-spirits-rev2".disabled_origins diso on diso.origin_id = so.origin_id
  where dhs.id is null and diso.origin_id is null
)
select a.id, a.name, a.description, a.cost, a.art_raw_image_path, o.name as origin_name, o.description as origin_description, o.position as origin_position
from active_spirits a
join "arc-spirits-rev2".origins o on o.id = a.origin_id
left join generated g on g.hex_spirit_id = a.id
where g.hex_spirit_id is null
order by o.position, a.cost, a.name;
`;

let rows;
const { data: sqlRows, error } = await supabase.rpc('exec_sql', { query });
if (error) {
	// The app does not expose a generic RPC in all environments; fall back to REST reads and filter locally.
	const { data: spirits, error: spiritsError } = await supabase.from('hex_spirits').select('*');
	if (spiritsError) throw spiritsError;
	const { data: origins, error: originsError } = await supabase.from('origins').select('*');
	if (originsError) throw originsError;
	const { data: disabledSpirits, error: disabledSpiritsError } = await supabase
		.from('disabled_hex_spirits')
		.select('id');
	if (disabledSpiritsError) throw disabledSpiritsError;
	const { data: disabledOrigins, error: disabledOriginsError } = await supabase
		.from('disabled_origins')
		.select('origin_id');
	if (disabledOriginsError) throw disabledOriginsError;
	const { data: variants, error: variantsError } = await supabase
		.from('hex_spirit_art_raw_variants')
		.select('hex_spirit_id,source')
		.eq('source', 'generated');
	if (variantsError) throw variantsError;

	const originById = new Map(origins.map((origin) => [origin.id, origin]));
	const disabledSpiritIds = new Set(disabledSpirits.map((spirit) => spirit.id));
	const disabledOriginIds = new Set(disabledOrigins.map((origin) => origin.origin_id));
	const generatedIds = new Set(variants.map((variant) => variant.hex_spirit_id));

	const filtered = [];
	for (const spirit of spirits) {
		for (const originId of spirit.traits?.origin_ids ?? []) {
			if (disabledSpiritIds.has(spirit.id) || disabledOriginIds.has(originId) || generatedIds.has(spirit.id)) {
				continue;
			}
			const origin = originById.get(originId);
			if (!origin) continue;
			filtered.push({
				id: spirit.id,
				name: spirit.name,
				description: spirit.description,
				cost: spirit.cost,
				art_raw_image_path: spirit.art_raw_image_path,
				origin_name: origin.name,
				origin_description: origin.description,
				origin_position: origin.position
			});
		}
	}
	rows = filtered.sort(
		(a, b) =>
			a.origin_position - b.origin_position ||
			a.cost - b.cost ||
			a.name.localeCompare(b.name)
	);
} else {
	rows = sqlRows;
}

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(rows, null, 2));

const storage = supabase.storage.from('game_assets');
for (const row of rows) {
	if (!row.art_raw_image_path) continue;
	const { data: blob, error: downloadError } = await storage.download(row.art_raw_image_path);
	if (downloadError) throw downloadError;
	const ext = path.extname(row.art_raw_image_path) || '.png';
	const fileName = `${String(row.origin_position).padStart(3, '0')}_${slugify(row.origin_name)}_${slugify(row.name)}${ext}`;
	const bytes = Buffer.from(await blob.arrayBuffer());
	await writeFile(path.join(outDir, fileName), bytes);
	console.log(`${row.origin_name} / ${row.name}: ${fileName}`);
}
