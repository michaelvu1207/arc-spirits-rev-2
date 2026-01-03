alter table "arc-spirits-rev2".travelers
  add column if not exists trade_rows jsonb not null default '[]'::jsonb;

comment on column "arc-spirits-rev2".travelers.trade_rows is
  'Array of trade row objects with left/right icon id lists.';

update "arc-spirits-rev2".travelers
set trade_rows = jsonb_build_array(
  jsonb_build_object(
    'left_icon_ids', trade_left_icon_ids,
    'right_icon_ids', trade_right_icon_ids
  )
)
where trade_rows = '[]'::jsonb
  and (
    jsonb_array_length(coalesce(trade_left_icon_ids, '[]'::jsonb)) > 0
    or jsonb_array_length(coalesce(trade_right_icon_ids, '[]'::jsonb)) > 0
  );
