-- Remove deprecated monsters.resistance (barrier is the only defensive stat).

alter table "arc-spirits-rev2".monsters
  drop column if exists resistance;

-- Migrate monster card layout configs from `resistance` placement → `barrier` placement.
update "arc-spirits-rev2".monster_card_layout_configs
set config = jsonb_set(
  config - 'resistance',
  '{barrier}',
  coalesce(config->'barrier', config->'resistance'),
  true
)
where config ? 'resistance';

comment on table "arc-spirits-rev2".monster_card_layout_configs is
  'Saved placement config for monster card layout (name/damage/barrier/reward track/effects).';

