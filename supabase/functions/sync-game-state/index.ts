import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// Schema constant matching existing pattern
const SCHEMA = "arc_spirits_assets";

// Type definitions for incoming payload
interface Spirit {
  slotIndex: number;
  id?: string;
  name: string;
  cost?: number;
  classes?: Record<string, number>;
  origins?: Record<string, number>;
}

interface BagSpirit {
  name: string;
  guid: string;
  id?: string;
  cost?: number;
}

interface HexSpiritsBag {
  count: number;
  contents: BagSpirit[];
}

interface PurgeBag {
  index: number;
  name: string;
  count: number;
  contents: BagSpirit[];
}

interface BagsData {
  hexSpirits: HexSpiritsBag;
  purgeBags: PurgeBag[];
}

interface PlayerData {
  playerColor: string;
  selectedCharacter: string;
  spirits: Spirit[];
  blood: number;
  victoryPoints: number;
}

interface SyncPayload {
  gameId: string;
  timestamp: string;
  navigationCount: number;
  players: PlayerData[];
  bags?: BagsData;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Database connection setup (matching existing pattern)
  const dbUrl =
    Deno.env.get("SUPABASE_DB_URL") ??
    Deno.env.get("SUPABASE_DB_CONNECTION_STRING") ??
    Deno.env.get("DATABASE_URL");

  if (!dbUrl) {
    return new Response(
      JSON.stringify({ success: false, error: "Database connection string not set" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const client = new Client(dbUrl);

  try {
    await client.connect();

    // Parse request body
    const payload: SyncPayload = await req.json();

    // Validate payload
    if (!payload.gameId || !payload.timestamp || !Array.isArray(payload.players)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid payload: missing gameId, timestamp, or players",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    const gameId = payload.gameId;
    const gameTimestamp = new Date(payload.timestamp).toISOString();
    const navigationCount = payload.navigationCount ?? 0;
    const bags = payload.bags ?? { hexSpirits: { count: 0, contents: [] }, purgeBags: [] };

    // Upsert each player's game state
    let insertedCount = 0;
    for (const player of payload.players) {
      await client.queryObject(
        `INSERT INTO "${SCHEMA}".game_state_snapshots (
          game_id,
          game_timestamp,
          navigation_count,
          player_color,
          selected_character,
          blood,
          victory_points,
          spirits,
          bags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (game_id, navigation_count, player_color)
        DO UPDATE SET
          game_timestamp = EXCLUDED.game_timestamp,
          selected_character = EXCLUDED.selected_character,
          blood = EXCLUDED.blood,
          victory_points = EXCLUDED.victory_points,
          spirits = EXCLUDED.spirits,
          bags = EXCLUDED.bags,
          updated_at = now()`,
        [
          gameId,
          gameTimestamp,
          navigationCount,
          player.playerColor,
          player.selectedCharacter,
          player.blood ?? 0,
          player.victoryPoints ?? 0,
          JSON.stringify(player.spirits),
          JSON.stringify(bags),
        ]
      );
      insertedCount++;
    }

    // Success response
    return new Response(
      JSON.stringify({
        success: true,
        gameId: gameId,
        message: `Synced ${insertedCount} player(s) for game ${gameId} at navigation round ${navigationCount}`,
        count: insertedCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("sync-game-state failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } finally {
    await client.end();
  }
});
