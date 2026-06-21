import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const SCHEMA = "arc_spirits_assets";
const BUCKET = "game_assets";

type EditionRow = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean | null;
  is_enabled: boolean;
};

type ScenarioRow = {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  order_num: number;
  edition_id: string;
  edition_name: string;
  display_image_path: string | null;
  is_enabled: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
};

// Storage render base URL (image transformation endpoint)
const storageRenderBaseUrl = (req: Request) => {
  const host = new URL(req.url).host; // e.g., gvxfokbptelmvvlxbigh.functions.supabase.co
  const projectRef = host.split(".")[0];
  return `https://${projectRef}.supabase.co/storage/v1/render/image/public/${BUCKET}/`;
};

const resolveStorageImageUrl = (req: Request, path: string | null): string | null => {
  if (!path) return null;
  const base = storageRenderBaseUrl(req);
  return `${base}${encodeURI(path)}?quality=80`;
};

const pickDefaultEditionName = (editions: EditionRow[]): string | null => {
  const explicit = editions.find((e) => e.is_default === true)?.name ?? null;
  if (explicit) return explicit;

  const base = editions.find((e) => e.name === "Base")?.name ?? null;
  if (base) return base;

  return editions[0]?.name ?? null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const dbUrl =
    Deno.env.get("SUPABASE_DB_URL") ??
    Deno.env.get("SUPABASE_DB_CONNECTION_STRING") ??
    Deno.env.get("DATABASE_URL");

  if (!dbUrl) {
    return new Response("Database connection string not set", { status: 500, headers: corsHeaders });
  }

  const client = new Client(dbUrl);
  await client.connect();

  try {
    const editionsRes = await client.queryObject<EditionRow>(
      `select id, name, description, is_default, is_enabled
       from "${SCHEMA}".editions
       where is_enabled = true
       order by coalesce(is_default, false) desc, name`
    );

    const scenariosRes = await client.queryObject<ScenarioRow>(
      `select
         s.id,
         s.name,
         s.display_name,
         s.description,
         es.order_num,
         e.id as edition_id,
         e.name as edition_name,
         s.display_image_path,
         s.is_enabled
       from "${SCHEMA}".edition_scenarios es
       join "${SCHEMA}".editions e on e.id = es.edition_id
       join "${SCHEMA}".scenarios s on s.id = es.scenario_id
       where s.is_enabled = true and e.is_enabled = true
       order by e.name, es.order_num, s.name`
    );

    const editions = editionsRes.rows.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      is_default: e.is_default === true,
    }));

    const scenarios = scenariosRes.rows.map((s) => ({
      id: s.id,
      name: s.name,
      display_name: s.display_name ?? null,
      description: s.description ?? null,
      order_num: s.order_num ?? 0,
      edition_id: s.edition_id,
      edition_name: s.edition_name,
      display_image_path: s.display_image_path ?? null,
      display_image_url: resolveStorageImageUrl(req, s.display_image_path ?? null),
    }));

    const body = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        default_edition_name: pickDefaultEditionName(editionsRes.rows),
        editions,
        scenarios,
      },
      null,
      2
    );

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("scenario-index failed:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } finally {
    await client.end();
  }
});
