alter table "arc-spirits-rev2".travelers
  add column if not exists trade_left_icon_ids jsonb not null default '[]'::jsonb,
  add column if not exists trade_right_icon_ids jsonb not null default '[]'::jsonb;
