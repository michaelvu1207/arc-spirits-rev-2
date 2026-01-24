import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const BUCKET = "game_assets";
const STORAGE_RENDER_PATH_PREFIX = `/storage/v1/render/image/public/${BUCKET}/`;
const STORAGE_OBJECT_PATH_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Access-Control-Expose-Headers": "content-disposition, last-modified, content-type",
};

function addNonceToUrls(value: unknown, nonce: string): unknown {
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      if (
        url.pathname.startsWith(STORAGE_RENDER_PATH_PREFIX) ||
        url.pathname.startsWith(STORAGE_OBJECT_PATH_PREFIX)
      ) {
        url.searchParams.set("cb", nonce);
        return url.toString();
      }
    } catch {
      // Not a URL – leave as-is.
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => addNonceToUrls(v, nonce));
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(input)) {
      output[key] = addNonceToUrls(v, nonce);
    }
    return output;
  }

  return value;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const upstreamUrl = new URL(req.url);
  upstreamUrl.pathname = "/functions/v1/export-all-tts-json";

  const upstreamRes = await fetch(upstreamUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!upstreamRes.ok) {
    const errorText = await upstreamRes.text();
    return new Response(errorText, {
      status: upstreamRes.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstreamRes.headers.get("Content-Type") ?? "text/plain",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  const data = await upstreamRes.json();

  // One nonce per request so repeated assets share the same URL within an export.
  const nonce = crypto.randomUUID();
  const updated = addNonceToUrls(data, nonce);

  return new Response(JSON.stringify(updated, null, 2), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, max-age=0",
      "X-TTS-Cache-Bust": nonce,
    },
  });
});
