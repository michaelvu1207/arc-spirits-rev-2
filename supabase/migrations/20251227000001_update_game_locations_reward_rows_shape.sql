-- Update reward_rows comment to reflect gain/trade row shapes

COMMENT ON COLUMN "arc-spirits-rev2".game_locations.reward_rows IS
  'JSON array of reward rows. Each row is either: {"type":"gain","gain_icon_ids":["uuid", ...]} or {"type":"trade","cost_icon_ids":["uuid", ...],"gain_icon_ids":["uuid", ...]}. All icon IDs reference icon_pool.';
