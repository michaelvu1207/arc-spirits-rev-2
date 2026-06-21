alter table "arc-spirits-rev2".monsters
add column if not exists on_kill_reward_icon_ids uuid[] not null
default array['24278b1c-c935-4d4e-aed5-408ce9c9a043'::uuid, '24278b1c-c935-4d4e-aed5-408ce9c9a043'::uuid];

comment on column "arc-spirits-rev2".monsters.on_kill_reward_icon_ids is
'Ordered icon_pool UUIDs for the on-kill reward row (duplicates allowed). Default is 2× vp_raw.';
