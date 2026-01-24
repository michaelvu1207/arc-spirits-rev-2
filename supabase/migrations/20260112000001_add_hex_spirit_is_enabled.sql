-- Enable/disable hex spirits globally (excluded from edition/export when disabled)

alter table "arc-spirits-rev2".hex_spirits
  add column if not exists is_enabled boolean;

update "arc-spirits-rev2".hex_spirits
  set is_enabled = true
  where is_enabled is null;

alter table "arc-spirits-rev2".hex_spirits
  alter column is_enabled set default true;

alter table "arc-spirits-rev2".hex_spirits
  alter column is_enabled set not null;

create index if not exists hex_spirits_is_enabled_idx
  on "arc-spirits-rev2".hex_spirits (is_enabled);

