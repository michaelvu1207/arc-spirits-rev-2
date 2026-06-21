// deno-lint-ignore-file no-explicit-any
//
// compress-pending-assets — server-side counterpart of
// `Arc-Spirits-TTS/scripts/compress-and-upload-assets.py`.
//
// Diffs the current export-all-tts-json asset list against
// public.asset_compressed, downloads each missing source asset, applies the
// per-category preset (mirrors the Python PRESETS dict — keep in sync), uploads
// to game_assets_compressed, and upserts the row.
//
// POST {} or {} → process up to `limit` pending paths (default 100).
// POST { force: true }       → reprocess every path, not just missing.
// POST { paths: ["..."] }    → reprocess specific source paths only.
// POST { limit: 50 }         → cap how many paths this invocation processes.
//
// Returns { total, pending, processed, errors[], byCategory, durationMs }.
//
// Edge Function wall-time cap is ~2 min, so the response always tells the
// frontend whether more work remains; the button can re-call until pending=0.
//
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Image, decode as decodeImage } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SOURCE_BUCKET = "game_assets";
const COMP_BUCKET = "game_assets_compressed";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
};

type Preset = {
  maxDim: number;
  format: "JPEG" | "PNG" | "PASSTHROUGH";
  quality?: number; // JPEG only
};

// --- Per-category presets — mirrors Python PRESETS dict in
//     Arc-Spirits-TTS/scripts/compress-and-upload-assets.py.
//     PNG palette quantization isn't supported in this runtime, so PNG output
//     here is lossless RGBA — slightly larger than the Python output but
//     visually identical. Use the Python script for rebakes that need
//     quantized palettes.
const PRESETS: Record<string, Preset> = {
  // ---- JPEG (no alpha) ----
  "hex_spirits/front":         { maxDim: 1024, format: "JPEG", quality: 78 },
  "hex_spirits/back":          { maxDim: 1024, format: "JPEG", quality: 78 },
  "hex_spirits/combined":      { maxDim: 1024, format: "JPEG", quality: 78 },
  "card_images":               { maxDim: 1024, format: "JPEG", quality: 78 },
  "guardians/mat":             { maxDim: 2048, format: "JPEG", quality: 75 },
  "guardians/char_select":     { maxDim: 1024, format: "JPEG", quality: 78 },
  "game_locations":            { maxDim: 1536, format: "JPEG", quality: 78 },
  "game_location_cards":       { maxDim: 1024, format: "JPEG", quality: 78 },
  "game_location_rows":        { maxDim: 1024, format: "JPEG", quality: 80 },
  "screenshots":               { maxDim: 1280, format: "JPEG", quality: 75 },
  "tts_menu/background":       { maxDim: 1920, format: "JPEG", quality: 82 },
  "spirit_world":              { maxDim: 4096, format: "JPEG", quality: 90 },
  "exports":                   { maxDim: 1536, format: "JPEG", quality: 80 },
  "dice_faces":                { maxDim:  256, format: "JPEG", quality: 85 },
  "dice_backgrounds":          { maxDim:  512, format: "JPEG", quality: 78 },
  "dice_templates":            { maxDim: 1024, format: "JPEG", quality: 80 },
  "misc_assets":               { maxDim: 1280, format: "JPEG", quality: 78 },
  "3d_models":                 { maxDim: 1024, format: "JPEG", quality: 80 },
  // ---- PNG (lossless RGBA — alpha preserved) ----
  "tts_menu":                  { maxDim: 2048, format: "PNG" },
  "runes":                     { maxDim:  512, format: "PNG" },
  "icons/status":              { maxDim:  512, format: "PNG" },
  "icons/artifact":            { maxDim:  512, format: "PNG" },
  "icons":                     { maxDim:  512, format: "PNG" },
  "class_icons":               { maxDim:  512, format: "PNG" },
  "origin_icons":              { maxDim:  512, format: "PNG" },
  "calling_orbs":              { maxDim:  512, format: "PNG" },
  "extra_components":          { maxDim:  512, format: "PNG" },
  "guardians/chibi":           { maxDim:  512, format: "PNG" },
  "guardians/icon":            { maxDim:  512, format: "PNG" },
  "misc_assets/token":         { maxDim:  512, format: "PNG" },
  // ---- Fallback ----
  "default":                   { maxDim: 1024, format: "JPEG", quality: 78 },
};

const TOP_DIR_CATEGORY: Record<string, string> = {
  card_images: "card_images",
  calling_orbs: "calling_orbs",
  class_icons: "class_icons",
  dice_faces: "dice_faces",
  dice_backgrounds: "dice_backgrounds",
  dice_templates: "dice_templates",
  exports: "exports",
  extra_components: "extra_components",
  game_location_cards: "game_location_cards",
  game_location_rows: "game_location_rows",
  game_locations: "game_locations",
  icons: "icons",
  misc_assets: "misc_assets",
  origin_icons: "origin_icons",
  runes: "runes",
  screenshots: "screenshots",
  spirit_world: "spirit_world",
  tts_menu: "tts_menu",
};

function classify(sourcePath: string): string {
  const p = sourcePath.toLowerCase();
  if (p.endsWith(".obj") || p.endsWith(".mtl")) return "3d_models";
  if (p.startsWith("3d_models/")) return "3d_models";
  if (p.startsWith("hex_spirits/")) {
    if (p.includes("back")) return "hex_spirits/back";
    if (p.includes("combined") || p.includes("tts_combined")) return "hex_spirits/combined";
    return "hex_spirits/front";
  }
  if (p.startsWith("guardians/")) {
    if (p.includes("char_select") || p.includes("character_select")) return "guardians/char_select";
    if (p.includes("chibi")) return "guardians/chibi";
    if (p.includes("_icon") || p.includes("/icon")) return "guardians/icon";
    return "guardians/mat";
  }
  if (p.startsWith("icons/")) {
    const leaf = p.split("/").pop() ?? "";
    if (leaf.startsWith("status_")) return "icons/status";
    if (leaf.includes("search_artifact") || leaf.startsWith("artifact_") || leaf.startsWith("relic_")) {
      return "icons/artifact";
    }
  }
  if (p.startsWith("tts_menu/")) {
    if (p.endsWith("/background.png") || p.includes("/background.")) return "tts_menu/background";
    return "tts_menu";
  }
  const top = p.split("/", 1)[0];
  const cat = TOP_DIR_CATEGORY[top] ?? "default";
  if (cat === "misc_assets") {
    const leaf = p.split("/").pop() ?? "";
    const tokenish = ["token", "status", "_seal", "_summon", "_orb", "essense", "essence"];
    if (tokenish.some((k) => leaf.includes(k))) return "misc_assets/token";
  }
  return cat;
}

async function compressOne(
  supabase: ReturnType<typeof createClient>,
  sourceUrl: string,
  sourcePath: string,
): Promise<{ row?: any; error?: string }> {
  const category = classify(sourcePath);
  const preset = PRESETS[category] ?? PRESETS["default"];

  // Mesh files: passthrough
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith(".obj") || lower.endsWith(".mtl")) {
    const r = await fetch(sourceUrl);
    if (!r.ok) return { error: `download HTTP ${r.status}` };
    const buf = new Uint8Array(await r.arrayBuffer());
    const ext = lower.endsWith(".obj") ? "obj" : "mtl";
    const { error: upErr } = await supabase.storage.from(COMP_BUCKET).upload(sourcePath, buf, {
      contentType: "application/octet-stream",
      upsert: true,
      cacheControl: "31536000",
    });
    if (upErr) return { error: `upload: ${upErr.message}` };
    return {
      row: {
        source_url: sourceUrl,
        source_bucket: SOURCE_BUCKET,
        source_path: sourcePath,
        source_bytes: buf.byteLength,
        comp_url: `${SUPABASE_URL}/storage/v1/object/public/${COMP_BUCKET}/${encodeURI(sourcePath)}?v=${Date.now()}`,
        comp_bucket: COMP_BUCKET,
        comp_path: sourcePath,
        comp_bytes: buf.byteLength,
        comp_format: ext,
        comp_w: null,
        comp_h: null,
        category,
      },
    };
  }

  // Image: download → decode → resize → encode → upload
  let img: Image;
  let sourceBytes = 0;
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) return { error: `download HTTP ${r.status}` };
    const buf = new Uint8Array(await r.arrayBuffer());
    sourceBytes = buf.byteLength;
    const decoded = await decodeImage(buf);
    img = decoded instanceof Image ? decoded : (decoded as any).frames?.[0]?.image ?? (decoded as any);
    if (!(img instanceof Image)) return { error: "decode produced non-Image (animated source?)" };
  } catch (e) {
    return { error: `decode: ${(e as Error).message}` };
  }

  // Resize to fit max dim
  if (Math.max(img.width, img.height) > preset.maxDim) {
    const scale = preset.maxDim / Math.max(img.width, img.height);
    img.resize(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
  }

  // Encode
  let outBytes: Uint8Array;
  let compFormat: "jpeg" | "png";
  let compCt: string;
  let compExt: "jpg" | "png";
  try {
    if (preset.format === "JPEG") {
      // imagescript JPEG flattens alpha onto white by default; that's fine for
      // categories assigned to JPEG (cards/mats with no transparency).
      outBytes = await img.encodeJPEG(preset.quality ?? 78);
      compFormat = "jpeg";
      compCt = "image/jpeg";
      compExt = "jpg";
    } else {
      outBytes = await img.encode();
      compFormat = "png";
      compCt = "image/png";
      compExt = "png";
    }
  } catch (e) {
    return { error: `encode: ${(e as Error).message}` };
  }

  // Compose mirror path with possibly-flipped extension
  const dot = sourcePath.lastIndexOf(".");
  const compPath = dot > 0 ? `${sourcePath.slice(0, dot)}.${compExt}` : `${sourcePath}.${compExt}`;

  const { error: upErr } = await supabase.storage.from(COMP_BUCKET).upload(compPath, outBytes, {
    contentType: compCt,
    upsert: true,
    cacheControl: "31536000",
  });
  if (upErr) return { error: `upload: ${upErr.message}` };

  return {
    row: {
      source_url: sourceUrl,
      source_bucket: SOURCE_BUCKET,
      source_path: sourcePath,
      source_bytes: sourceBytes,
      // Cache-bust query stamps the URL on every (re)compress so browsers and
      // TTS asset cache treat the new file as a new resource. Without this the
      // mirror file overwrites in place but cached clients keep serving the
      // old bytes by URL key.
      comp_url: `${SUPABASE_URL}/storage/v1/object/public/${COMP_BUCKET}/${encodeURI(compPath)}?v=${Date.now()}`,
      comp_bucket: COMP_BUCKET,
      comp_path: compPath,
      comp_bytes: outBytes.byteLength,
      comp_format: compFormat,
      comp_w: img.width,
      comp_h: img.height,
      category,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const t0 = Date.now();
  const body = (await req.json().catch(() => ({}))) as {
    mode?: "list_stale";
    paths?: string[];
  };

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Drift detection mode ----
  // Returns paths whose source file's updated_at is newer than the corresponding
  // asset_compressed.compressed_at — i.e. assets the user has re-uploaded since
  // the last compression. Frontend uses this to add stale paths to its pending
  // list so the button picks them up automatically.
  if (body.mode === "list_stale") {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .schema("arc_spirits_assets")
      .from("asset_compressed")
      .select("source_path, compressed_at");
    if (existingErr) {
      return new Response(
        JSON.stringify({ error: `asset_compressed select: ${existingErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // PostgREST doesn't expose the storage schema, so we hop through a
    // SECURITY DEFINER RPC in arc_spirits_assets that selects from storage.objects
    // and returns the bucket's file inventory in one shot.
    const { data: objects, error: objErr } = await supabaseAdmin
      .schema("arc_spirits_assets")
      .rpc("list_source_object_mtimes", { bucket: SOURCE_BUCKET });
    if (objErr) {
      return new Response(
        JSON.stringify({ error: `storage.objects select: ${objErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sourceMap = new Map<string, string>();
    for (const o of objects ?? []) {
      if (o.name && o.updated_at) sourceMap.set(o.name as string, o.updated_at as string);
    }

    const stale: string[] = [];
    for (const row of existing ?? []) {
      const path = row.source_path as string;
      const compressedAt = row.compressed_at as string;
      const sourceMtime = sourceMap.get(path);
      if (sourceMtime && Date.parse(sourceMtime) > Date.parse(compressedAt)) {
        stale.push(path);
      }
    }
    return new Response(
      JSON.stringify({ stale, durationMs: Date.now() - t0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!body.paths || body.paths.length === 0) {
    return new Response(
      JSON.stringify({
        error:
          "Missing required `paths` array. Discovery is now done client-side; pass explicit source paths (e.g. ['runes/<id>/icon.png', ...]).",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  // Hard-cap per request to keep the worker comfortably under the 256 MB limit.
  // The frontend should chunk larger backfills (typical chunk: 10–20 paths).
  const MAX_PATHS_PER_REQUEST = 25;
  const work: Array<[string, string]> = body.paths.slice(0, MAX_PATHS_PER_REQUEST).map((p) => [
    `${SUPABASE_URL}/storage/v1/object/public/${SOURCE_BUCKET}/${encodeURI(p)}`,
    p,
  ]);
  const remaining = Math.max(0, body.paths.length - work.length);
  const supabase = supabaseAdmin;

  // Process serially to keep memory predictable; ~200–500 ms per asset.
  const rows: any[] = [];
  const errors: Array<{ source_url: string; source_path: string; error: string }> = [];
  const byCategory: Record<string, { processed: number; bytes: number }> = {};

  for (const [url, path] of work) {
    const r = await compressOne(supabase, url, path);
    if (r.error) {
      errors.push({ source_url: url, source_path: path, error: r.error });
    } else if (r.row) {
      rows.push(r.row);
      const c = r.row.category as string;
      byCategory[c] ??= { processed: 0, bytes: 0 };
      byCategory[c].processed += 1;
      byCategory[c].bytes += r.row.comp_bytes as number;
    }
  }

  // Bulk upsert in chunks
  if (rows.length > 0) {
    const CHUNK = 50;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .schema("arc_spirits_assets")
        .from("asset_compressed")
        .upsert(slice, { onConflict: "source_url" });
      if (error) {
        errors.push({
          source_url: "(upsert chunk)",
          source_path: `${i}..${i + slice.length}`,
          error: error.message,
        });
      }
    }
  }

  return new Response(
    JSON.stringify(
      {
        total: body.paths.length,
        processed: rows.length,
        remaining,
        errors,
        byCategory,
        durationMs: Date.now() - t0,
      },
      null,
      2,
    ),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
